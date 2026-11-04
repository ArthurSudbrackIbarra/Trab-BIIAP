"""Do the Portuguese marker words echo the English ones? A test of H3.

    controls   for each marker (an excess style word of 2024 to 2026), the words of the same
               language with the closest frequency in 2021-2022 that were never excess; Claude
               labels them with the markers' prompt, and the closest style word becomes the
               marker's control (analysis/crosslang/controls-<lang>.csv)
    translate  Claude gives the dictionary form of every marker, and translates markers and
               controls into the other language, shuffled together so that it cannot tell them
               apart (analysis/crosslang/lemmas-<lang>.csv and translations-<lang>.csv)
    compare    share of markers and of controls with a translation that is a marker of the other
               language, Fisher's exact test, and the exact McNemar test on the marker-control
               pairs (analysis/crosslang/report.md)

Run the four `excess.py excess` variants and `excess.py label` first. Claude runs through
`claude -p`, as in the rewriting experiment, and every step resumes where it stopped.
"""

import argparse
import csv
import json
import math
import random
import re
import sys
from bisect import bisect_left
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from excess import (LABELS, LANGS, OUT, PRE_LLM, SEED, by_language_year, load_corpus,  # noqa: E402
                    parse_labels, read_excess, read_labels, table)
from harvest_scielo import log  # noqa: E402

CROSS = OUT / "crosslang"
MARKER_YEARS = (2024, 2025, 2026)
CANDIDATES = 5  # nearest-frequency words per marker, labelled to find a style control among them
MIN_BASELINE = 10  # abstracts of 2021-2022 containing a word for it to be a candidate control
LABEL_BATCH, WORD_BATCH = 120, 100
NAMES = {"pt": "Portuguese", "en": "English"}
OTHER = {"pt": "en", "en": "pt"}
# Function words that multi-word translations bring along ("delve into", "play a role").
FUNCTION_WORDS = {"into", "with", "from", "upon", "onto", "over", "about", "that", "the", "and",
                  "for", "out", "para", "com", "por", "sobre", "que", "uma", "dos", "das", "nos",
                  "nas", "pelo", "pela"}


def labels(lang):
    """The author's label where there is one, else Claude's."""
    return read_labels(LABELS / f"claude-{lang}.csv") | read_labels(LABELS / f"author-{lang}.csv")


def marker_words(lang):
    """Excess style words of `lang` in 2024-2026 under either baseline: word -> highest ratio."""
    style = labels(lang)
    markers = {}
    for variant in ("rolling", "fixed"):
        for (found_lang, year), found in read_excess(variant).items():
            if found_lang == lang and year in MARKER_YEARS:
                for word, row in found.items():
                    if style.get(word) == "style":
                        markers[word] = max(markers.get(word, 0.0), row["ratio"])
    return markers


def read_sheet(path, key="word"):
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as handle:
        return {row[key]: row for row in csv.DictReader(handle)}


def append_rows(path, fields, rows):
    new_file = not path.exists()
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        if new_file:
            writer.writeheader()
        writer.writerows(rows)


def ask_claude(prompt, words, model):
    from experiment import run_claude  # only the commands that call Claude need it

    data = run_claude(prompt + "\n".join(words) + "\n", model)
    return data["result"], next(iter(data.get("modelUsage") or {}), model)


def parse_pairs(reply, words):
    """word -> the text after it, from 'word<TAB>text' lines (a colon or ' - ' also works).

    Claude sometimes puts the word itself in dictionary form (evidenciada becomes evidenciado).
    When the reply has one line per word, such a line is matched by its position, provided the
    two words start with the same two letters.
    """
    lines = []
    for line in reply.splitlines():
        match = re.match(r"^\W*([^\W\d_]+)\W*?(?:\t+|:\s*|\s+-\s+)\s*(.+?)\s*$", line)
        if match:
            lines.append((match.group(1).lower(), match.group(2)))
    wanted = set(words)
    found = {word: text for word, text in lines if word in wanted}
    if len(lines) == len(words):
        for word, (given, text) in zip(words, lines):
            if word not in found and word[:2] == given[:2]:
                found[word] = text
    return found


def nearest(pool, count, k, taken):
    """Up to k words of `pool` ((count, tiebreak, word), sorted) closest to `count` in log scale,
    skipping and then adding to `taken`."""
    position = bisect_left(pool, (count, 0.0, ""))
    low, high, picked, target = position - 1, position, [], math.log(count + 1)
    while len(picked) < k and (low >= 0 or high < len(pool)):
        below = abs(math.log(pool[low][0] + 1) - target) if low >= 0 else math.inf
        above = abs(math.log(pool[high][0] + 1) - target) if high < len(pool) else math.inf
        if below <= above:
            word, low = pool[low][2], low - 1
        else:
            word, high = pool[high][2], high + 1
        if word not in taken:
            picked.append(word)
            taken.add(word)
    return picked


def cmd_controls(args):
    groups = by_language_year(load_corpus(with_words=True))
    prompt = (LABELS / "prompt.txt").read_text(encoding="utf-8")
    CROSS.mkdir(parents=True, exist_ok=True)
    for lang in LANGS:
        markers = marker_words(lang)
        ever_excess = set((LABELS / f"words-{lang}.txt").read_text(encoding="utf-8").split())
        counts = Counter()
        for year in PRE_LLM:
            for r in groups[lang, year]:
                counts.update(r["words"])
        rng = random.Random(f"{SEED}-controls-{lang}")
        pool = sorted((count, rng.random(), word) for word, count in counts.items()
                      if count >= MIN_BASELINE and word not in ever_excess)
        order = sorted(markers)
        rng.shuffle(order)
        taken = set()
        candidates = {marker: nearest(pool, counts[marker], CANDIDATES, taken) for marker in order}

        path = CROSS / f"candidate-labels-{lang}.csv"
        todo = sorted(taken - set(read_labels(path)))
        for start in range(0, len(todo), LABEL_BATCH):
            batch = todo[start:start + LABEL_BATCH]
            reply, model = ask_claude(prompt.format(language=NAMES[lang]), batch, args.model)
            found = parse_labels(reply, batch)
            append_rows(path, ["word", "label", "model"],
                        [{"word": w, "label": found[w], "model": model} for w in batch if w in found])
            log(f"{lang}: {start + len(batch)}/{len(todo)} candidates sent, {len(found)} labelled")

        # Each marker's control: its closest candidate labelled style, else the closest style
        # candidate still free.
        style = {word for word, label in read_labels(path).items() if label == "style"}
        spare = sorted((counts[word], rng.random(), word) for word in style)
        chosen, rows = set(), []
        for marker in order:
            control = next((w for w in candidates[marker] if w in style and w not in chosen), None)
            if control:
                chosen.add(control)
            else:
                control = next(iter(nearest(spare, counts[marker], 1, chosen)), "")
            rows.append({"marker": marker, "marker_baseline": counts[marker], "control": control,
                         "control_baseline": counts[control] if control else ""})
        path = CROSS / f"controls-{lang}.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(sorted(rows, key=lambda row: row["marker"]))
        log(f"{lang}: {len(markers)} markers, {sum(1 for r in rows if r['control'])} controls, "
            f"{len(style)} of {len(taken)} candidates labelled style")


def run_batches(path, field, words, prompt, model):
    """Send the words not yet in the sheet at `path` to Claude and append its answers."""
    done = read_sheet(path)
    todo = [word for word in words if word not in done]
    replies = CROSS / "replies"
    replies.mkdir(exist_ok=True)
    for start in range(0, len(todo), WORD_BATCH):
        batch = todo[start:start + WORD_BATCH]
        reply, used = ask_claude(prompt, batch, model)
        stamp = len(list(replies.glob(f"{path.stem}-*.txt"))) + 1
        (replies / f"{path.stem}-{stamp:02d}.txt").write_text(reply, encoding="utf-8")
        found = parse_pairs(reply, batch)
        append_rows(path, ["word", field, "model"],
                    [{"word": w, field: found[w], "model": used} for w in batch if w in found])
        log(f"{path.name}: {start + len(batch)}/{len(todo)} sent, {len(found)} answered")


def cmd_translate(args):
    lemma_prompt = (CROSS / "lemma-prompt.txt").read_text(encoding="utf-8")
    translate_prompt = (CROSS / "translate-prompt.txt").read_text(encoding="utf-8")
    for lang in LANGS:
        markers = marker_words(lang)
        controls = {row["control"] for row in read_sheet(CROSS / f"controls-{lang}.csv", "marker").values()
                    if row["control"]}
        run_batches(CROSS / f"lemmas-{lang}.csv", "lemma", sorted(markers),
                    lemma_prompt.format(language=NAMES[lang]), args.model)
        # Markers and controls go out shuffled together, so the translator cannot tell them apart.
        words = sorted(set(markers) | controls)
        random.Random(f"{SEED}-translate-{lang}").shuffle(words)
        run_batches(CROSS / f"translations-{lang}.csv", "translations", words,
                    translate_prompt.format(source=NAMES[lang], target=NAMES[OTHER[lang]]),
                    args.model)


# --- compare ----------------------------------------------------------------------------------

def tokens(text):
    return {t for t in re.findall(r"[^\W\d_]+", text.lower()) if len(t) >= 3 and t not in FUNCTION_WORDS}


def fisher_greater(a, b, c, d):
    """One-sided Fisher exact p for the table [[a, b], [c, d]]: the chance of a or more hits in
    the first row if both rows had the same hit rate."""
    first, second, hits = a + b, c + d, a + c
    total = math.comb(first + second, hits)
    return sum(math.comb(first, x) * math.comb(second, hits - x)
               for x in range(a, min(first, hits) + 1)) / total


def mcnemar_greater(only_first, only_second):
    """One-sided exact McNemar p for matched pairs: the chance that the first word is the one that
    hits in `only_first` or more of the pairs where only one word hits, if either were as likely."""
    n = only_first + only_second
    return sum(math.comb(n, k) for k in range(only_first, n + 1)) / 2 ** n


def cmd_compare(args):
    report, lines = {}, [
        "# Do the Portuguese markers echo the English ones?", "",
        "Generated by `python3 -I scripts/crosslang.py compare`. Markers are the excess style words "
        "of 2024 to 2026. A word hits when one of its translations, in dictionary form, is the "
        "dictionary form of a marker of the other language. Controls are style words of the same "
        "language and frequency in 2021-2022 that were never excess. Claude translated markers and "
        "controls shuffled together. p is Fisher's exact test, one-sided (markers hit more often); "
        "paired p is the exact McNemar test, one-sided, on each marker and its control.",
        ""]
    rows = []
    for lang in LANGS:
        other = OTHER[lang]
        other_lemmas = read_sheet(CROSS / f"lemmas-{other}.csv")
        targets = {}  # a dictionary form -> the other language's markers that have it
        for word in marker_words(other):
            for form in {word, other_lemmas.get(word, {}).get("lemma", "").lower()} - {""}:
                targets.setdefault(form, set()).add(word)
        translations = read_sheet(CROSS / f"translations-{lang}.csv")
        markers = marker_words(lang)
        matched = {marker: row["control"]
                   for marker, row in read_sheet(CROSS / f"controls-{lang}.csv", "marker").items()
                   if row["control"]}
        controls = sorted(set(matched.values()))

        def hits(word):
            found = set()
            for token in tokens(translations[word]["translations"]):
                found |= targets.get(token, set())
            return found

        marker_hits = {w: hits(w) for w in markers if w in translations}
        control_hits = {w: hits(w) for w in controls if w in translations}
        a = sum(1 for found in marker_hits.values() if found)
        c = sum(1 for found in control_hits.values() if found)
        b, d = len(marker_hits) - a, len(control_hits) - c
        p = fisher_greater(a, b, c, d)
        pairs = [(bool(marker_hits[m]), bool(control_hits[k])) for m, k in matched.items()
                 if m in marker_hits and k in control_hits]
        only_marker = sum(1 for m, k in pairs if m and not k)
        only_control = sum(1 for m, k in pairs if k and not m)
        p_paired = mcnemar_greater(only_marker, only_control)
        report[lang] = {
            "markers": len(marker_hits), "markers_hit": a, "controls": len(control_hits),
            "controls_hit": c, "p": p, "pairs_only_marker": only_marker,
            "pairs_only_control": only_control, "p_paired": p_paired,
            "pairs": {w: sorted(found) for w, found in marker_hits.items() if found},
            "own": sorted((w for w, found in marker_hits.items() if not found),
                          key=lambda w: -markers[w]),
            "control_pairs": {w: sorted(found) for w, found in control_hits.items() if found}}
        rows.append([f"{lang} to {other}", f"{a}/{a + b} ({a / (a + b):.0%})",
                     f"{c}/{c + d} ({c / (c + d):.0%})", f"{p:.1e}",
                     f"{only_marker} against {only_control}", f"{p_paired:.1e}"])
    lines += table(["direction", "markers that hit", "controls that hit", "p",
                    "pairs where only the marker / only the control hits", "paired p"], rows)
    for lang in LANGS:
        result, other = report[lang], OTHER[lang]
        ranked = sorted(result["pairs"], key=lambda w: -marker_words(lang)[w])
        article = "an" if NAMES[other][0] in "AEIOU" else "a"
        lines += [f"## {NAMES[lang]} markers with {article} {NAMES[other]} counterpart", "",
                  ", ".join(f"{w} ({'/'.join(result['pairs'][w])})" for w in ranked), "",
                  f"## {NAMES[lang]} markers without one (by ratio)", "",
                  ", ".join(result["own"]), "",
                  f"## {NAMES[lang]} controls that hit", "",
                  ", ".join(f"{w} ({'/'.join(found)})" for w, found in sorted(result["control_pairs"].items())),
                  ""]
    (CROSS / "report.md").write_text("\n".join(lines), encoding="utf-8")
    (CROSS / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
    log(f"wrote {CROSS / 'report.md'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("controls", "translate"):
        command = sub.add_parser(name)
        command.add_argument("--model", default="opus")
    sub.add_parser("compare")
    args = parser.parse_args()
    {"controls": cmd_controls, "translate": cmd_translate, "compare": cmd_compare}[args.command](args)


if __name__ == "__main__":
    main()
