"""dados/inicio.json: the opening chart and the headline numbers of the home page, which the Method
page also uses (site/DADOS.md).

    destaques         one English and one Portuguese word for the opening chart: the first of each
                      language in palavras/padrao.json when that file exists, else picked here
                      (pick_highlight)
    series            their yearly series, measured as every series of the site (comum.series)
    minimo            the cross-fitted lower bound per language and year (analysis/report.json)
    estilo            excess style words per year, rolling baseline (report.json style_counts)
    palavras_excesso  widespread excess words per year from 2023, fixed baseline (excess-fixed)
    resumos           usable abstracts per language and year (the cleaned corpus)
    pares             the same-paper test of H2 (analysis/pairs/report.json)
    experimento       the rewriting experiment: its size (analysis/experiment/report.json), each
                      model's version and run dates, and the request to polish an abstract
    amostras          the home page's thumbnails of the Time machine and the X-ray: a real sentence
                      a model rewrote, and the start of the X-ray's 2025 example with its markers
    metodo            the numbers the Method page describes the data with: journals, filters,
                      markers, labels and agreement, the pair sample, abstract length, the test of
                      H3 and the experiment's sample

amostras reads dados/experimento/ and dados/marcadoras.json, so this step runs after those.
"""

import json
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher

from excess import BOUND_YEARS, LABELS, TARGETS, TOKEN, read_labels
from experiment import EXP, MODELS, TASKS, load_items
from harvest_scielo import read_jsonl
from site_data.comum import (LANGS, LAST, LAST_FULL, OUT, PRE_LLM, RAW, REPORT, SITE, YEARS,
                             excess_rows, frames, labels, markers, records, series, share,
                             write_json)
from site_data.experimento import RUNS, headers, version
from site_data.palavras import sentences

PAIRS_REPORT = OUT / "pairs" / "report.json"
EXPERIMENT_REPORT = OUT / "experiment" / "report.json"
CROSS_REPORT = OUT / "crosslang" / "report.json"
SAMPLE = RAW / "articlemeta" / "sample.json"
DEFAULTS = SITE / "palavras" / "padrao.json"
# The Time machine's thumbnail: a rewritten sentence of SAMPLE_WORDS words, in which the model
# changed SAMPLE_CHANGES runs of the original sentence it matches best (at least SAMPLE_SIMILAR of
# difflib's ratio) and inserted a marker word.
SAMPLE_WORDS, SAMPLE_CHANGES, SAMPLE_SIMILAR = (8, 22), (1, 3), 0.5
# Fallback rule for the opening words, used only when palavras/padrao.json does not exist yet:
# among the excess style words of the last full year (fixed baseline) found in at least
# MIN_HIGHLIGHT abstracts that year, keep those whose line reads at a glance (every year before
# 2023 at most half the last full year's share, a rise in each year from 2022 to the last full
# year, and the partial year no lower than the year before the last full one), and take the one
# with the largest ratio.
MIN_HIGHLIGHT = 30
EVENT_YEAR = 2024  # the one year in which the English rise was larger (analysis/pairs/report.md, H2)


def clean_line(found):
    """Whether a series reads at a glance: flat before ChatGPT, rising to the last full year, and
    still high in the partial year."""
    obs = dict(zip(YEARS, found["obs"]))
    peak = obs[LAST_FULL]
    if peak is None or any(obs[y] is None or obs[y] > peak / 2 for y in YEARS if y <= PRE_LLM[1]):
        return False
    rising = range(PRE_LLM[1], LAST_FULL + 1)
    if any(obs[y] is None or obs[y + 1] is None or obs[y + 1] <= obs[y] for y in rising[:-1]):
        return False
    return obs[LAST] is not None and obs[LAST] >= obs[LAST_FULL - 1]


def pick_highlight(lang, found):
    """The fallback opening word of one language: the rule above MIN_HIGHLIGHT."""
    style = labels(lang)
    rows = excess_rows("fixed").get((lang, LAST_FULL), {})
    candidates = sorted((row for word, row in rows.items() if style.get(word) == "estilo"
                         and int(row["count"]) >= MIN_HIGHLIGHT),
                        key=lambda row: -row["ratio"])
    for row in candidates:
        if clean_line(series(row["word"], found)):
            return row["word"]
    return candidates[0]["word"] if candidates else None


def highlights(by_lang):
    """'word.lang' for English and Portuguese, in that order: palavras/padrao.json's first word of
    each language when that file exists, else the fallback rule."""
    chosen = {}
    if DEFAULTS.exists():
        for key in json.loads(DEFAULTS.read_text(encoding="utf-8")).get("padrao", []):
            word, _, lang = key.rpartition(".")
            chosen.setdefault(lang, word)
    for lang in ("en", "pt"):
        if lang not in chosen:
            chosen[lang] = pick_highlight(lang, by_lang[lang])
    return [f"{chosen[lang]}.{lang}" for lang in ("en", "pt") if chosen[lang]]


def lower_bound(report):
    """Per language and year from 2023: the cross-fitted gap and its standard error, the placebo
    gap, and how many marker words each half picked (null where neither half found any)."""
    found = {}
    for lang in LANGS:
        found[lang] = {}
        for year in BOUND_YEARS:
            result = report["bound"][lang].get(str(year))
            cross = result and result["crossfit"]
            found[lang][str(year)] = None if not cross else {
                "gap": share(cross["gap"]), "ep": share(cross["se"]),
                "placebo": share(result["placebo"]["gap"]) if result["placebo"] else None,
                "marcadoras": [result["markers"]["a"], result["markers"]["b"]]}
    return found


def style_words(report):
    """Excess style words per language and year, rolling baseline (H1)."""
    return {lang: {str(year): report["style_counts"][lang].get(str(year), {}).get("style", 0)
                   for year in TARGETS} for lang in LANGS}


def excess_words():
    """Widespread excess words per language and year from 2023, against 2021-2022 (fixed rule)."""
    rows = excess_rows("fixed")
    return {lang: {str(year): len(rows.get((lang, year), {})) for year in BOUND_YEARS}
            for lang in LANGS}


def abstracts():
    """Usable abstracts per language and year; the total counts every language, Spanish too."""
    usable = [r for r in records() if r["status"] == "ok"]
    found = {"total": len(usable)}
    for lang in (*LANGS, "es"):
        found[lang] = {str(year): sum(1 for r in usable if r["lang"] == lang and r["year"] == year)
                       for year in YEARS}
    return found


def estimate(estimates, key):
    row = estimates[key]
    return round(row["value"], 4), [round(value, 4) for value in row["interval"]], row["p"]


def pairs():
    """The same-paper test of H2, every paper (group "all" of analysis/pairs/report.json).

    Keys used: "pooled en rise" and "pooled pt rise" (2025 and 2026 averaged by papers, each year
    with its own cross-fitted marker sets), "pooled difference" (value, bootstrap interval, p) and
    "pooled placebo"; and, for the one year in which English rose more, "event 2024 en rise",
    "event 2024 pt rise" and "event 2024 difference" (the 2025 marker sets applied to 2024).
    """
    group = json.loads(PAIRS_REPORT.read_text(encoding="utf-8"))["groups"]["all"]
    estimates = group["estimates"]
    en, _, _ = estimate(estimates, "pooled en rise")
    pt, _, _ = estimate(estimates, "pooled pt rise")
    dif, interval, p = estimate(estimates, "pooled difference")
    placebo, placebo_interval, _ = estimate(estimates, "pooled placebo")
    event = f"event {EVENT_YEAR}"
    event_dif, event_interval, event_p = estimate(estimates, f"{event} difference")
    return {"artigos": group["papers"], "en_sobe": en, "pt_sobe": pt, "dif": dif, "ic": interval,
            "p": p, "placebo": placebo, "placebo_ic": placebo_interval,
            "em2024": {"en_sobe": estimate(estimates, f"{event} en rise")[0],
                       "pt_sobe": estimate(estimates, f"{event} pt rise")[0],
                       "dif": event_dif, "ic": event_interval, "p": event_p}}


def experiment():
    """Texts per task and model, models and tasks; each model's version and run dates, as the Time
    machine shows them (site_data.experimento); and the first paragraph of the request to polish
    an abstract in each language (the rest fixes the reply's format)."""
    report = json.loads(EXPERIMENT_REPORT.read_text(encoding="utf-8"))
    texts = {report[model][task]["texts"] for model in MODELS for task in TASKS}
    first = next(iter(TASKS))
    runs = [{"id": model, "nome": RUNS[model]["nome"],
             "versao": version(report[model][first]["label"]), "datas": headers(model)[1]}
            for model in MODELS]
    request = {lang: (EXP / "prompts" / f"polish-{lang}.txt").read_text(encoding="utf-8")
               .strip().split("\n\n")[0] for lang in LANGS}
    return {"textos": min(texts), "modelos": len(MODELS), "tarefas": len(TASKS),
            "versoes": runs, "pedido": request}


# --- the home page's thumbnails ----------------------------------------------------------------

def marker_words_in(token, marker_set):
    """The marker words of one whitespace-separated token (the site's rule for marks in a text)."""
    return [word for word in TOKEN.findall(unicodedata.normalize("NFC", token).lower())
            if word in marker_set]


def segments(source, words, marker_set):
    """[op, text] runs of a word-by-word difflib comparison of two sentences (lists of tokens):
    '=' kept, '-' removed, '+' inserted, '+m' an inserted token with a marker word. Removed runs
    come before inserted ones; the page joins the runs with spaces."""
    found = []

    def add(op, tokens):
        if tokens and found and found[-1][0] == op:
            found[-1][1] += " " + " ".join(tokens)
        elif tokens:
            found.append([op, " ".join(tokens)])

    for tag, i1, i2, j1, j2 in SequenceMatcher(None, source, words, autojunk=False).get_opcodes():
        if tag == "equal":
            add("=", source[i1:i2])
            continue
        add("-", source[i1:i2])
        for token in words[j1:j2]:
            add("+m" if marker_words_in(token, marker_set) else "+", [token])
    return found


def rewrite_sample(lang):
    """The Time machine's thumbnail in `lang`: the shortest sentence of SAMPLE_WORDS words that a
    model wrote when polishing an abstract, changing SAMPLE_CHANGES runs of the original sentence
    it matches best and inserting a marker word (ties by abstract, then in the models' order).
    None without dados/experimento/polish-<lang>.json."""
    path = SITE / "experimento" / f"polish-{lang}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    marker_set, found = set(data["marcadoras"]), []
    for item in data["itens"]:
        original = [sentence.split() for sentence in sentences(item["original"])]
        for rank, model in enumerate(MODELS):
            for sentence in sentences(item["saidas"].get(model) or ""):
                words = sentence.split()
                if not SAMPLE_WORDS[0] <= len(words) <= SAMPLE_WORDS[1]:
                    continue
                source = max(original, key=lambda tokens: SequenceMatcher(
                    None, tokens, words, autojunk=False).ratio())
                matcher = SequenceMatcher(None, source, words, autojunk=False)
                changes = sum(tag != "equal" for tag, *_ in matcher.get_opcodes())
                runs = segments(source, words, marker_set)
                if (matcher.ratio() >= SAMPLE_SIMILAR
                        and SAMPLE_CHANGES[0] <= changes <= SAMPLE_CHANGES[1]
                        and any(op == "+m" for op, _ in runs)):
                    found.append((len(words), item["id"], rank, model, runs))
    if not found:
        return None
    _, item_id, _, model, runs = min(found, key=lambda row: row[:3])
    return {"tarefa": f"polish-{lang}", "id": item_id, "modelo": model, "segmentos": runs}


def xray_sample(lang):
    """The X-ray's thumbnail in `lang`: the first sentence of marcadoras.json's example of the last
    full year, as [text, level] runs (level null outside marker words, which are found by the
    site's rule for marks in a text), with the example's DOI, journal and year. None without
    dados/marcadoras.json."""
    path = SITE / "marcadoras.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    example = data["exemplos"][lang][str(LAST_FULL)]
    sentence = unicodedata.normalize("NFC", next(sentences(example["texto"])))
    runs, last = [], 0
    for match in TOKEN.finditer(sentence.lower()):
        if match.group() in data[lang]:
            if match.start() > last:
                runs.append([sentence[last:match.start()], None])
            runs.append([sentence[match.start():match.end()], data[lang][match.group()][1]])
            last = match.end()
    if last < len(sentence):
        runs.append([sentence[last:], None])
    return {"doi": example["doi"], "revista": example["revista"], "ano": example["ano"],
            "segmentos": runs}


def samples():
    return {"experimento": {lang: rewrite_sample(lang) for lang in LANGS},
            "raiox": {lang: xray_sample(lang) for lang in LANGS}}


# --- the Method page's numbers -----------------------------------------------------------------

def method_numbers(report):
    """What the Method page can say about the data, each number from its source (site/DADOS.md)."""
    found = records()
    usable = [r for r in found if r["status"] == "ok"]
    lengths = defaultdict(list)
    for r in usable:
        if r["lang"] in LANGS:
            lengths[r["lang"], r["year"]].append(len(r["words"]))
    cross = json.loads(CROSS_REPORT.read_text(encoding="utf-8"))
    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))
    pairs = json.loads(PAIRS_REPORT.read_text(encoding="utf-8"))["groups"]["all"]
    items = load_items()
    sizes = {}
    for task in TASKS:
        chosen = [item for item in items.values() if item["task"] == task]
        per_journal = Counter(item["journal"] for item in chosen)
        per_area = set(Counter(item["area"] for item in chosen).values())
        sizes[task] = {"revistas": len(per_journal), "max_por_revista": max(per_journal.values()),
                       "areas": len({item["area"] for item in chosen}),
                       "por_area": per_area.pop() if len(per_area) == 1 else None}
    return {
        "revistas": {"colecao": sum(1 for _ in read_jsonl(RAW / "journals.jsonl")),
                     "no_crossref": len({r["journal"] for r in found}),
                     "com_resumo": len({r["journal"] for r in usable})},
        "filtros": dict(Counter(r["status"] for r in found).most_common()),
        "marcadoras": {lang: len(markers(lang)) for lang in LANGS},
        "rotuladas": {lang: len(read_labels(LABELS / f"claude-{lang}.csv")) for lang in LANGS},
        "concordancia": {lang: {"amostra": row["words"], "acordo": round(row["agreement"], 4),
                                "kappa": round(row["kappa"], 4), "decididas": row["decided"],
                                "acordo_decididas": round(row["decided_agreement"], 4)}
                         for lang, row in report["agreement"].items()},
        "amostra_pares": {"por_ano": sample["per_year"], "anos": len(sample["codes"]),
                          "sorteados": sum(map(len, sample["codes"].values())),
                          "utilizaveis": pairs["papers"]},
        "tamanho": {lang: {str(year): round(sum(lengths[lang, year]) / len(lengths[lang, year]), 1)
                           for year in YEARS if lengths[lang, year]} for lang in LANGS},
        "h3": {lang: {"marcadoras": cross[lang]["markers"], "traduzem": cross[lang]["markers_hit"],
                      "controles": cross[lang]["controls"],
                      "controles_traduzem": cross[lang]["controls_hit"],
                      "p": float(f"{cross[lang]['p']:.2g}")} for lang in LANGS},
        "experimento_amostra": sizes}


def build():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    by_lang = {lang: frames(lang) for lang in LANGS}
    chosen = highlights(by_lang)
    write_json("inicio.json", {
        "destaques": chosen,
        "series": {key: series(key.rpartition(".")[0], by_lang[key.rpartition(".")[2]])
                   for key in chosen},
        "minimo": lower_bound(report),
        "estilo": style_words(report),
        "palavras_excesso": excess_words(),
        "resumos": abstracts(),
        "pares": pairs(),
        "experimento": experiment(),
        "amostras": samples(),
        "metodo": method_numbers(report)})


def check_samples(data):
    """The thumbnails against the files they come from: the rewritten sentence's runs rebuild a
    sentence of the original abstract and one of the model's text, its '+m' tokens hold marker
    words and it has a '+m'; the X-ray runs rebuild the start of the example and carry the levels
    of marcadoras.json."""
    problems, found = [], data.get("amostras") or {}
    for lang in LANGS:
        sample = (found.get("experimento") or {}).get(lang)
        path = SITE / "experimento" / f"polish-{lang}.json"
        if sample is None or not path.exists():
            problems.append(f"amostras: no rewritten sentence in {lang}")
            continue
        task = json.loads(path.read_text(encoding="utf-8"))
        item = next((i for i in task["itens"] if i["id"] == sample["id"]), None)
        runs = sample["segmentos"]
        before = " ".join(text for op, text in runs if op in ("=", "-"))
        after = " ".join(text for op, text in runs if op in ("=", "+", "+m"))
        marker_set = set(task["marcadoras"])
        if (item is None or before not in sentences(item["original"])
                or after not in sentences(item["saidas"].get(sample["modelo"]) or "")):
            problems.append(f"amostras: the {lang} runs do not rebuild {sample['id']}'s sentences")
        marked = [text for op, text in runs if op == "+m"]
        if not marked or any(not marker_words_in(token, marker_set)
                             for text in marked for token in text.split()):
            problems.append(f"amostras: the {lang} '+m' runs are not all marker words")
    table = json.loads((SITE / "marcadoras.json").read_text(encoding="utf-8"))
    for lang in LANGS:
        sample = (found.get("raiox") or {}).get(lang)
        if sample is None:
            problems.append(f"amostras: no X-ray sentence in {lang}")
            continue
        example = table["exemplos"][lang][str(LAST_FULL)]
        text = "".join(run for run, _ in sample["segmentos"])
        if not unicodedata.normalize("NFC", example["texto"]).startswith(text) \
                or sample["doi"] != example["doi"]:
            problems.append(f"amostras: the {lang} X-ray runs are not the example's first sentence")
        for run, level in sample["segmentos"]:
            words = TOKEN.findall(run.lower())
            expected = table[lang][run.lower()][1] if run.lower() in table[lang] else None
            if level != expected or (level is None and any(w in table[lang] for w in words)):
                problems.append(f"amostras: the {lang} X-ray run {run!r} has level {level}")
    return problems


def check():
    """Problems inside inicio.json: the opening words, their series and their source, and the
    thumbnails. The numbers taken from the analysis are compared by scripts/site_data/check.py."""
    path = SITE / "inicio.json"
    if not path.exists():
        return ["inicio.json is missing"]
    data = json.loads(path.read_text(encoding="utf-8"))
    problems = []
    langs = [key.rpartition(".")[2] for key in data["destaques"]]
    if langs != ["en", "pt"]:
        problems.append(f"destaques should be one English and one Portuguese word: {data['destaques']}")
    if DEFAULTS.exists():
        defaults = json.loads(DEFAULTS.read_text(encoding="utf-8")).get("padrao", [])
        for lang in ("en", "pt"):
            first = next((key for key in defaults if key.endswith(f".{lang}")), None)
            if first and first not in data["destaques"]:
                problems.append(f"destaques do not follow palavras/padrao.json ({first}); "
                                "run the inicio step again")
    fixed = excess_rows("fixed")
    for key in data["destaques"]:
        found = data["series"].get(key)
        if not found:
            problems.append(f"no series for {key}")
            continue
        if (len(found["n"]), len(found["obs"]), len(found["esp"])) != (len(YEARS), len(YEARS),
                                                                       LAST - PRE_LLM[0] + 1):
            problems.append(f"{key}: series of the wrong length")
        word, _, lang = key.rpartition(".")
        # In the years where the word is an excess word, obs and esp are the analysis's p and q.
        for year in BOUND_YEARS:
            row = fixed.get((lang, year), {}).get(word)
            if row:
                obs = found["obs"][YEARS.index(year)]
                esp = found["esp"][year - PRE_LLM[0]]
                if abs(obs - row["p"]) > 2e-6 or abs(esp - row["q"]) > 2e-6:
                    problems.append(f"{key} {year}: obs {obs}, esp {esp} against the analysis's "
                                    f"p {row['p']}, q {row['q']}")
    return problems + check_samples(data)
