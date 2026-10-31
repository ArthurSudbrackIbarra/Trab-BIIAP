"""Excess-vocabulary analysis of the Crossref corpus (H1 and H3), after Kobak et al. (2025).

    prepare   clean every Crossref abstract, guess its language and keep its set of words in
              data/interim/abstracts.jsonl.gz
    audit     coverage of the cleaned corpus by year, language, area and journal
              (analysis/coverage.md)
    excess    excess words per language and year (analysis/excess-<variant>/), and the list of
              words to label as style or content (analysis/labels/words-<lang>.txt)
    label     Claude labels every listed word (analysis/labels/claude-<lang>.csv) and a random
              sample goes to the author to label blind (analysis/labels/author-<lang>.csv)
    report    style and content words per year, agreement between the author and Claude, and the
              lower bound on the share of abstracts processed by an LLM, per language, year and
              area (analysis/report.md and analysis/report.json)

The filters follow Kobak et al.: abstracts of 250 to 4,000 characters, no errata or retraction
notices, and words of at least four letters, counted once per abstract.

Crossref holds abstracts for some journal-years and not others (a journal may deposit them from
2015 to 2017, stop, and start again in 2025), so each comparison uses a balanced panel: the
journals with at least PANEL_MIN abstracts in the language in every year the comparison uses.
`--full` runs it on every journal instead, as a robustness check. Frequencies are standardized
to the abstract lengths of the baseline years (`--raw` turns that off). An excess word must also be
widespread: used in at least MIN_JOURNALS journals that year, none holding more than MAX_SHARE of
its uses, which drops words one journal brings in (a special issue, reprinted old articles).
"""

import argparse
import csv
import gzip
import hashlib
import json
import math
import random
import re
import sys
import unicodedata
from bisect import bisect_right
from collections import Counter, defaultdict
from pathlib import Path
from statistics import NormalDist

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harvest_scielo import FIRST_YEAR, LAST_YEAR, RAW, ROOT, log, read_jsonl  # noqa: E402
from textutil import clean_abstract, detect_language, has_inner_label  # noqa: E402

CORPUS = ROOT / "data" / "interim" / "abstracts.jsonl.gz"
OUT = ROOT / "analysis"
LABELS = OUT / "labels"
YEARS = range(FIRST_YEAR, LAST_YEAR + 1)
LANGS = ("pt", "en")
MIN_CHARS, MAX_CHARS = 250, 4000
# Words of four or more Latin letters, accented ones included; hyphens and digits split words.
TOKEN = re.compile(r"[a-zà-öø-ÿ]{4,}")
NOTICE = re.compile(r"^\W*(errat|corrigend|correction|correção|corrección|retraction|retracted|"
                    r"retratação|retractación|addendum|adendo)", re.I)
STATUSES = ("ok", "duplicate", "year", "notice", "length", "language", "glued")
PANEL_MIN = 5  # abstracts per year for a journal to count as present that year
TARGETS = range(FIRST_YEAR + 3, LAST_YEAR + 1)  # years with three earlier years to compare with
MIN_COUNT = 10  # abstracts containing a word in the target year for the word to be tested
FDR = 0.05
MIN_JOURNALS, MAX_SHARE = 5, 0.5
LENGTH_BINS = 10  # deciles of distinct words per abstract, for the length standardization
LABEL_NAMES = {"style": "style", "s": "style", "estilo": "style",
               "content": "content", "c": "content", "conteúdo": "content", "conteudo": "content",
               "ambiguous": "ambiguous", "a": "ambiguous", "ambígua": "ambiguous",
               "ambigua": "ambiguous", "?": "ambiguous"}
LABEL_BATCH = 120
AUTHOR_SAMPLE = 100  # words per language the author labels blind
SEED = 20261030
BOUND_YEARS = range(2023, LAST_YEAR + 1)
PRE_LLM = (2021, 2022)  # baseline of the lower bound
PLACEBO = (2015, 2016)  # baseline of the placebo: the same span, seven years earlier
THRESHOLDS = (0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 1.0)  # candidate T for the marker set
AREA_MIN = 200  # abstracts in the year for an area's lower bound to be reported
RULES = ("rolling", "fixed")


# --- prepare ----------------------------------------------------------------------------------

def examine(row, seen_doi, seen_text):
    """One corpus record: the row's metadata, a status and, for usable abstracts, its words."""
    date = row.get("date") or []
    doi = row["doi"].lower()
    text = unicodedata.normalize("NFC", clean_abstract(row["abstract"], titles=False))
    record = {"doi": doi, "journal": row["journal"], "year": row["year"],
              "month": date[1] if len(date) > 1 else None, "chars": len(text),
              "lang": detect_language(text) if text else None}
    if doi in seen_doi:
        status = "duplicate"
    elif row["year"] not in YEARS:
        status = "year"
    elif NOTICE.match(row.get("title") or ""):
        status = "notice"
    elif not MIN_CHARS <= len(text) <= MAX_CHARS:
        status = "length"
    elif record["lang"] is None:
        status = "language"
    elif has_inner_label(text):
        # A second abstract or the keywords glued to the first.
        status = "glued"
    elif text in seen_text:
        status = "duplicate"
    else:
        status = "ok"
    seen_doi.add(doi)
    record["status"] = status
    if status == "ok":
        seen_text.add(text)
        record["words"] = sorted(set(TOKEN.findall(text.lower())))
    return record


def cmd_prepare(args):
    journals = read_jsonl(RAW / "journals.jsonl")
    files = sorted((RAW / "crossref").glob("*.jsonl.gz"))
    if len(files) < len(journals):
        raise SystemExit(f"Crossref harvest incomplete ({len(files)}/{len(journals)} journals).")
    CORPUS.parent.mkdir(parents=True, exist_ok=True)
    partial = CORPUS.with_name(CORPUS.name + ".part")
    seen_doi, seen_text, statuses = set(), set(), Counter()
    with gzip.open(partial, "wt", encoding="utf-8") as handle:
        for index, path in enumerate(files, 1):
            for row in read_jsonl(path):
                record = examine(row, seen_doi, seen_text)
                statuses[record["status"]] += 1
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            if index % 50 == 0:
                log(f"{index}/{len(files)} journals, {sum(statuses.values())} articles")
    partial.replace(CORPUS)
    log(f"{sum(statuses.values())} articles: " + ", ".join(f"{s} {statuses[s]}" for s in STATUSES))


# --- audit ------------------------------------------------------------------------------------

def load_corpus(with_words=False):
    """Corpus records; without words unless asked, to save memory."""
    records = []
    with gzip.open(CORPUS, "rt", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if not with_words:
                record.pop("words", None)
            elif "words" in record:
                record["words"] = tuple(sys.intern(word) for word in record["words"])
            records.append(record)
    return records


def table(headers, rows):
    lines = ["| " + " | ".join(str(h) for h in headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return lines + [""]


def panel(records, lang, years, minimum=PANEL_MIN):
    """Journals with at least `minimum` usable abstracts in `lang` in every one of `years`."""
    counts = Counter((r["journal"], r["year"]) for r in records
                     if r["status"] == "ok" and r["lang"] == lang)
    journals = {journal for journal, _ in counts}
    return {j for j in journals if all(counts[j, year] >= minimum for year in years)}


def cmd_audit(args):
    journals = {journal["code"]: journal for journal in read_jsonl(RAW / "journals.jsonl")}
    records = load_corpus()
    ok = [r for r in records if r["status"] == "ok"]
    areas = sorted({area for journal in journals.values() for area in journal["areas"]})
    out = ["# Coverage of the Crossref corpus", "",
           "Generated by `python3 -I scripts/excess.py audit`. An article counts as usable (ok) when "
           f"its abstract has {MIN_CHARS} to {MAX_CHARS} characters, one clear language, no second "
           "abstract or keywords glued to it, and it is not an erratum or a duplicate.", ""]

    by_year = Counter((r["year"], r["status"]) for r in records)
    out += ["## Articles by year and status", ""]
    out += table(["year", "all", *STATUSES],
                 [[year, sum(by_year[year, s] for s in STATUSES), *(by_year[year, s] for s in STATUSES)]
                  for year in YEARS])
    other = sum(1 for r in records if r["year"] not in YEARS)
    out += [f"Articles outside {FIRST_YEAR}-{LAST_YEAR} or without a year: {other}.", ""]

    by_lang = Counter((r["year"], r["lang"]) for r in ok)
    chars = defaultdict(list)
    for r in ok:
        chars[r["year"], r["lang"]].append(r["chars"])
    out += ["## Usable abstracts by year and language", ""]
    out += table(["year", "pt", "en", "es", "mean chars pt", "mean chars en"],
                 [[year, by_lang[year, "pt"], by_lang[year, "en"], by_lang[year, "es"],
                   *(round(sum(chars[year, lang]) / len(chars[year, lang]))
                     if chars[year, lang] else "-" for lang in LANGS)] for year in YEARS])

    for lang in LANGS:
        by_area = Counter()
        for r in ok:
            if r["lang"] == lang:
                for area in journals[r["journal"]]["areas"]:
                    by_area[area, r["year"]] += 1
        out += [f"## Usable abstracts in {lang} by area and year", "",
                "A journal in two areas counts in both.", ""]
        out += table(["area", *YEARS], [[area, *(by_area[area, year] for year in YEARS)]
                                        for area in areas])

    months = Counter((r["year"], r["month"]) for r in ok if r["year"] >= LAST_YEAR - 1)
    out += [f"## Usable abstracts by month, {LAST_YEAR - 1} and {LAST_YEAR}", ""]
    out += table(["year", *range(1, 13), "no month"],
                 [[year, *(months[year, m] for m in range(1, 13)), months[year, None]]
                  for year in (LAST_YEAR - 1, LAST_YEAR)])

    rows_by_journal = Counter(r["journal"] for r in records)
    ok_by_journal = Counter(r["journal"] for r in ok)
    years_by_journal = defaultdict(set)
    for r in ok:
        years_by_journal[r["journal"]].add(r["year"])
    empty = sorted(code for code in journals if not ok_by_journal[code])
    out += ["## Journals", "",
            f"{len(journals)} journals; {sum(1 for c in journals if rows_by_journal[c])} with "
            f"articles in Crossref; {len(journals) - len(empty)} with usable abstracts.", ""]
    out += [f"Journals without usable abstracts ({len(empty)}):", ""]
    out += table(["journal", "title", "articles", "statuses"],
                 [[code, journals[code]["title"], rows_by_journal[code],
                   ", ".join(f"{s} {n}" for s, n in Counter(
                       r["status"] for r in records if r["journal"] == code).most_common())]
                  for code in empty])
    gone = sorted(c for c, ys in years_by_journal.items() if ys & {2021, 2022} and not ys & {2024, 2025})
    new = sorted(c for c, ys in years_by_journal.items() if ys & {2024, 2025} and not ys & {2021, 2022})
    out += [f"With usable abstracts in 2021-2022 but none in 2024-2025 ({len(gone)}): "
            + ", ".join(f"{c} ({journals[c]['title']})" for c in gone), "",
            f"With usable abstracts in 2024-2025 but none in 2021-2022 ({len(new)}): "
            + ", ".join(f"{c} ({journals[c]['title']})" for c in new), ""]

    out += ["## Stable panels", "",
            f"Journals with at least {PANEL_MIN} usable abstracts in the language in every year of "
            "the window, and the share of that language's usable abstracts of the window they hold.", ""]
    rows = []
    for lang in LANGS:
        for first, last in ((2016, 2025), (2018, 2025), (2019, 2025), (2021, 2025)):
            window = range(first, last + 1)
            members = panel(records, lang, window)
            in_window = [r for r in ok if r["lang"] == lang and r["year"] in window]
            share = sum(1 for r in in_window if r["journal"] in members) / len(in_window)
            rows.append([lang, f"{first}-{last}", len(members), f"{share:.0%}"])
    out += table(["language", "window", "journals", "share of abstracts"], rows)

    OUT.mkdir(exist_ok=True)
    (OUT / "coverage.md").write_text("\n".join(out), encoding="utf-8")
    log(f"wrote {OUT / 'coverage.md'}")


# --- excess words -----------------------------------------------------------------------------

def baseline(year, rule):
    """The two years whose trend gives the counterfactual for `year`, and the extrapolation factor.

    The rolling rule is Kobak et al.'s for every year: the third and second years before, so every
    year is extrapolated over the same span. The fixed rule keeps 2021 and 2022 from 2023 on, so
    no year written with ChatGPT around enters the counterfactual.
    """
    if rule == "fixed" and year > PRE_LLM[1]:
        return *PRE_LLM, year - PRE_LLM[1]
    return year - 3, year - 2, 2


def half_of(doi):
    """'a' or 'b', a fixed random split of the corpus by DOI."""
    return "ab"[int(hashlib.md5(doi.encode()).hexdigest(), 16) % 2]


def by_language_year(records, half=None):
    groups = defaultdict(list)
    for r in records:
        if r["status"] == "ok" and r["lang"] in LANGS and (half is None or half_of(r["doi"]) == half):
            groups[r["lang"], r["year"]].append(r)
    return groups


def balanced_panel(groups, lang, years):
    """Journals with at least PANEL_MIN usable abstracts in `lang` in each of `years`."""
    counts = [Counter(r["journal"] for r in groups[lang, year]) for year in years]
    return {journal for journal in counts[0] if all(c[journal] >= PANEL_MIN for c in counts)}


def length_edges(groups, lang):
    """Decile edges of the number of distinct words per abstract, over every year of `lang`."""
    lengths = sorted(len(r["words"]) for (group_lang, _), rows in groups.items()
                     if group_lang == lang for r in rows)
    return [lengths[len(lengths) * k // LENGTH_BINS] for k in range(1, LENGTH_BINS)]


def frequencies(groups, lang, years, journals, edges):
    """Abstracts and word counts per (year, length bin). journals=None means every journal and
    edges=None puts every abstract in one bin."""
    sizes, counts = Counter(), defaultdict(Counter)
    for year in years:
        for r in groups[lang, year]:
            if journals is None or r["journal"] in journals:
                cell = (year, bisect_right(edges, len(r["words"])) if edges else 0)
                sizes[cell] += 1
                counts[cell].update(r["words"])
    return sizes, counts


def length_weights(sizes, years, first, second):
    """Length bins present in every one of `years`, each weighted by its share of the baseline."""
    bins = [b for b in sorted({b for _, b in sizes}) if all(sizes[y, b] for y in years)]
    reference = sum(sizes[y, b] for y in (first, second) for b in bins)
    return {b: (sizes[first, b] + sizes[second, b]) / reference for b in bins}


def standardized(word, year, sizes, counts, weights):
    """Share of `year`'s abstracts containing `word` had their lengths followed `weights` (a share
    per length bin), and the binomial variance of that share."""
    share = variance = 0.0
    for cell_bin, weight in weights.items():
        size = sizes[year, cell_bin]
        frequency = counts[year, cell_bin][word] / size
        share += weight * frequency
        variance += weight * weight * frequency * (1 - frequency) / size
    return share, variance


def excess_stats(word, sizes, counts, weights, year, first, second, factor):
    """Kobak et al.'s counterfactual q, gap and ratio for one word, and a z score for the gap.

    Frequencies are standardized to the length distribution of the baseline years: abstracts got
    longer after 2022, and a longer abstract contains any given word more often. Smoothing is
    Kobak et al.'s (a+1)/(b+1), applied to the standardized count.

    The z score takes the binomial noise of the target year and of the two baseline years, which
    the extrapolation multiplies. Kobak et al. need no test with a million abstracts a year; with
    about ten thousand, rare words would otherwise pass the thresholds by chance.
    """
    shares, variances = {}, {}
    for y in (year, first, second):
        total = sum(sizes[y, cell_bin] for cell_bin in weights)
        share, variances[y] = standardized(word, y, sizes, counts, weights)
        shares[y] = (share * total + 1) / (total + 1)
    p, p1, p2 = shares[year], shares[first], shares[second]
    slope = p2 - p1
    q = p2 + factor * max(slope, 0)
    v1, v2 = variances[first], variances[second]
    var_q = (1 + factor) ** 2 * v2 + factor ** 2 * v1 if slope > 0 else v2
    count = sum(counts[year, cell_bin][word] for cell_bin in weights)
    return {"word": word, "count": count, "p": p, "q": q, "gap": p - q, "ratio": p / q,
            "z": (p - q) / math.sqrt(max(variances[year] + var_q, 1e-12))}


def passes_thresholds(row):
    """Kobak et al.'s thresholds: a gap above 0.01, or a ratio that must be larger for rarer words
    (2 at a frequency of 1e-4, 1.41 at 1e-2)."""
    return row["gap"] > 0.01 or math.log10(row["ratio"]) > -math.log10(2) / 4 * math.log10(row["p"])


def adjust(pvalues):
    """Benjamini-Hochberg adjusted p-values, in the input order."""
    order = sorted(range(len(pvalues)), key=lambda i: pvalues[i])
    adjusted, running = [0.0] * len(pvalues), 1.0
    for rank in range(len(order), 0, -1):
        index = order[rank - 1]
        running = min(running, pvalues[index] * len(order) / rank)
        adjusted[index] = running
    return adjusted


def spread(groups, lang, year, journals, found):
    """How many journals use each excess word in `year`, and the share of the one using it most."""
    wanted = {row["word"] for row in found}
    by_word = defaultdict(Counter)
    for r in groups[lang, year]:
        if journals is None or r["journal"] in journals:
            for word in wanted.intersection(r["words"]):
                by_word[word][r["journal"]] += 1
    for row in found:
        row["journals"] = len(by_word[row["word"]])
        row["top_journal_share"] = max(by_word[row["word"]].values()) / row["count"]
        row["widespread"] = row["journals"] >= MIN_JOURNALS and row["top_journal_share"] <= MAX_SHARE


def update_universe(lang, words):
    """Add excess words to the list of words to label (analysis/labels/words-<lang>.txt)."""
    path = LABELS / f"words-{lang}.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    known = set(path.read_text(encoding="utf-8").split()) if path.exists() else set()
    known |= words
    path.write_text("\n".join(sorted(known)) + "\n", encoding="utf-8")
    return len(known)


def cmd_excess(args):
    groups = by_language_year(load_corpus(with_words=True), args.half)
    variant = (f"{args.rule}{'-full' if args.full else ''}{'-raw' if args.raw else ''}"
               f"{f'-half-{args.half}' if args.half else ''}")
    out = OUT / f"excess-{variant}"
    out.mkdir(parents=True, exist_ok=True)
    normal = NormalDist()
    found_all, summary = [], []
    for lang in LANGS:
        edges = None if args.raw else length_edges(groups, lang)
        for year in TARGETS:
            first, second, factor = baseline(year, args.rule)
            years = (first, second, year)
            journals = None if args.full else balanced_panel(groups, lang, years)
            sizes, counts = frequencies(groups, lang, years, journals, edges)
            weights = length_weights(sizes, years, first, second)
            totals = {y: sum(sizes[y, b] for b in weights) for y in years}
            in_year = Counter()
            for b in weights:
                in_year.update(counts[year, b])
            tested = [excess_stats(word, sizes, counts, weights, year, first, second, factor)
                      for word, count in in_year.items() if count >= MIN_COUNT]
            qvalues = adjust([normal.cdf(-row["z"]) for row in tested])
            found = [{"lang": lang, "year": year, **row, "qvalue": qvalue}
                     for row, qvalue in zip(tested, qvalues)
                     if qvalue < FDR and passes_thresholds(row)]
            spread(groups, lang, year, journals, found)
            found.sort(key=lambda row: -row["gap"])
            found_all += found
            widespread = sum(row["widespread"] for row in found)
            summary.append([lang, year, f"{first}-{second}", "all" if journals is None else len(journals),
                            totals[year], totals[first] + totals[second], len(tested), len(found),
                            widespread])
            log(f"{lang} {year}: {totals[year]} abstracts, {len(tested)} words tested, "
                f"{len(found)} pass, {widespread} widespread")

    fields = ["lang", "year", "word", "count", "p", "q", "gap", "ratio", "z", "qvalue", "journals",
              "top_journal_share", "widespread"]
    with (out / "excess-words.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in found_all:
            writer.writerow({k: round(v, 6) if isinstance(v, float) else v for k, v in row.items()})

    command = (f"excess --rule {args.rule}{' --full' if args.full else ''}"
               f"{' --raw' if args.raw else ''}{f' --half {args.half}' if args.half else ''}")
    lines = [f"# Excess words, {args.rule} baseline{', every journal' if args.full else ''}"
             f"{', lengths not standardized' if args.raw else ''}"
             f"{f', half {args.half} of the corpus' if args.half else ''}", "",
             f"Generated by `python3 -I scripts/excess.py {command}`. A word is tested when at "
             f"least {MIN_COUNT} abstracts of the year contain it. It passes when it clears Kobak et "
             f"al.'s thresholds and the gap is significant (Benjamini-Hochberg, FDR {FDR}), and it "
             f"counts as an excess word when it is also widespread (at least {MIN_JOURNALS} "
             f"journals, none with more than {MAX_SHARE:.0%} of its uses).", ""]
    lines += table(["lang", "year", "baseline", "journals", "abstracts", "baseline abstracts",
                    "words tested", "pass", "excess words"], summary)
    for lang in LANGS:
        for year in TARGETS:
            rows = [row for row in found_all
                    if row["lang"] == lang and row["year"] == year and row["widespread"]]
            if rows:
                top = sorted(rows, key=lambda row: -row["ratio"])[:40]
                lines += [f"**{lang} {year}**, by ratio: "
                          + ", ".join(f"{row['word']} {row['ratio']:.1f}" for row in top), ""]
    (out / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    log(f"wrote {out / 'summary.md'} and {out / 'excess-words.csv'}")
    if not args.full and not args.raw:
        for lang in LANGS:
            total = update_universe(lang, {row["word"] for row in found_all
                                           if row["lang"] == lang and row["widespread"]})
            log(f"analysis/labels/words-{lang}.txt: {total} words to label")


# --- labels -----------------------------------------------------------------------------------

def read_labels(path):
    """Word -> style, content or ambiguous, from a sheet with word and label columns."""
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as handle:
        return {row["word"]: LABEL_NAMES[row["label"].strip().lower()]
                for row in csv.DictReader(handle) if row["label"].strip().lower() in LABEL_NAMES}


def parse_labels(reply, words):
    """Labels from Claude's reply: one 'word<TAB>label' line per word, punctuation tolerated."""
    wanted, labels = set(words), {}
    for line in reply.splitlines():
        parts = re.findall(r"[^\s*`|:,;]+", line.lower())
        if len(parts) >= 2 and parts[0] in wanted and parts[-1] in ("style", "content", "ambiguous"):
            labels[parts[0]] = parts[-1]
    return labels


def cmd_label(args):
    from experiment import run_claude  # only this command needs it

    prompt = (LABELS / "prompt.txt").read_text(encoding="utf-8")
    for lang in LANGS:
        words = (LABELS / f"words-{lang}.txt").read_text(encoding="utf-8").split()
        path = LABELS / f"claude-{lang}.csv"
        done = read_labels(path)
        todo = [word for word in words if word not in done]
        new_file = not path.exists()
        with path.open("a", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            if new_file:
                writer.writerow(["word", "label", "model"])
            for start in range(0, len(todo), LABEL_BATCH):
                batch = todo[start:start + LABEL_BATCH]
                text = prompt.format(language={"pt": "Portuguese", "en": "English"}[lang])
                data = run_claude(text + "\n".join(batch) + "\n", args.model)
                model = next(iter(data.get("modelUsage") or {}), args.model)
                labels = parse_labels(data["result"], batch)
                writer.writerows([word, labels[word], model] for word in batch if word in labels)
                handle.flush()
                log(f"{lang}: {start + len(batch)}/{len(todo)} sent, {len(labels)}/{len(batch)} "
                    f"labelled ({model})")
        # The author labels a random sample blind, to measure how far Claude's labels can be trusted.
        sample_path = LABELS / f"author-{lang}.csv"
        if not sample_path.exists():
            sample = sorted(random.Random(f"{SEED}-{lang}").sample(words, min(AUTHOR_SAMPLE, len(words))))
            with sample_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["word", "label", "note"])
                writer.writerows([word, "", ""] for word in sample)
            log(f"wrote {sample_path} ({len(sample)} words for the author)")


# --- report -----------------------------------------------------------------------------------

def read_excess(variant):
    """(lang, year) -> {word: row} for the widespread excess words of one `excess` run."""
    found = defaultdict(dict)
    with (OUT / f"excess-{variant}" / "excess-words.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["widespread"] == "True":
                for key in ("p", "q", "gap", "ratio"):
                    row[key] = float(row[key])
                found[row["lang"], int(row["year"])][row["word"]] = row
    return found


def marker_gap(groups, lang, journals, edges, markers, year, first, second):
    """Kobak et al.'s gap for the share of abstracts with at least one marker word, standardized to
    the lengths of the baseline years, and its standard error. None if there is nothing to compare.

    If a share L of the abstracts went through an LLM, the share with a marker word can grow by at
    most L, so the gap is a lower bound on L.
    """
    years = (first, second, year)
    sizes, counts = Counter(), defaultdict(Counter)
    for y in years:
        for r in groups[lang, y]:
            if journals is None or r["journal"] in journals:
                cell = (y, bisect_right(edges, len(r["words"])))
                sizes[cell] += 1
                counts[cell]["*"] += not markers.isdisjoint(r["words"])
    weights = length_weights(sizes, years, first, second)
    if not weights:
        return None
    share, variance = {}, {}
    for y in years:
        share[y], variance[y] = standardized("*", y, sizes, counts, weights)
    factor = year - second
    slope = share[second] - share[first]
    expected = share[second] + factor * max(slope, 0)
    var_q = ((1 + factor) ** 2 * variance[second] + factor ** 2 * variance[first]
             if slope > 0 else variance[second])
    return {"observed": share[year], "expected": expected, "gap": share[year] - expected,
            "se": math.sqrt(variance[year] + var_q), "abstracts": sum(sizes[year, b] for b in weights)}


def choose_markers(candidates, groups, lang, journals, edges, year):
    """Kobak et al.'s rare set: the candidate words (word -> row) with a frequency below the
    threshold T that gives the largest gap on `groups`. Returns (T, markers, gap) or None."""
    best = None
    for threshold in THRESHOLDS:
        markers = {word for word, row in candidates.items() if row["p"] < threshold}
        if markers:
            result = marker_gap(groups, lang, journals, edges, markers, year, *PRE_LLM)
            if result and (best is None or result["gap"] > best[2]["gap"]):
                best = (threshold, markers, result)
    return best


def combine(results):
    """Mean of the two cross-fitted estimates, whose errors are independent (disjoint halves)."""
    results = [r for r in results if r]
    if not results:
        return None
    n = len(results)
    mean = {key: sum(r[key] for r in results) / n for key in ("observed", "expected", "gap")}
    return mean | {"se": math.sqrt(sum(r["se"] ** 2 for r in results)) / n,
                   "abstracts": sum(r["abstracts"] for r in results)}


def kappa(pairs):
    """Cohen's kappa of a list of (label, label) pairs."""
    n = len(pairs)
    observed = sum(a == b for a, b in pairs) / n
    first, second = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    expected = sum(first[c] * second[c] for c in first) / n ** 2
    return (observed - expected) / (1 - expected) if expected < 1 else 1.0


def pct(value, se=None):
    text = f"{100 * value:.1f}"
    return f"{text} ± {100 * se:.1f}" if se is not None else text


def cmd_report(args):
    records = load_corpus(with_words=True)
    full = by_language_year(records)
    halves = {half: by_language_year(records, half) for half in "ab"}
    area_journals = defaultdict(set)
    for journal in read_jsonl(RAW / "journals.jsonl"):
        for area in journal["areas"]:
            area_journals[area].add(journal["code"])
    claude = {lang: read_labels(LABELS / f"claude-{lang}.csv") for lang in LANGS}
    author = {lang: read_labels(LABELS / f"author-{lang}.csv") for lang in LANGS}
    labels = {lang: claude[lang] | author[lang] for lang in LANGS}  # the author's label wins
    runs = {variant: read_excess(variant)
            for variant in ("rolling", "fixed", "fixed-half-a", "fixed-half-b")}
    report = {"style_counts": defaultdict(dict), "agreement": {}, "bound": defaultdict(dict),
              "areas": defaultdict(lambda: defaultdict(dict)), "markers": defaultdict(dict),
              "crossfit_markers": defaultdict(dict)}
    lines = ["# Labels and lower bound", "",
             "Generated by `python3 -I scripts/excess.py report`. Labels are the author's where "
             "the author labelled a word and Claude's otherwise. Shares are percentages of "
             "abstracts, standardized to the abstract lengths of the baseline years.", ""]

    rows = []
    for lang in LANGS:
        for year in TARGETS:
            counted = Counter(labels[lang].get(word, "unlabelled")
                              for word in runs["rolling"].get((lang, year), {}))
            report["style_counts"][lang][year] = dict(counted)
            rows.append([lang, year, counted["style"], counted["content"], counted["ambiguous"],
                         counted["unlabelled"]])
    lines += ["## Excess words by label (rolling baseline)", ""]
    lines += table(["lang", "year", "style", "content", "ambiguous", "unlabelled"], rows)

    lines += ["## Agreement between the author and Claude", ""]
    rows = []
    for lang in LANGS:
        pairs = [(author[lang][word], claude[lang][word]) for word in author[lang]
                 if word in claude[lang]]
        if pairs:
            agreement = {"words": len(pairs), "agreement": sum(a == b for a, b in pairs) / len(pairs),
                         "kappa": kappa(pairs),
                         "confusion": {f"{a}/{b}": n for (a, b), n in Counter(pairs).items()}}
            report["agreement"][lang] = agreement
            rows.append([lang, len(pairs), f"{agreement['agreement']:.0%}", f"{agreement['kappa']:.2f}",
                         ", ".join(f"author {k.replace('/', ', Claude ')}: {n}"
                                   for k, n in sorted(agreement["confusion"].items()))])
    lines += table(["lang", "words", "agreement", "kappa", "author vs Claude"], rows) if rows else [
        "The author has not labelled the sample yet (analysis/labels/author-<lang>.csv).", ""]

    bound_rows, area_rows = [], []
    for lang in LANGS:
        edges = length_edges(full, lang)
        for year in BOUND_YEARS:
            panel = balanced_panel(full, lang, (*PRE_LLM, year))

            def style(found):
                return {word: row for word, row in found.items() if labels[lang].get(word) == "style"}

            picked = {half: choose_markers(style(runs[f"fixed-half-{half}"].get((lang, year), {})),
                                           halves[half], lang, panel, edges, year) for half in "ab"}

            def crossfit(journals):
                return combine([marker_gap(halves[other], lang, journals, edges, picked[half][1],
                                           year, *PRE_LLM)
                                for half, other in (("a", "b"), ("b", "a")) if picked[half]])

            same = choose_markers(style(runs["fixed"].get((lang, year), {})), full, lang, panel,
                                  edges, year)
            placebo = None
            if same:
                placebo_year = PLACEBO[1] + year - PRE_LLM[1]
                placebo = marker_gap(full, lang, balanced_panel(full, lang, (*PLACEBO, placebo_year)),
                                     edges, same[1], placebo_year, *PLACEBO)
                placebo["year"] = placebo_year
            result = {"crossfit": crossfit(panel),
                      "thresholds": {h: picked[h][0] if picked[h] else None for h in "ab"},
                      "markers": {h: len(picked[h][1]) if picked[h] else 0 for h in "ab"},
                      "same_data": same[2] | {"threshold": same[0], "markers": len(same[1])} if same else None,
                      "placebo": placebo}
            report["bound"][lang][year] = result
            # Picked on one half, so meant for abstracts of the other (scripts/pairs.py uses them).
            report["crossfit_markers"][lang][year] = {h: sorted(picked[h][1]) if picked[h] else []
                                                      for h in "ab"}
            if same:
                fixed = runs["fixed"][lang, year]
                report["markers"][lang][year] = sorted(same[1], key=lambda w: -fixed[w]["ratio"])
            cross = result["crossfit"]
            bound_rows.append([
                lang, year,
                pct(cross["gap"], cross["se"]) if cross else "-",
                pct(cross["observed"]) if cross else "-", pct(cross["expected"]) if cross else "-",
                f"{result['markers']['a']}/{result['markers']['b']}",
                pct(same[2]["gap"]) + f" ({len(same[1])} words, T={same[0]})" if same else "-",
                f"{placebo['year']}: " + pct(placebo["gap"], placebo["se"]) if placebo else "-"])
            for area in sorted(area_journals):
                estimate = crossfit(panel & area_journals[area])
                if estimate and estimate["abstracts"] >= AREA_MIN:
                    report["areas"][lang][area][year] = estimate
    lines += ["## Lower bound on the share of abstracts processed by an LLM", "",
              "Gap between the observed and the expected share of abstracts with at least one marker "
              "word (Kobak et al.), counterfactual from 2021 and 2022. Cross-fitted: the marker set "
              "(style excess words below the threshold T that maximizes the gap) is chosen on one "
              "random half of the abstracts and measured on the other, both ways. Same data: chosen "
              "and measured on all abstracts, as Kobak et al. did. Placebo: the same-data markers "
              "with the same extrapolation span, from 2015 and 2016.", ""]
    lines += table(["lang", "year", "gap, cross-fitted", "observed", "expected", "markers (a/b)",
                    "gap, same data", "placebo gap"], bound_rows)

    lines += ["## Lower bound by area (cross-fitted)", "",
              "Percent of abstracts ± standard error, and abstracts in the year (both halves). Cells "
              f"with fewer than {AREA_MIN} abstracts are left out.", ""]
    for lang in LANGS:
        for area in sorted(report["areas"][lang]):
            cells = report["areas"][lang][area]
            area_rows.append([lang, area, *(f"{pct(cells[y]['gap'], cells[y]['se'])} "
                                            f"(n={cells[y]['abstracts']})" if y in cells else "-"
                                            for y in BOUND_YEARS)])
    lines += table(["lang", "area", *BOUND_YEARS], area_rows)

    lines += ["## Marker words (same data, by ratio)", ""]
    for lang in LANGS:
        for year, words in report["markers"][lang].items():
            lines += [f"**{lang} {year}** ({len(words)}): " + ", ".join(words[:60]), ""]

    (OUT / "report.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    log(f"wrote {OUT / 'report.md'} and {OUT / 'report.json'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("prepare")
    sub.add_parser("audit")
    excess = sub.add_parser("excess")
    excess.add_argument("--rule", choices=RULES, default="rolling")
    excess.add_argument("--full", action="store_true",
                        help="every journal instead of the balanced panel (robustness check)")
    excess.add_argument("--raw", action="store_true",
                        help="plain frequencies, without the length standardization")
    excess.add_argument("--half", choices=("a", "b"),
                        help="one random half of the corpus (for the cross-fitted lower bound)")
    label = sub.add_parser("label")
    label.add_argument("--model", default="opus")
    sub.add_parser("report")
    args = parser.parse_args()
    {"prepare": cmd_prepare, "audit": cmd_audit, "excess": cmd_excess, "label": cmd_label,
     "report": cmd_report}[args.command](args)


if __name__ == "__main__":
    main()
