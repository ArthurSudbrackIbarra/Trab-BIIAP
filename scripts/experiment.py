"""Rewriting experiment behind the Máquina do tempo: what do chatbots change in an abstract?

Abstracts published before ChatGPT (2019 to 2021) go to ChatGPT, Gemini and Claude in identical
batches of ten, with one plain request per task: improve the writing in Portuguese, improve it in
English, or translate Portuguese into English. The prompt asks for a code block in a fixed format,
so replies pasted from the chat apps can be parsed here without any API key.

    build     sample the abstracts and write the batch files to experiment/batches/
    claude    send the pending batches to Claude through `claude -p` (Max plan, no API key)
    ingest    parse the replies in experiment/inbox/, check them, write experiment/results/ and
              retry batches for anything missing or broken
    analyze   which words each model adds and how many are SciELO markers
              (analysis/experiment/report.md and report.json)

Step-by-step instructions for the author are in experiment/README.md.
"""

import argparse
import json
import random
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harvest_scielo import RAW, ROOT, read_jsonl  # noqa: E402
from textutil import clean_abstract, detect_language, has_inner_label, word_count  # noqa: E402

EXP = ROOT / "experiment"
MODELS = ("chatgpt", "gemini", "claude")
YEARS = range(2019, 2022)
MIN_WORDS, MAX_WORDS = 120, 320
BATCH_SIZE = 10
MAX_PER_JOURNAL = 2
TASKS = {
    "polish-pt": {"prefix": "pt", "source": "crossref", "lang": "pt", "reply_lang": "pt"},
    "polish-en": {"prefix": "en", "source": "crossref", "lang": "en", "reply_lang": "en"},
    "translate-pt-en": {"prefix": "tr", "source": "articlemeta", "lang": "pt", "reply_lang": "en"},
}
BROKEN = {"empty", "language", "unchanged"}
CLAUDE_SYSTEM = "You are Claude, a helpful AI assistant."
MIN_SHIFT = 4  # texts a word must gain (lose) to count as added (dropped): 5% of a task
TOP_WORDS = 15
LATEX_COMMAND = re.compile(r"\\[A-Za-z]+")
BOOT = 2000  # bootstrap resamples

FENCED = re.compile(r"```[^\n]*\n(.*?)```", re.S)
ITEM_LINE = re.compile(r"^[ \t]*(?:#{1,4}[ \t]*)?\**[ \t]*((?:pt|en|tr)-\d{3})[ \t]*\**[ \t]*:?[ \t]*$",
                       re.M)
BATCH_LINE = re.compile(r"^[ \t]*={2,}[ \t]*([\w.-]+)[ \t]*={2,}[ \t]*$", re.M)
LABEL_LINE = re.compile(r"^#[ \t]*(?:modelo|model)[ \t]*:[ \t]*(.+)$", re.M | re.I)


# --- sampling ---------------------------------------------------------------------------------

def crossref_candidates(lang, allow_partial):
    journals = read_jsonl(RAW / "journals.jsonl")
    files = sorted((RAW / "crossref").glob("*.jsonl.gz"))
    if len(files) < len(journals) and not allow_partial:
        raise SystemExit(f"Crossref harvest incomplete ({len(files)}/{len(journals)} journals).")
    areas = {journal["code"]: journal["areas"][0] for journal in journals}
    for path in files:
        for row in read_jsonl(path):
            if row["year"] not in YEARS:
                continue
            text = clean_abstract(row["abstract"])
            if (detect_language(text) == lang and not has_inner_label(text)
                    and MIN_WORDS <= word_count(text) <= MAX_WORDS):
                yield {"doi": row["doi"].lower(), "journal": row["journal"],
                       "area": areas[row["journal"]], "year": row["year"], "input": text}


def articlemeta_candidates(allow_partial):
    """Portuguese-language articles with both abstracts; the authors' English one is the reference."""
    sample = json.loads((RAW / "articlemeta" / "sample.json").read_text())
    wanted = {code for year in YEARS for code in sample["codes"].get(str(year), [])}
    rows = [row for row in read_jsonl(RAW / "articlemeta" / "articles.jsonl.gz")
            if row["code"] in wanted]
    if len(rows) < len(wanted) and not allow_partial:
        raise SystemExit(f"ArticleMeta sample for {YEARS[0]}-{YEARS[-1]} incomplete "
                         f"({len(rows)}/{len(wanted)} articles).")
    areas = {journal["code"]: journal["areas"][0] for journal in read_jsonl(RAW / "journals.jsonl")}
    for row in rows:
        if row.get("missing") or row.get("lang") != "pt":
            continue
        pt = clean_abstract(row["abstracts"].get("pt"))
        en = clean_abstract(row["abstracts"].get("en"))
        if (detect_language(pt) == "pt" and detect_language(en) == "en"
                and not has_inner_label(pt) and not has_inner_label(en)
                and MIN_WORDS <= word_count(pt) <= MAX_WORDS):
            yield {"doi": (row["doi"] or row["code"]).lower(), "code": row["code"],
                   "journal": row["journal"], "area": areas.get(row["journal"], "?"),
                   "year": int(row["year"] or row["code"][10:14]), "input": pt, "reference": en}


def pick(candidates, per_area, rng, taken):
    """Up to per_area abstracts per SciELO area, at most two per journal, no DOI used elsewhere."""
    pool, seen = [], set()
    for candidate in sorted(candidates, key=lambda c: c["doi"]):
        if candidate["doi"] not in taken and candidate["input"] not in seen:
            pool.append(candidate)
            seen.add(candidate["input"])
    rng.shuffle(pool)
    chosen, used = [], set()
    per_area_count, per_journal = Counter(), Counter()
    # Areas with few journals in a language fill up in a second pass that allows more per journal.
    for cap in (MAX_PER_JOURNAL, per_area):
        for index, candidate in enumerate(pool):
            if (index not in used and per_area_count[candidate["area"]] < per_area
                    and per_journal[candidate["journal"]] < cap):
                chosen.append(candidate)
                used.add(index)
                per_area_count[candidate["area"]] += 1
                per_journal[candidate["journal"]] += 1
    rng.shuffle(chosen)
    return chosen, per_area_count


# --- batch files ------------------------------------------------------------------------------

def batch_text(task, batch, items):
    prompt = (EXP / "prompts" / f"{task}.txt").read_text(encoding="utf-8").strip()
    prompt = prompt.format(batch=batch, example=items[0]["id"])
    body = "\n\n".join(f"### {item['id']}\n{item['input']}" for item in items)
    return f"{prompt}\n\n=== {batch} ===\n\n{body}\n"


def load_items(tasks=TASKS):
    items = {}
    for task in tasks:
        path = EXP / "items" / f"{task}.jsonl"
        if path.exists():
            items.update((item["id"], item) for item in read_jsonl(path))
    return items


def inbox_files(model):
    folder = EXP / "inbox" / model
    return sorted(folder.glob("*.txt"), key=lambda path: path.stat().st_mtime) if folder.exists() else []


def batch_files(model=None):
    """Batches in the order they should be sent; retry batches for `model` come last."""
    paths = [path for task in TASKS for path in sorted((EXP / "batches" / task).glob("*.txt"))]
    if model:
        paths += sorted((EXP / "batches" / "retry" / model).glob("*.txt"))
    return paths


def cmd_build(args):
    tasks = list(TASKS) if args.task == "all" else [args.task]
    taken = {item["doi"] for item in load_items([t for t in TASKS if t not in tasks]).values()}
    for task in tasks:
        if any(f"=== {task}-" in path.read_text(encoding="utf-8", errors="replace")
               for model in MODELS for path in inbox_files(model)) and not args.force:
            raise SystemExit(f"{task}: there are replies in experiment/inbox/ already. "
                             "Rebuilding would change the abstracts; use --force to do it anyway.")
        spec = TASKS[task]
        rng = random.Random(f"{args.seed}-{task}")
        candidates = (crossref_candidates(spec["lang"], args.allow_partial)
                      if spec["source"] == "crossref" else articlemeta_candidates(args.allow_partial))
        chosen, per_area = pick(candidates, args.per_area, rng, taken)
        taken |= {candidate["doi"] for candidate in chosen}

        items = []
        for number, candidate in enumerate(chosen, 1):
            batch = f"{task}-{(number - 1) // BATCH_SIZE + 1:02d}"
            items.append({"id": f"{spec['prefix']}-{number:03d}", "task": task, "batch": batch,
                          **candidate, "words": word_count(candidate["input"])})
        (EXP / "items").mkdir(parents=True, exist_ok=True)
        with open(EXP / "items" / f"{task}.jsonl", "w", encoding="utf-8") as handle:
            for item in items:
                handle.write(json.dumps(item, ensure_ascii=False) + "\n")
        outdir = EXP / "batches" / task
        outdir.mkdir(parents=True, exist_ok=True)
        for old in outdir.glob("*.txt"):
            old.unlink()
        batches = sorted({item["batch"] for item in items})
        for batch in batches:
            group = [item for item in items if item["batch"] == batch]
            (outdir / f"{batch}.txt").write_text(batch_text(task, batch, group), encoding="utf-8")
        print(f"{task}: {len(items)} abstracts in {len(batches)} batches; per area: "
              + ", ".join(f"{area} {count}" for area, count in sorted(per_area.items())))


# --- replies ----------------------------------------------------------------------------------

def parse_reply(text):
    """{item id: text} from pasted replies. When there are code blocks, only their content counts."""
    if text.count("```") % 2:
        text += "\n```"
    blocks = FENCED.findall(text)
    if blocks:
        text = "\n".join(blocks)
    text = LABEL_LINE.sub("", BATCH_LINE.sub("", text))
    marks = list(ITEM_LINE.finditer(text))
    found = {}
    for mark, following in zip(marks, marks[1:] + [None]):
        found[mark.group(1)] = text[mark.end():following.start() if following else None].strip()
    return found


def check(item, text):
    if not text:
        return ["empty"]
    flags = []
    ratio = word_count(text) / item["words"]
    if not 0.5 <= ratio <= 2.0:
        flags.append(f"length x{ratio:.2f}")
    if detect_language(text) != TASKS[item["task"]]["reply_lang"]:
        flags.append("language")
    if " ".join(text.split()) == " ".join(item["input"].split()):
        flags.append("unchanged")
    if re.search(r"^\W*(nota|note|obs|altera|mudan|change)\w*\s*:", text, re.I | re.M):
        flags.append("comment")
    return flags


def write_retry_batches(model, todo):
    outdir = EXP / "batches" / "retry" / model
    for old in outdir.glob("*.txt"):
        old.unlink()
    stamp = time.strftime("%m%d%H%M")
    written = []
    for task in TASKS:
        task_items = [item for item in todo if item["task"] == task]
        for start in range(0, len(task_items), BATCH_SIZE):
            batch = f"{task}-retry{stamp}-{start // BATCH_SIZE + 1:02d}"
            outdir.mkdir(parents=True, exist_ok=True)
            group = task_items[start:start + BATCH_SIZE]
            (outdir / f"{batch}.txt").write_text(batch_text(task, batch, group), encoding="utf-8")
            written.append(batch)
    return written


def cmd_ingest(args):
    items = load_items()
    if not items:
        raise SystemExit("No batches yet: run the build step first.")
    (EXP / "results").mkdir(parents=True, exist_ok=True)
    lines = ["| modelo | tarefa | recebidos | com aviso | faltando nos lotes enviados | "
             "lotes não enviados |", "|---|---|---|---|---|---|"]
    for model in MODELS:
        replies, sent = {}, set()
        for path in inbox_files(model):
            raw = path.read_text(encoding="utf-8", errors="replace")
            sent |= set(BATCH_LINE.findall(raw))
            labels = LABEL_LINE.findall(raw)
            for item_id, text in parse_reply(raw).items():
                if item_id in items:
                    replies[item_id] = {"text": text, "file": path.name,
                                        "model_label": labels[-1].strip() if labels else None}
        rows = []
        for item_id in sorted(replies):
            reply = replies[item_id]
            rows.append({"id": item_id, "task": items[item_id]["task"],
                         "batch": items[item_id]["batch"], "model": model,
                         "model_label": reply["model_label"], "file": reply["file"],
                         "text": reply["text"], "words": word_count(reply["text"]),
                         "flags": check(items[item_id], reply["text"])})
        with open(EXP / "results" / f"{model}.jsonl", "w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        # Only batches already sent can have missing items; the rest are simply not sent yet.
        sent |= {row["batch"] for row in rows}
        broken = {row["id"] for row in rows if BROKEN & set(row["flags"])}
        todo = [item for item_id, item in sorted(items.items())
                if item["batch"] in sent and (item_id not in replies or item_id in broken)]
        retries = write_retry_batches(model, todo)
        for task in TASKS:
            task_items = [item for item in items.values() if item["task"] == task]
            if not task_items:
                continue
            got = [row for row in rows if row["task"] == task]
            warned = sum(1 for row in got if row["flags"])
            lacking = sum(1 for item in todo if item["task"] == task)
            unsent = len({item["batch"] for item in task_items} - sent)
            lines.append(f"| {model} | {task} | {len(got)}/{len(task_items)} | {warned} | "
                         f"{lacking} | {unsent} |")
        if retries:
            lines.append(f"| {model} | repescagem | {len(retries)} lotes em "
                         f"`experiment/batches/retry/{model}/` | | | |")
    report = "\n".join(lines)
    (EXP / "results" / "status.md").write_text(report + "\n", encoding="utf-8")
    print(report)


# --- analysis ---------------------------------------------------------------------------------

def cmd_analyze(args):
    from crosslang import fisher_greater, marker_words  # the corpus analysis loads only here
    from excess import TOKEN, table

    def words_of(text):
        # Gemini writes some notation as LaTeX ($q\text{CO}_2$): its commands are not words.
        text = LATEX_COMMAND.sub(" ", unicodedata.normalize("NFC", text))
        return set(TOKEN.findall(text.lower()))

    items = load_items()
    markers = {lang: set(marker_words(lang)) for lang in ("pt", "en")}
    rng = random.Random("20261030-analyze")
    report, rows, lists, added_markers = {}, [], [], {}
    for model in MODELS:
        path = EXP / "results" / f"{model}.jsonl"
        results = list(read_jsonl(path)) if path.exists() else []
        for task in TASKS:
            done = [r for r in results if r["task"] == task]
            if not done:
                continue
            lang = TASKS[task]["reply_lang"]
            # A translation is compared with the authors' own English, a rewrite with the original.
            field = "reference" if task.startswith("translate") else "input"
            pairs = [(words_of(items[r["id"]][field]), words_of(r["text"])) for r in done]
            before, after = Counter(), Counter()
            for old, new in pairs:
                before.update(old)
                after.update(new)
            change = [len(new & markers[lang]) - len(old & markers[lang]) for old, new in pairs]
            resampled = sorted(sum(rng.choices(change, k=len(change))) / len(change)
                               for _ in range(BOOT))
            shift = {word: after[word] - before[word] for word in sorted(set(before) | set(after))
                     if max(before[word], after[word]) >= MIN_SHIFT}
            added = {word for word, value in shift.items() if value >= MIN_SHIFT}
            dropped = {word for word, value in shift.items() if value <= -MIN_SHIFT}
            a, c = len(added & markers[lang]), len(dropped & markers[lang])
            ratios = sorted(r["words"] / int(items[r["id"]]["words"]) for r in done)
            result = {
                "label": done[0]["model_label"], "texts": len(done),
                "length_ratio": ratios[len(ratios) // 2],
                "markers_before": sum(len(old & markers[lang]) for old, _ in pairs) / len(pairs),
                "markers_after": sum(len(new & markers[lang]) for _, new in pairs) / len(pairs),
                "change": sum(change) / len(change),
                "interval": (resampled[int(0.025 * BOOT)], resampled[int(0.975 * BOOT) - 1]),
                "added": sorted(added, key=lambda w: (-shift[w], w)),
                "dropped": sorted(dropped, key=lambda w: (shift[w], w)),
                "shift": shift, "added_markers": a, "dropped_markers": c,
                "p": fisher_greater(a, len(added) - a, c, len(dropped) - c)}
            report.setdefault(model, {})[task] = result
            for word in added & markers[lang]:
                added_markers.setdefault(task, {}).setdefault(word, []).append(model)
            rows.append([f"{model} ({result['label']})", task, result["texts"],
                         f"{result['length_ratio']:.2f}",
                         f"{result['markers_before']:.2f} → {result['markers_after']:.2f}",
                         f"{result['change']:+.2f} [{result['interval'][0]:+.2f}, "
                         f"{result['interval'][1]:+.2f}]",
                         f"{a}/{len(added)}", f"{c}/{len(dropped)}", f"{result['p']:.1e}"])
            lists += [f"**{model}, {task}**: " + ", ".join(
                f"{w}{'*' if w in markers[lang] else ''} (+{shift[w]})"
                for w in result["added"][:TOP_WORDS]), ""]

    lines = ["# What the chatbots change in an abstract", "",
             "Generated by `python3 -I scripts/experiment.py analyze`. SciELO markers are the excess "
             "style words of 2024-2026 (`scripts/crosslang.py`, 349 Portuguese and 437 English). A "
             "rewrite is compared with the original abstract and a translation with the authors' own "
             f"English. A word counts as added (dropped) when it appears in at least {MIN_SHIFT} more "
             f"(fewer) of the 80 texts after the model's pass. Brackets: 95% intervals from {BOOT} "
             "resamples of texts. p: Fisher's exact test, one-sided, for markers being more common "
             "among the added words than among the dropped ones. Length: median ratio of words, "
             "model's text to original.", ""]
    lines += table(["model", "task", "texts", "length", "markers per text", "change",
                    "markers among added", "markers among dropped", "p"], rows)
    lines += ["## Words each model adds most", "",
              f"Top {TOP_WORDS} by the number of texts gained; * marks a SciELO marker.", "", *lists]
    lines += ["## Markers that more than one model adds", ""]
    for task, models in added_markers.items():
        shared = sorted((w for w in models if len(models[w]) > 1), key=lambda w: (-len(models[w]), w))
        report.setdefault("shared", {})[task] = {w: models[w] for w in shared}
        lines += [f"**{task}** ({len(shared)}): " + (", ".join(
            f"{w} ({', '.join(models[w])})" for w in shared) or "none"), ""]
    out = ROOT / "analysis" / "experiment"
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out / 'report.md'}")


# --- claude -----------------------------------------------------------------------------------

def run_claude(text, model):
    # An empty working directory keeps this project's CLAUDE.md and memory out of the context.
    with tempfile.TemporaryDirectory(prefix="biiap-claude-") as workdir:
        result = subprocess.run(
            ["claude", "-p", "--model", model, "--output-format", "json",
             "--system-prompt", CLAUDE_SYSTEM, "--tools", "", "--strict-mcp-config",
             "--no-session-persistence", "--setting-sources", "local"],
            input=text, capture_output=True, text=True, cwd=workdir, timeout=1800)
    data = json.loads(result.stdout)
    if data.get("is_error"):
        raise RuntimeError(data.get("result") or result.stderr[:300])
    return data


def cmd_claude(args):
    inbox = EXP / "inbox" / "claude"
    inbox.mkdir(parents=True, exist_ok=True)
    pending = [path for path in batch_files("claude") if not (inbox / path.name).exists()]
    if args.limit:
        pending = pending[:args.limit]
    print(f"{len(pending)} batches to send to Claude ({args.model})", flush=True)
    for number, path in enumerate(pending, 1):
        text = path.read_text(encoding="utf-8")
        started = time.time()
        try:
            data = run_claude(text, args.model)
        except Exception as exc:  # noqa: BLE001  (no reply file, so the next run retries it)
            print(f"[{number}/{len(pending)}] {path.stem} FAILED: {exc}", flush=True)
            continue
        model_id = next(iter(data.get("modelUsage") or {}), args.model)
        (inbox / path.name).write_text(
            f"# modelo: {model_id} (claude -p, sem ferramentas)\n# data: {date.today()}\n\n"
            + data["result"] + "\n", encoding="utf-8")
        expected, got = parse_reply(text), parse_reply(data["result"])
        with open(inbox / "runs.jsonl", "a", encoding="utf-8") as handle:
            handle.write(json.dumps({
                "batch": path.stem, "model": model_id, "date": str(date.today()),
                "seconds": round(time.time() - started, 1), "usage": data.get("usage"),
                "received": len(got.keys() & expected.keys()), "expected": len(expected)}) + "\n")
        print(f"[{number}/{len(pending)}] {path.stem}: {len(got.keys() & expected.keys())}/"
              f"{len(expected)} abstracts, {time.time() - started:.0f}s", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build")
    build.add_argument("--task", choices=["all", *TASKS], default="all")
    build.add_argument("--per-area", type=int, default=10)
    build.add_argument("--seed", default="20261030")
    build.add_argument("--allow-partial", action="store_true",
                       help="sample even if the harvest has not finished (for testing)")
    build.add_argument("--force", action="store_true",
                       help="rebuild even if replies to these batches exist")
    claude = sub.add_parser("claude")
    claude.add_argument("--model", default="sonnet")
    claude.add_argument("--limit", type=int, default=0, help="send at most this many batches")
    sub.add_parser("ingest")
    sub.add_parser("analyze")
    args = parser.parse_args()
    {"build": cmd_build, "claude": cmd_claude, "ingest": cmd_ingest,
     "analyze": cmd_analyze}[args.command](args)


if __name__ == "__main__":
    main()
