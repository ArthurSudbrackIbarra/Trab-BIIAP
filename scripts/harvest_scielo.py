"""Harvest SciELO Brasil metadata for the excess-vocabulary study.

Three steps, each resumable and safe to re-run:

  journals  the SciELO Brasil journal list, with ISSNs and subject areas (ArticleMeta API)
  crossref  every journal article with an abstract, 2015 to 2026, from Crossref, one file per
            journal. Crossref keeps one abstract per article, in the article's main language.
  pairs     a random sample of articles per year from ArticleMeta, which keeps the abstracts in
            every language, for comparing the Portuguese and English abstracts of the same paper

Everything is written under data/raw/. Standard library only.

    python3 -I scripts/harvest_scielo.py journals
    python3 -I scripts/harvest_scielo.py crossref
    python3 -I scripts/harvest_scielo.py pairs --per-year 1300
"""

import argparse
import gzip
import json
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
ARTICLEMETA = "https://articlemeta.scielo.org/api/v1"
CROSSREF = "https://api.crossref.org/works"
USER_AGENT = "BIIAP-study/0.1 (+https://github.com/ArthurSudbrackIbarra/Trab-BIIAP)"
FIRST_YEAR, LAST_YEAR = 2015, 2026
# Fetch order for the pairs: the years the rewriting experiment samples from, then the years
# compared with them, then the rest.
PRIORITY = (2019, 2020, 2021, 2024, 2025, 2026, 2022, 2023)
ISSN = re.compile(r"^\d{4}-\d{3}[\dX]$")
RETRYABLE = {429, 500, 502, 503, 504}


def log(message):
    print(time.strftime("%H:%M:%S"), message, flush=True)


def get_json(url, params=None, tries=7):
    """GET a JSON document, backing off on network errors, 429 and 5xx."""
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE:
                raise
            wait = int(exc.headers.get("Retry-After") or 0) or 5 * 2 ** attempt
            reason = f"HTTP {exc.code}"
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as exc:
            wait = 5 * 2 ** attempt
            reason = type(exc).__name__
        log(f"{reason}, retry {attempt + 1}/{tries} in {wait}s: {url[:110]}")
        time.sleep(wait)
    raise RuntimeError(f"giving up on {url}")


def texts(record, field):
    """Values of an ISIS-style field: [{"_": "x"}, ...] -> ["x", ...]."""
    return [item["_"] for item in record.get(field, []) if item.get("_")]


def read_jsonl(path):
    """Rows of a JSON-lines file, gzipped or not. A file cut short by an interrupted run gives the
    rows written before the cut."""
    opener = gzip.open if path.suffix == ".gz" else open
    rows = []
    try:
        with opener(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    rows.append(json.loads(line))
    except (EOFError, gzip.BadGzipFile, zlib.error, json.JSONDecodeError):
        pass
    return rows


# --- journals ---------------------------------------------------------------------------------

def fetch_journal(code):
    data = get_json(f"{ARTICLEMETA}/journal/", {"collection": "scl", "issn": code})
    record = data[0] if isinstance(data, list) else data
    # A journal's print and electronic ISSNs are spread over several fields; keep every valid one,
    # because Crossref may index the articles under either.
    issns = {code} | {value.upper() for field in ("v400", "v435", "v935")
                      for value in texts(record, field)}
    return {
        "code": code,
        "issns": sorted(issn for issn in issns if ISSN.match(issn)),
        "title": next(iter(texts(record, "v100")), None),
        "areas": texts(record, "v441"),
        "wos_areas": texts(record, "v854"),
        "status": next(iter(texts(record, "v50")), None),
    }


def cmd_journals(args):
    codes, offset = [], 0
    while True:
        page = get_json(f"{ARTICLEMETA}/journal/identifiers/",
                        {"collection": "scl", "limit": 1000, "offset": offset})
        codes += [item["code"] for item in page["objects"]]
        offset += 1000
        if offset >= page["meta"]["total"]:
            break
    log(f"{len(codes)} journals listed")
    with ThreadPoolExecutor(args.workers) as pool:
        journals = list(pool.map(fetch_journal, codes))
    RAW.mkdir(parents=True, exist_ok=True)
    with open(RAW / "journals.jsonl", "w", encoding="utf-8") as handle:
        for journal in journals:
            handle.write(json.dumps(journal, ensure_ascii=False) + "\n")
    log(f"wrote {RAW / 'journals.jsonl'}")


# --- crossref ---------------------------------------------------------------------------------

def crossref_journal(journal, path, pause):
    filters = [f"issn:{issn}" for issn in journal["issns"]] + [
        f"from-pub-date:{FIRST_YEAR}-01-01", f"until-pub-date:{LAST_YEAR}-12-31",
        "type:journal-article", "has-abstract:true"]
    params = {"filter": ",".join(filters), "rows": 1000, "cursor": "*",
              "select": "DOI,ISSN,container-title,issued,title,abstract"}
    count = 0
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        while True:
            message = get_json(CROSSREF, params)["message"]
            for item in message["items"]:
                date = ((item.get("issued") or {}).get("date-parts") or [[None]])[0]
                handle.write(json.dumps({
                    "doi": item["DOI"],
                    "journal": journal["code"],
                    "year": date[0] if date else None,
                    "date": date,
                    "title": next(iter(item.get("title") or []), None),
                    "abstract": item.get("abstract"),
                }, ensure_ascii=False) + "\n")
            count += len(message["items"])
            if not message["items"] or count >= message["total-results"]:
                return count
            params["cursor"] = message["next-cursor"]
            time.sleep(pause)


def cmd_crossref(args):
    journals = read_jsonl(RAW / "journals.jsonl")
    outdir = RAW / "crossref"
    outdir.mkdir(parents=True, exist_ok=True)
    total = 0
    for index, journal in enumerate(journals, 1):
        path = outdir / f"{journal['code']}.jsonl.gz"
        if path.exists():
            continue
        partial = path.with_name(path.name + ".part")
        try:
            count = crossref_journal(journal, partial, args.pause)
        except Exception as exc:  # noqa: BLE001  (log it; a re-run retries this journal)
            log(f"[{index}/{len(journals)}] {journal['code']} FAILED: {exc}")
            continue
        partial.rename(path)
        total += count
        log(f"[{index}/{len(journals)}] {journal['code']} {count} articles "
            f"({total} this run) {journal['title']}")
        time.sleep(args.pause)
    log("crossref done")


# --- pairs ------------------------------------------------------------------------------------

def list_pids(journal_code):
    pids, offset = [], 0
    while True:
        page = get_json(f"{ARTICLEMETA}/article/identifiers/",
                        {"collection": "scl", "issn": journal_code, "limit": 1000,
                         "offset": offset})
        pids += [item["code"] for item in page["objects"]]
        offset += 1000
        if offset >= page["meta"]["total"]:
            return pids


def extract_article(code, record):
    article = record.get("article", {})
    abstracts, titles, keywords = {}, {}, {}
    for item in article.get("v83", []):
        if item.get("l") and item.get("a"):
            abstracts.setdefault(item["l"], item["a"])
    for item in article.get("v12", []):
        if item.get("l") and item.get("_"):
            titles.setdefault(item["l"], item["_"])
    for item in article.get("v85", []):
        if item.get("l") and item.get("k"):
            keywords.setdefault(item["l"], []).append(item["k"])
    return {
        "code": code,
        "journal": code[1:10],
        "doi": record.get("doi"),
        "year": record.get("publication_year"),
        "date": record.get("publication_date"),
        "doc_type": record.get("document_type"),
        "lang": next(iter(texts(article, "v40")), None),
        "abstracts": abstracts,
        "titles": titles,
        "keywords": keywords,
        "aff_countries": sorted({item["p"] for item in article.get("v70", []) if item.get("p")}),
    }


def cmd_pairs(args):
    outdir = RAW / "articlemeta"
    outdir.mkdir(parents=True, exist_ok=True)
    pid_file = outdir / "pids.jsonl.gz"
    if not pid_file.exists():
        journals = read_jsonl(RAW / "journals.jsonl")
        with ThreadPoolExecutor(args.workers) as pool:
            listed = dict(zip((j["code"] for j in journals),
                              pool.map(list_pids, (j["code"] for j in journals))))
        with gzip.open(pid_file, "wt", encoding="utf-8") as handle:
            for journal_code, pids in listed.items():
                for pid in pids:
                    handle.write(json.dumps({"code": pid, "journal": journal_code}) + "\n")
        log(f"listed {sum(map(len, listed.values()))} article identifiers")

    # The year is part of the identifier: S + ISSN (9 characters) + year + issue + order.
    by_year = {}
    for row in read_jsonl(pid_file):
        year = row["code"][10:14]
        if year.isdigit() and FIRST_YEAR <= int(year) <= LAST_YEAR:
            by_year.setdefault(int(year), []).append(row["code"])
    rng = random.Random(args.seed)
    sample = {year: rng.sample(sorted(codes), min(args.per_year, len(codes)))
              for year, codes in sorted(by_year.items())}
    (outdir / "sample.json").write_text(json.dumps(
        {"seed": args.seed, "per_year": args.per_year,
         "available": {year: len(codes) for year, codes in sorted(by_year.items())},
         "codes": sample}, indent=1))

    out = outdir / "articles.jsonl.gz"
    done = set()
    if out.exists():
        # Copy what is there into a clean file, so new rows never land after a gzip member that an
        # interrupted run left unfinished.
        rows = read_jsonl(out)
        partial = out.with_name(out.name + ".tmp")
        with gzip.open(partial, "wt", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        partial.replace(out)
        done = {row["code"] for row in rows}
    order = sorted(sample, key=lambda year: (PRIORITY.index(year) if year in PRIORITY
                                             else len(PRIORITY), year))
    todo = [code for year in order for code in sample[year] if code not in done]
    log(f"{len(done)} already fetched, {len(todo)} to go")
    lock = threading.Lock()
    started = time.time()

    def fetch(code):
        record = get_json(f"{ARTICLEMETA}/article/",
                          {"code": code, "collection": "scl", "format": "json"})
        return extract_article(code, record) if record else {"code": code, "missing": True}

    with ThreadPoolExecutor(args.workers) as pool, gzip.open(out, "at", encoding="utf-8") as handle:
        futures = {pool.submit(fetch, code): code for code in todo}
        for index, future in enumerate(as_completed(futures), 1):
            try:
                row = future.result()
            except Exception as exc:  # noqa: BLE001  (not written, so a re-run retries it)
                log(f"{futures[future]} FAILED: {exc}")
                continue
            with lock:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            if index % 200 == 0 or index == len(todo):
                handle.flush()
                rate = index / (time.time() - started)
                log(f"{index}/{len(todo)} fetched, {rate:.1f}/s, "
                    f"about {(len(todo) - index) / rate / 60:.0f} min left")
    log("pairs done")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    journals = sub.add_parser("journals")
    journals.add_argument("--workers", type=int, default=6)
    crossref = sub.add_parser("crossref")
    crossref.add_argument("--pause", type=float, default=1.0,
                          help="seconds between Crossref requests")
    pairs = sub.add_parser("pairs")
    pairs.add_argument("--per-year", type=int, default=1300)
    pairs.add_argument("--seed", type=int, default=20261030)
    pairs.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    {"journals": cmd_journals, "crossref": cmd_crossref, "pairs": cmd_pairs}[args.command](args)


if __name__ == "__main__":
    main()
