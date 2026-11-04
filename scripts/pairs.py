"""Portuguese and English abstracts of the same papers (H2), from the ArticleMeta sample.

    prepare   clean both abstracts of every sampled paper that has one in each language and keep
              their words in data/interim/pairs.jsonl.gz
    compare   how much more the share of abstracts with a marker word rose in English than in
              Portuguese in the same papers, and how often the rewriting experiment's texts carry a
              marker word (analysis/pairs/report.md and analysis/pairs/report.json)

The filters are those of scripts/excess.py, applied to both abstracts: a paper stays only if both
have 250 to 4,000 characters, both are in the language they are filed under, neither has a second
abstract or the keywords glued on, and the paper is no errata or retraction notice.

The marker sets are those of the lower bound (`excess.py report`): for a year from 2023 on, the
style excess words below the threshold that maximizes the gap, picked on one random half of the
Crossref corpus. A paper is checked against the sets picked on the half its DOI does not fall in,
so no paper helps choose the words it is checked against. A year is used only if both languages
have at least MIN_MARKERS words in each half: a set of one or two words measures nothing.

With some 750 papers a year, extrapolating a trend from two baseline years would multiply the
noise, so the counterfactual is flat: the share in 2021-2022. The estimate is how much more that
share rose in English than in Portuguese in the same papers, a difference in differences in which
any trend the two languages share cancels out. Shares are standardized to the abstract lengths of
the baseline years (quintiles of distinct words, per language). Confidence intervals come from
resampling journals, each with all its papers of every year, so every paper keeps both of its
abstracts and the papers of one journal, which share editors, rules and fields, move together.
"""

import argparse
import gzip
import json
import random
import re
import sys
import unicodedata
from bisect import bisect_right
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from excess import (BOUND_YEARS, LANGS, MAX_CHARS, MIN_CHARS, NOTICE, PLACEBO, PRE_LLM,  # noqa: E402
                    SEED, STATUSES, TOKEN, YEARS, half_of, table)
from harvest_scielo import RAW, ROOT, log, read_jsonl  # noqa: E402
from textutil import clean_abstract, detect_language, has_inner_label  # noqa: E402

SOURCE = RAW / "articlemeta" / "articles.jsonl.gz"
PAIRS = ROOT / "data" / "interim" / "pairs.jsonl.gz"
REPORT = ROOT / "analysis" / "report.json"
EXPERIMENT = ROOT / "experiment"
OUT = ROOT / "analysis" / "pairs"
# ArticleMeta sometimes glues the label to the first word ("ResumoO texto", "AbstractThis study").
GLUED_LABEL = re.compile(r"^(?i:resumo|abstract|resumen|summary)(?=[A-ZÀ-Ý])")
MIN_MARKERS = 10  # words in each half and language for a year's marker sets to be used
LENGTH_BINS = 5  # quintiles of distinct words per abstract: about 150 papers per bin and year
WIDE_BASE = (2019, 2020, 2021, 2022)  # robustness check: a four-year baseline
BOOT = 2000  # bootstrap resamples
GROUPS = {"all": "every paper", "pt": "papers written in Portuguese",
          "en": "papers written in English"}
CARRIERS = ("both", "en only", "pt only", "neither")


# --- prepare ----------------------------------------------------------------------------------

def clean(raw):
    text = unicodedata.normalize("NFC", clean_abstract(raw, titles=False))
    return GLUED_LABEL.sub("", text).strip()


def examine_pair(row, areas, seen_doi, seen_text):
    """One sampled paper with both abstracts: its metadata, a status and, if usable, the words and
    text of each abstract."""
    texts = {lang: clean(row["abstracts"][lang]) for lang in LANGS}
    doi = row["doi"].lower()
    record = {"doi": doi, "code": row["code"], "journal": row["journal"], "year": int(row["year"]),
              "lang": row["lang"], "doc_type": row["doc_type"], "areas": areas.get(row["journal"], [])}
    if doi in seen_doi:
        status = "duplicate"
    elif record["year"] not in YEARS:
        status = "year"
    elif any(NOTICE.match(title) for title in (row.get("titles") or {}).values()):
        status = "notice"
    elif not all(MIN_CHARS <= len(text) <= MAX_CHARS for text in texts.values()):
        status = "length"
    elif any(detect_language(texts[lang]) != lang for lang in LANGS):
        status = "language"
    elif any(has_inner_label(text) for text in texts.values()):
        status = "glued"
    elif any(text in seen_text for text in texts.values()):
        status = "duplicate"
    else:
        status = "ok"
    seen_doi.add(doi)
    record["status"] = status
    if status == "ok":
        seen_text.update(texts.values())
        for lang, text in texts.items():
            record[f"words_{lang}"] = sorted(set(TOKEN.findall(text.lower())))
            record[f"text_{lang}"] = text
    return record


def cmd_prepare(args):
    areas = {}
    for journal in read_jsonl(RAW / "journals.jsonl"):
        for issn in {journal["code"], *journal["issns"]}:
            areas[issn] = journal["areas"]
    seen_doi, seen_text, statuses = set(), set(), Counter()
    PAIRS.parent.mkdir(parents=True, exist_ok=True)
    partial = PAIRS.with_name(PAIRS.name + ".part")
    with gzip.open(partial, "wt", encoding="utf-8") as handle:
        for row in read_jsonl(SOURCE):
            if all((row.get("abstracts") or {}).get(lang) for lang in LANGS):
                record = examine_pair(row, areas, seen_doi, seen_text)
                statuses[record["status"]] += 1
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    partial.replace(PAIRS)
    log(f"{sum(statuses.values())} papers with both abstracts: "
        + ", ".join(f"{s} {statuses[s]}" for s in STATUSES))


# --- compare ----------------------------------------------------------------------------------

def instruments():
    """Marker sets by name, language and the half the checked paper's DOI falls in. Name 'Y' holds
    year Y's cross-fitted sets (picked on the other half); 'Y same' holds year Y's same-data set
    (picked on the whole corpus, a robustness check). Only the years whose cross-fitted sets all
    have MIN_MARKERS words."""
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    if "crossfit_markers" not in report:
        raise SystemExit("Run `python3 -I scripts/excess.py report` first.")
    found = {}
    for year in BOUND_YEARS:
        picked = {lang: report["crossfit_markers"][lang].get(str(year)) for lang in LANGS}
        if all(sets and min(len(sets["a"]), len(sets["b"])) >= MIN_MARKERS for sets in picked.values()):
            found[str(year)] = {lang: {"a": set(picked[lang]["b"]), "b": set(picked[lang]["a"])}
                                for lang in LANGS}
            found[f"{year} same"] = {lang: dict.fromkeys("ab", set(report["markers"][lang][str(year)]))
                                     for lang in LANGS}
    return found


def has_marker(words, sets, doi):
    return not sets[half_of(doi)].isdisjoint(words)


def quantile_edges(papers, lang):
    lengths = sorted(len(p[f"words_{lang}"]) for p in papers)
    return [lengths[len(lengths) * k // LENGTH_BINS] for k in range(1, LENGTH_BINS)]


def describe(paper, insts, edges):
    """The paper's year, its length bin per language and, per instrument and language, whether that
    abstract has a marker word: the only facts about a paper the comparison needs."""
    words = {lang: set(paper[f"words_{lang}"]) for lang in LANGS}
    bins = tuple(bisect_right(edges[lang], len(words[lang])) for lang in LANGS)
    marks = tuple(int(has_marker(words[lang], insts[name][lang], paper["doi"]))
                  for name in insts for lang in LANGS)
    return paper["year"], bins, marks


def tabulate(cells, names):
    """Papers per (lang, year, length bin) and papers with a marker per (instrument, lang, year,
    length bin), from a Counter of paper descriptions."""
    papers, marked = Counter(), Counter()
    for (year, bins, marks), count in cells.items():
        for i, lang in enumerate(LANGS):
            papers[lang, year, bins[i]] += count
            for j, name in enumerate(names):
                if marks[j * len(LANGS) + i]:
                    marked[name, lang, year, bins[i]] += count
    return papers, marked


def share(counts, name, lang, years, base, standardize=True):
    """Share of the `lang` abstracts of `years` with a marker of instrument `name`. Standardized,
    each length bin weighs what it weighs among the papers of the `base` years."""
    papers, marked = counts
    total = weights = 0.0
    for bins in [[b] for b in range(LENGTH_BINS)] if standardize else [range(LENGTH_BINS)]:
        size = sum(papers[lang, y, b] for y in years for b in bins)
        weight = sum(papers[lang, y, b] for y in base for b in bins)
        if size and weight:
            total += weight * sum(marked[name, lang, y, b] for y in years for b in bins) / size
            weights += weight
    return total / weights


def without_english(cells, names, name, years):
    """Shares of the Portuguese abstracts of `years` with a marker of `name`, among the papers whose
    English abstract has no marker and among those whose English abstract has one (not
    standardized). A Portuguese marker in a paper whose English abstract has none cannot come from
    translating a marked English abstract."""
    pt, en = (names.index(name) * len(LANGS) + LANGS.index(lang) for lang in ("pt", "en"))
    papers, marked = Counter(), Counter()
    for (year, _, marks), count in cells.items():
        if year in years:
            papers[marks[en]] += count
            marked[marks[en]] += count * marks[pt]
    return {key: marked[flag] / papers[flag] if papers[flag] else 0.0
            for key, flag in (("without", 0), ("with", 1))}


def estimates(cells, names, used, event):
    """Every estimate of the comparison, by name, from a Counter of paper descriptions."""
    counts = tabulate(cells, names)
    out = {}

    def rise(name, lang, years, base=PRE_LLM, standardize=True):
        return (share(counts, name, lang, years, base, standardize)
                - share(counts, name, lang, base, base, standardize))

    def difference(name, years, base=PRE_LLM, standardize=True):
        return rise(name, "en", years, base, standardize) - rise(name, "pt", years, base, standardize)

    for year in used:
        name = str(year)
        for lang in LANGS:
            out[f"{year} {lang} base"] = share(counts, name, lang, PRE_LLM, PRE_LLM)
            out[f"{year} {lang} observed"] = share(counts, name, lang, (year,), PRE_LLM)
            out[f"{year} {lang} rise"] = out[f"{year} {lang} observed"] - out[f"{year} {lang} base"]
        out[f"{year} difference"] = out[f"{year} en rise"] - out[f"{year} pt rise"]
        # The same instrument and span, seven years earlier, as in excess.py's placebo.
        out[f"{year} placebo"] = difference(name, (PLACEBO[1] + year - PRE_LLM[1],), PLACEBO)
        out[f"{year} raw"] = difference(name, (year,), standardize=False)
        out[f"{year} wide baseline"] = difference(name, (year,), WIDE_BASE)
        out[f"{year} same-data markers"] = difference(f"{year} same", (year,))
        before, after = (without_english(cells, names, name, years) for years in (PRE_LLM, (year,)))
        for key in ("without", "with"):
            out[f"{year} pt rise {key} en marker"] = after[key] - before[key]
    sizes = {year: sum(counts[0]["en", year, b] for b in range(LENGTH_BINS)) for year in used}
    for key in ("en rise", "pt rise", "difference", "placebo", "raw", "wide baseline",
                "same-data markers", "pt rise without en marker", "pt rise with en marker"):
        out[f"pooled {key}"] = sum(sizes[y] * out[f"{y} {key}"] for y in used) / sum(sizes.values())
    for year in YEARS:
        for lang in LANGS:
            out[f"event {year} {lang} rise"] = rise(str(event), lang, (year,))
        out[f"event {year} difference"] = out[f"event {year} en rise"] - out[f"event {year} pt rise"]
    return out


def bootstrap(by_journal, names, used, event, rng):
    """Estimates on BOOT resamples of the journals, drawn with replacement, each with all its
    papers of every year (`by_journal`: a Counter of paper descriptions per journal)."""
    journals = sorted(by_journal)
    samples = defaultdict(list)
    for _ in range(BOOT):
        resampled = Counter()
        for journal in rng.choices(journals, k=len(journals)):
            resampled.update(by_journal[journal])
        for name, value in estimates(resampled, names, used, event).items():
            samples[name].append(value)
    return samples


def interval(values):
    values = sorted(values)
    return values[int(0.025 * len(values))], values[int(0.975 * len(values)) - 1]


def carriers(cells, names, name, years):
    """Shares of the papers of `years` with a marker of `name` in both abstracts, in the English
    one only, in the Portuguese one only, and in neither."""
    pt, en = (names.index(name) * len(LANGS) + LANGS.index(lang) for lang in ("pt", "en"))
    counts = Counter()
    for (year, _, marks), count in cells.items():
        if year in years:
            counts[("neither", "pt only", "en only", "both")[marks[pt] + 2 * marks[en]]] += count
    total = sum(counts.values())
    return {"papers": total} | {key: counts[key] / total for key in CARRIERS}


def experiment_rates(insts, used):
    """How often the rewriting experiment's texts carry a marker word, per model, task and year's
    marker sets: the original abstracts, the model's rewrites and, for the translations, the
    authors' own English abstracts."""
    items = {}
    for path in sorted((EXPERIMENT / "items").glob("*.jsonl")):
        items |= {item["id"]: item for item in read_jsonl(path)}
    def rate(texts, sets):
        return sum(has_marker(TOKEN.findall(unicodedata.normalize("NFC", text).lower()), sets,
                              doi.lower()) for text, doi in texts) / len(texts)

    rows = []
    for path in sorted((EXPERIMENT / "results").glob("*.jsonl")):
        by_task = defaultdict(list)
        for result in read_jsonl(path):
            by_task[result["task"]].append(result)
        for task, done in sorted(by_task.items()):
            source, target = task.split("-")[1], task.split("-")[-1]  # polish-pt, translate-pt-en
            originals = [(items[r["id"]]["input"], items[r["id"]]["doi"]) for r in done]
            rewrites = [(r["text"], items[r["id"]]["doi"]) for r in done]
            for year in used:
                sets = insts[str(year)]
                row = {"model": path.stem, "task": task, "markers": year, "texts": len(done),
                       "original": rate(originals, sets[source]), "rewrite": rate(rewrites, sets[target])}
                if task.startswith("translate"):
                    row["authors"] = rate([(items[r["id"]]["reference"], items[r["id"]]["doi"])
                                           for r in done], sets[target])
                rows.append(row)
    return rows


def pct(value):
    return f"{100 * value:.1f}"


def with_interval(value, samples):
    low, high = interval(samples)
    return f"{pct(value)} [{pct(low)}, {pct(high)}]"


def p_value(samples):
    """One-sided bootstrap p-value for a positive estimate."""
    p = sum(value <= 0 for value in samples) / len(samples)
    return f"{p:.3f}" if p else f"< {1 / len(samples):.4f}"


def cmd_compare(args):
    insts = instruments()
    names = list(insts)
    used = [int(name) for name in names if name.isdigit()]
    if not used:
        raise SystemExit(f"No year has {MIN_MARKERS} cross-fitted markers per half in both languages.")
    event = used[0]
    with gzip.open(PAIRS, "rt", encoding="utf-8") as handle:
        papers = [p for p in map(json.loads, handle) if p["status"] == "ok"]
    edges = {lang: quantile_edges(papers, lang) for lang in LANGS}
    report = {"sample": {}, "instruments": {}, "groups": {}, "experiment": []}
    lines = ["# Same papers in Portuguese and English (H2)", "",
             "Generated by `python3 -I scripts/pairs.py compare`. Percentages of papers. Rises are "
             "measured against 2021-2022, standardized to the abstract lengths of those years; "
             f"brackets hold 95% intervals from {BOOT} resamples of the journals, each with all its "
             "papers, and p is the one-sided bootstrap p-value of a larger rise in English.", ""]

    rows = []
    for year in YEARS:
        langs = Counter(p["lang"] for p in papers if p["year"] == year)
        total = sum(langs.values())
        report["sample"][year] = {"papers": total, "pt": langs["pt"], "en": langs["en"]}
        rows.append([year, total, langs["pt"], langs["en"], total - langs["pt"] - langs["en"]])
    lines += ["## Sample", "", "Usable papers with both abstracts, by the language the paper is "
              "written in. The prepare step logs the papers left out and why.", ""]
    lines += table(["year", "papers", "Portuguese", "English", "other"], rows)

    base_papers = [p for p in papers if p["year"] in PRE_LLM]
    rows = []
    for name in names:
        if name.isdigit():
            base = {lang: sum(has_marker(p[f"words_{lang}"], insts[name][lang], p["doi"])
                              for p in base_papers) / len(base_papers) for lang in LANGS}
            sizes = {lang: [len(insts[name][lang][h]) for h in "ba"] for lang in LANGS}
            report["instruments"][name] = {"words": sizes, "base_share": base}
            rows.append([name, *("/".join(map(str, sizes[lang])) for lang in ("en", "pt")),
                         pct(base["en"]), pct(base["pt"])])
    lines += ["## Marker sets", "",
              "Cross-fitted sets of the lower bound, words picked on half a / half b of the Crossref "
              "corpus, and the share of the 2021-2022 papers whose abstract has one of them (not "
              f"standardized). Only years where every set has at least {MIN_MARKERS} words; the "
              "others have Portuguese sets of at most one word.", ""]
    lines += table(["year", "English words", "Portuguese words", "English 2021-22",
                    "Portuguese 2021-22"], rows)

    main_rows, carrier_rows, event_rows, robust_rows, inherit_rows = [], [], [], [], []
    for group, label in GROUPS.items():
        chosen = [p for p in papers if group == "all" or p["lang"] == group]
        by_journal = defaultdict(Counter)
        for p in chosen:
            by_journal[p["journal"]][describe(p, insts, edges)] += 1
        cells = sum(by_journal.values(), Counter())
        point = estimates(cells, names, used, event)
        log(f"{group}: {len(chosen)} papers in {len(by_journal)} journals, bootstrapping")
        samples = bootstrap(by_journal, names, used, event, random.Random(f"{SEED}-pairs-{group}"))
        result = {"label": label, "papers": len(chosen), "journals": len(by_journal),
                  "estimates": {key: {"value": value, "interval": interval(samples[key]),
                                      "p": sum(v <= 0 for v in samples[key]) / BOOT}
                                for key, value in point.items()},
                  "carriers": {year: {"2021-2022": carriers(cells, names, str(year), PRE_LLM),
                                      year: carriers(cells, names, str(year), (year,))}
                               for year in used}}
        report["groups"][group] = result

        def cell(key):
            return with_interval(point[key], samples[key])

        for period in [*used, "pooled"]:
            shares = {lang: "" if period == "pooled" else
                      f"{pct(point[f'{period} {lang} base'])} → {pct(point[f'{period} {lang} observed'])}"
                      for lang in LANGS}
            main_rows.append([label, f"{used[0]}-{used[-1]}" if period == "pooled" else period,
                              shares["en"], cell(f"{period} en rise"), shares["pt"],
                              cell(f"{period} pt rise"), cell(f"{period} difference"),
                              p_value(samples[f"{period} difference"]), cell(f"{period} placebo")])
        for year, periods in result["carriers"].items():
            for period, counted in periods.items():
                carrier_rows.append([label, year, period, counted["papers"],
                                     *(pct(counted[key]) for key in CARRIERS)])
        for year in YEARS:
            event_rows.append([label, year, cell(f"event {year} en rise"),
                               cell(f"event {year} pt rise"), cell(f"event {year} difference")])
        robust_rows.append([label, *(cell(f"pooled {key}") for key in
                                     ("difference", "raw", "wide baseline", "same-data markers"))])
        for period in [*used, "pooled"]:
            inherit_rows.append([label, f"{used[0]}-{used[-1]}" if period == "pooled" else period,
                                 cell(f"{period} pt rise without en marker"),
                                 cell(f"{period} pt rise with en marker")])

    lines += ["## Rise in each language, same papers", "",
              "Share of English abstracts with an English marker word and of Portuguese abstracts "
              "with a Portuguese one, in 2021-2022 and in the year, with that year's marker sets; "
              "the rise is the change in points, and the difference is how much more the English "
              f"share rose. Pooled: the years averaged by papers. Placebo: the same sets and span, "
              f"from {PLACEBO[0]}-{PLACEBO[1]} to {PLACEBO[1] + used[0] - PRE_LLM[1]} and later.", ""]
    lines += table(["papers", "year", "English share", "English rise", "Portuguese share",
                    "Portuguese rise", "difference", "p", "placebo difference"], main_rows)
    lines += ["## Which abstract carries the markers", "",
              "Shares of papers with a marker word in both abstracts, in the English one only, in the "
              "Portuguese one only, or in neither (not standardized), with each year's marker sets "
              "in 2021-2022 and in that year.", ""]
    lines += table(["papers", "markers", "period", "n", "both", "English only", "Portuguese only",
                    "neither"], carrier_rows)
    lines += ["## Portuguese markers where the English abstract has none", "",
              "Rise from 2021-2022 in the share of Portuguese abstracts with a Portuguese marker word, "
              "among the papers whose English abstract has no English marker and among those whose "
              "English abstract has one (not standardized), with each year's marker sets. A marker in "
              "the Portuguese abstract of a paper whose English abstract has none cannot come from "
              "translating a marked English abstract.", ""]
    lines += table(["papers", "year", "without an English marker", "with an English marker"],
                   inherit_rows)
    lines += [f"## Year by year with the {event} sets", "",
              f"The {event} marker sets applied to every year: rise over 2021-2022 in each language "
              "and the difference. Before 2023 the difference should stay near zero.", ""]
    lines += table(["papers", "year", "English rise", "Portuguese rise", "difference"], event_rows)
    lines += ["## Robustness of the pooled difference", "",
              "Main estimate; without the length standardization; with 2019-2022 as the baseline; "
              "with the same-data marker sets, which were picked on all of Crossref, these papers "
              "included.", ""]
    lines += table(["papers", "main", "raw shares", "baseline 2019-2022", "same-data markers"],
                   robust_rows)

    report["experiment"] = experiment_rates(insts, used)
    rows = [[r["model"], r["task"], r["markers"], r["texts"], pct(r["original"]), pct(r["rewrite"]),
             pct(r["authors"]) if "authors" in r else "-"] for r in report["experiment"]]
    lines += ["## Marker words in the rewriting experiment", "",
              "Share of texts with a marker word of the year's sets (cross-fitted by DOI): the "
              "original abstracts (2019-2021), the model's rewrite or translation and, for the "
              "translations, the authors' own English abstract.", ""]
    lines += table(["model", "task", "markers", "texts", "original", "model", "authors' English"],
                   rows) if rows else ["No model results yet (experiment/results/).", ""]

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "report.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    log(f"wrote {OUT / 'report.md'} and {OUT / 'report.json'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("prepare")
    sub.add_parser("compare")
    args = parser.parse_args()
    {"prepare": cmd_prepare, "compare": cmd_compare}[args.command](args)


if __name__ == "__main__":
    main()
