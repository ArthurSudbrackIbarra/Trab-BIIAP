"""The check step: run every data module's own check() and compare the home page's numbers
(dados/inicio.json) with the analysis outputs they come from. Prints each problem and exits with
status 1 if there is any.

Modules that do not exist yet are skipped, so the step can run while the site is being built.
"""

import csv
import importlib
import json
import re
import sys
import traceback
from collections import Counter, defaultdict

from excess import BOUND_YEARS, LABELS, TARGETS, load_corpus, read_excess
from experiment import EXP, TASKS, load_items
from site_data.comum import LANGS, OUT, RAW, REPORT, SITE, YEARS, log

MODULES = ("meta", "palavras", "mapa", "areas", "pares", "raiox", "experimento", "inicio")
PAIRS_REPORT = OUT / "pairs" / "report.json"
EXPERIMENT_REPORT = OUT / "experiment" / "report.json"
CROSS_REPORT = OUT / "crosslang" / "report.json"
COVERAGE = OUT / "coverage.md"


def load(name):
    """The site_data module `name`, or None when it does not exist yet."""
    try:
        return importlib.import_module(f"site_data.{name}")
    except ModuleNotFoundError as exc:
        if exc.name == f"site_data.{name}":
            return None
        raise


def module_problems():
    """Problems reported by each module's check(), prefixed with the module's name. A check that
    fails with an error counts as a problem, so the other checks still run."""
    problems = []
    for name in MODULES:
        module = load(name)
        if module is None:
            log(f"{name}: no module yet, skipped")
            continue
        if not hasattr(module, "check"):
            log(f"{name}: no check()")
            continue
        try:
            found = module.check()
        except Exception as exc:  # noqa: BLE001
            where = traceback.extract_tb(exc.__traceback__)[-1]
            found = [f"check() failed: {exc!r} ({where.filename.rsplit('/', 1)[-1]}:{where.lineno})"]
        log(f"{name}: {len(found)} problem(s)")
        problems += [f"{name}: {problem}" for problem in found]
    return problems


def coverage_rows(heading):
    """The rows of one table of analysis/coverage.md, as dicts by column."""
    text = COVERAGE.read_text(encoding="utf-8")
    section = text.split(f"## {heading}", 1)[1].split("\n## ", 1)[0]
    lines = [line for line in section.splitlines() if line.startswith("|")]
    header = [cell.strip() for cell in lines[0].strip("|").split("|")]
    return [dict(zip(header, (cell.strip() for cell in line.strip("|").split("|"))))
            for line in lines[2:]]


def coverage_tables():
    """From analysis/coverage.md: usable abstracts per (year, language) and in total."""
    by_language = {(int(row["year"]), lang): int(row[lang])
                   for row in coverage_rows("Usable abstracts by year and language")
                   for lang in (*LANGS, "es")}
    total = sum(int(row["ok"]) for row in coverage_rows("Articles by year and status"))
    return by_language, total


def differs(a, b, tolerance):
    return a is None or b is None or abs(a - b) > tolerance


def compare_lower_bound(data, report):
    problems = []
    for lang in LANGS:
        for year in BOUND_YEARS:
            result = report["bound"][lang].get(str(year)) or {}
            cross, mine = result.get("crossfit"), data["minimo"][lang].get(str(year))
            if (cross is None) != (mine is None):
                problems.append(f"minimo {lang} {year}: {mine} against the analysis's {cross}")
            elif cross and (differs(mine["gap"], cross["gap"], 1e-6)
                            or differs(mine["ep"], cross["se"], 1e-6)):
                problems.append(f"minimo {lang} {year}: {mine['gap']} ± {mine['ep']} against "
                                f"{cross['gap']} ± {cross['se']}")
    return problems


def compare_counts(data, report):
    problems = []
    fixed = read_excess("fixed")
    for lang in LANGS:
        for year in TARGETS:
            want = report["style_counts"][lang].get(str(year), {}).get("style", 0)
            if data["estilo"][lang].get(str(year)) != want:
                problems.append(f"estilo {lang} {year}: {data['estilo'][lang].get(str(year))} "
                                f"against {want}")
        for year in BOUND_YEARS:
            want = len(fixed.get((lang, year), {}))
            if data["palavras_excesso"][lang].get(str(year)) != want:
                problems.append(f"palavras_excesso {lang} {year}: "
                                f"{data['palavras_excesso'][lang].get(str(year))} against {want}")
    by_language, total = coverage_tables()
    if data["resumos"]["total"] != total:
        problems.append(f"resumos total: {data['resumos']['total']} against {total} in coverage.md")
    for (year, lang), want in by_language.items():
        if data["resumos"].get(lang, {}).get(str(year)) != want:
            problems.append(f"resumos {lang} {year}: {data['resumos'].get(lang, {}).get(str(year))} "
                            f"against {want} in coverage.md")
    return problems


def compare_pairs(data):
    """inicio.json's pares against analysis/pairs/report.json (see inicio.pairs for the keys)."""
    group = json.loads(PAIRS_REPORT.read_text(encoding="utf-8"))["groups"]["all"]
    estimates = group["estimates"]
    mine = data["pares"]
    wanted = [("en_sobe", mine["en_sobe"], "pooled en rise"),
              ("pt_sobe", mine["pt_sobe"], "pooled pt rise"),
              ("dif", mine["dif"], "pooled difference"),
              ("placebo", mine["placebo"], "pooled placebo"),
              ("em2024 en_sobe", mine["em2024"]["en_sobe"], "event 2024 en rise"),
              ("em2024 pt_sobe", mine["em2024"]["pt_sobe"], "event 2024 pt rise"),
              ("em2024 dif", mine["em2024"]["dif"], "event 2024 difference")]
    problems = [f"pares {name}: {value} against {estimates[key]['value']:.4f} ({key})"
                for name, value, key in wanted if differs(value, estimates[key]["value"], 1e-4)]
    for name, interval, key in (("ic", mine["ic"], "pooled difference"),
                                ("em2024 ic", mine["em2024"]["ic"], "event 2024 difference")):
        if any(differs(a, b, 1e-4) for a, b in zip(interval, estimates[key]["interval"])):
            problems.append(f"pares {name}: {interval} against {estimates[key]['interval']}")
    if mine["p"] != estimates["pooled difference"]["p"]:
        problems.append(f"pares p: {mine['p']} against {estimates['pooled difference']['p']}")
    if mine["artigos"] != group["papers"]:
        problems.append(f"pares artigos: {mine['artigos']} against {group['papers']}")
    return problems


def compare_experiment(data):
    report = json.loads(EXPERIMENT_REPORT.read_text(encoding="utf-8"))
    rows = [result for model, tasks in report.items() if model != "shared"
            for result in tasks.values()]
    texts = {result["texts"] for result in rows}
    mine = data["experimento"]
    problems = []
    if texts != {mine["textos"]}:
        problems.append(f"experimento textos: {mine['textos']} against {sorted(texts)}")
    if mine["modelos"] != len(report) - ("shared" in report):
        problems.append(f"experimento modelos: {mine['modelos']}")
    return problems


def compare_versions(data):
    """inicio.json's model versions and request against the Time machine's files and the prompts."""
    mine, problems = data["experimento"], []
    shown = json.loads((SITE / "experimento" / "polish-pt.json").read_text(encoding="utf-8"))
    runs = [{key: row[key] for key in ("id", "nome", "versao", "datas")} for row in shown["modelos"]]
    if mine["versoes"] != runs:
        problems.append("experimento versoes differ from experimento/polish-pt.json's modelos")
    for lang in LANGS:
        task = json.loads((SITE / "experimento" / f"polish-{lang}.json").read_text(encoding="utf-8"))
        prompt = (EXP / "prompts" / f"polish-{lang}.txt").read_text(encoding="utf-8")
        if not prompt.strip().startswith(mine["pedido"][lang] + "\n") \
                or not task["modelos"][0]["prompt"].startswith(mine["pedido"][lang]):
            problems.append(f"experimento pedido {lang} is not the start of the prompt sent")
    return problems


def compare_method(data, report):
    """inicio.json's metodo against coverage.md, the label sheets, report.json's agreement, the
    pair sample, the corpus, analysis/crosslang/report.json and experiment/items/."""
    mine, problems = data["metodo"], []
    line = re.search(r"(\d+) journals; (\d+) with articles in Crossref; (\d+) with usable abstracts",
                     COVERAGE.read_text(encoding="utf-8"))
    journals = dict(zip(("colecao", "no_crossref", "com_resumo"), map(int, line.groups()))) \
        if line else None
    if mine["revistas"] != journals:
        problems.append(f"metodo revistas: {mine['revistas']} against {journals} in coverage.md")
    statuses = Counter()
    for row in coverage_rows("Articles by year and status"):
        statuses.update({key: int(value) for key, value in row.items()
                         if key not in ("year", "all") and value.isdigit()})
    if {key: n for key, n in statuses.items() if n} != mine["filtros"]:
        problems.append(f"metodo filtros: {mine['filtros']} against coverage.md")
    cross = json.loads(CROSS_REPORT.read_text(encoding="utf-8"))
    sample = json.loads((RAW / "articlemeta" / "sample.json").read_text(encoding="utf-8"))
    papers = json.loads(PAIRS_REPORT.read_text(encoding="utf-8"))["groups"]["all"]["papers"]
    for lang in LANGS:
        with (LABELS / f"claude-{lang}.csv").open(encoding="utf-8", newline="") as handle:
            rows = sum(1 for _ in csv.DictReader(handle))
        agreement = report["agreement"][lang]
        wanted = [("marcadoras", mine["marcadoras"][lang], cross[lang]["markers"]),
                  ("rotuladas", mine["rotuladas"][lang], rows),
                  ("h3 traduzem", mine["h3"][lang]["traduzem"], cross[lang]["markers_hit"]),
                  ("h3 controles_traduzem", mine["h3"][lang]["controles_traduzem"],
                   cross[lang]["controls_hit"]),
                  ("concordancia kappa", mine["concordancia"][lang]["kappa"], agreement["kappa"]),
                  ("concordancia acordo", mine["concordancia"][lang]["acordo"],
                   agreement["agreement"]),
                  ("concordancia decididas", mine["concordancia"][lang]["decididas"],
                   agreement["decided"])]
        problems += [f"metodo {name} {lang}: {value} against {want}"
                     for name, value, want in wanted if differs(value, want, 1e-4)]
    wanted = {"por_ano": sample["per_year"], "anos": len(sample["codes"]),
              "sorteados": sum(map(len, sample["codes"].values())), "utilizaveis": papers}
    if mine["amostra_pares"] != wanted:
        problems.append(f"metodo amostra_pares: {mine['amostra_pares']} against {wanted}")
    lengths = defaultdict(list)
    for record in load_corpus(with_words=True):
        if record["status"] == "ok" and record["lang"] in LANGS:
            lengths[record["lang"], record["year"]].append(len(record["words"]))
    for (lang, year), values in lengths.items():
        if differs(mine["tamanho"][lang].get(str(year)), sum(values) / len(values), 0.05):
            problems.append(f"metodo tamanho {lang} {year}: {mine['tamanho'][lang].get(str(year))}")
    items = load_items()
    for task in TASKS:
        journals = Counter(item["journal"] for item in items.values() if item["task"] == task)
        found = mine["experimento_amostra"][task]
        if (found["revistas"], found["max_por_revista"]) != (len(journals), max(journals.values())):
            problems.append(f"metodo experimento_amostra {task}: {found}")
    return problems


def compare_home():
    """inicio.json against analysis/report.json, analysis/pairs/report.json, the excess tables,
    analysis/coverage.md, analysis/experiment/report.json and the other sources of its Method
    numbers."""
    path = SITE / "inicio.json"
    if not path.exists():
        return ["inicio.json is missing"]
    data = json.loads(path.read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    problems = []
    for compare in (lambda: compare_lower_bound(data, report), lambda: compare_counts(data, report),
                    lambda: compare_pairs(data), lambda: compare_experiment(data),
                    lambda: compare_versions(data), lambda: compare_method(data, report)):
        try:
            problems += compare()
        except (KeyError, TypeError, IndexError) as exc:
            problems.append(f"inicio.json is not in the expected shape: {exc!r}")
    if len(data["resumos"]["pt"]) != len(YEARS):
        problems.append("resumos: not every year is there")
    return [f"inicio (against the analysis): {problem}" for problem in problems]


def build():
    problems = module_problems() + compare_home()
    for problem in problems:
        print(problem)
    if problems:
        log(f"check: {len(problems)} problem(s)")
        sys.exit(1)
    log("check: no problems")
