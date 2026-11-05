"""dados/experimento/: the rewriting experiment behind the Máquina do tempo (site/DADOS.md).

    <task>.json  every abstract of the task with the three models' versions, how each model was
                 run, the words each model adds most and the marker counts of the analysis
    prova.json   the cross test: per word, its excess in SciELO in 2025 and how much the models add
                 it when they polish an abstract in that language

The texts come from experiment/items/ and experiment/results/, the model versions and dates from
the header lines of experiment/inbox/, and every count from analysis/experiment/report.json
(scripts/experiment.py analyze). Word shifts are recomputed here with the analysis's own rule, so
prova.json can give every model's value even where the analysis left a word out, and check()
confirms that the recomputed shifts and marker counts match the analysis.
"""

import gzip
import json
import re
import unicodedata
from collections import Counter

from excess import MIN_COUNT, TOKEN, balanced_panel, length_edges, read_excess
from experiment import (CLAUDE_SYSTEM, EXP, LABEL_LINE, LATEX_COMMAND, MODELS, TASKS, TOP_WORDS,
                        load_items)
from harvest_scielo import read_jsonl
from site_data.comum import (AREAS, LAST_FULL, OUT, RAW, SITE, Frame, clean_title, corpus,
                             frame_years, journals, markers, share, write_json)

REPORT = OUT / "experiment" / "report.json"
DATE_LINE = re.compile(r"^#[ \t]*data[ \t]*:[ \t]*(\S+)", re.M | re.I)
API_ID = re.compile(r"claude-([a-z]+)-(\d+)-(\d+)")  # claude -p reports the model by its id
# How each model was run (experiment/README.md). "plano" is the access row of
# "Como pedimos", "como" the settings row; the version and the dates come from the inbox headers.
RUNS = {
    "chatgpt": {
        "nome": "ChatGPT",
        "plano": {"pt": "conta gratuita, chat temporário",
                  "en": "free account, temporary chat"},
        "como": {"pt": "O autor colou cada lote de 10 resumos num chat temporário novo, no site do "
                       "ChatGPT, com as configurações padrão. A versão é a que o autor anotou.",
                 "en": "The author pasted each batch of 10 abstracts into a new temporary chat on "
                       "the ChatGPT website, with the default settings. The version is the one the "
                       "author wrote down."}},
    "gemini": {
        "nome": "Gemini",
        "plano": {"pt": "plano Google AI Pro do autor",
                  "en": "the author's Google AI Pro plan"},
        "como": {"pt": "O autor colou cada lote de 10 resumos num chat novo do Gemini, sempre com o "
                       "mesmo modelo e as configurações padrão.",
                 "en": "The author pasted each batch of 10 abstracts into a new Gemini chat, always "
                       "with the same model and the default settings."}},
    "claude": {
        "nome": "Claude",
        "plano": {"pt": "plano Max do autor, pelo Claude Code (claude -p)",
                  "en": "the author's Max plan, through Claude Code (claude -p)"},
        "como": {"pt": "Um script mandou cada lote de 10 resumos ao claude -p a partir de uma pasta "
                       "vazia, sem ferramentas. O prompt de sistema tinha uma linha: "
                       f"\"{CLAUDE_SYSTEM}\" O Claude Code ainda põe no contexto cerca de 900 tokens "
                       "com dados do ambiente.",
                 "en": "A script sent each batch of 10 abstracts to claude -p from an empty folder, "
                       "with no tools. The system prompt was one line: "
                       f"\"{CLAUDE_SYSTEM}\" Claude Code still adds about 900 tokens of environment "
                       "details to the context."}},
}


def report():
    return json.loads(REPORT.read_text(encoding="utf-8"))


def words_of(text):
    """The analysis's words of a text (scripts/experiment.py analyze): four or more letters,
    lower case, NFC, with Gemini's LaTeX commands taken out."""
    text = LATEX_COMMAND.sub(" ", unicodedata.normalize("NFC", text))
    return set(TOKEN.findall(text.lower()))


def results(model):
    """Item id -> the model's checked reply (experiment/results/<model>.jsonl)."""
    path = EXP / "results" / f"{model}.jsonl"
    return {row["id"]: row for row in read_jsonl(path)} if path.exists() else {}


def baseline_field(task):
    """A translation is compared with the authors' English, a rewrite with the original."""
    return "reference" if task.startswith("translate") else "input"


def shifts(task, items, replies):
    """Word -> texts gained (lost) after the model's pass, over every word of the task. The
    analysis keeps only the words in at least MIN_SHIFT texts before or after; this keeps all."""
    before, after = Counter(), Counter()
    for item_id, reply in replies.items():
        if reply["task"] == task:
            before.update(words_of(items[item_id][baseline_field(task)]))
            after.update(words_of(reply["text"]))
    return {word: after[word] - before[word] for word in set(before) | set(after)}


def headers(model):
    """The model's version and the dates of its runs, from the '# modelo:' and '# data:' lines."""
    labels, dates = set(), set()
    for path in sorted((EXP / "inbox" / model).glob("*.txt")):
        text = path.read_text(encoding="utf-8", errors="replace")
        labels.update(label.strip() for label in LABEL_LINE.findall(text))
        dates.update(DATE_LINE.findall(text))
    return labels, sorted(dates)


def model_id(label):
    """'GPT-6 (ChatGPT)' -> 'GPT-6': the header without the note in parentheses."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", label).strip()


def version(label):
    """The model's name as the pages show it: the header without its note, with an API id written
    as the product name ('claude-sonnet-5-5 (claude -p...)' -> 'Claude Sonnet 5.5')."""
    found = model_id(label)
    match = API_ID.fullmatch(found)
    return f"Claude {match[1].capitalize()} {match[2]}.{match[3]}" if match else found


def prompt(task, items):
    """The exact instructions of the task's first batch; later batches differ only in the batch
    name and the example identifier."""
    first = min(items, key=lambda item: item["id"])
    text = (EXP / "prompts" / f"{task}.txt").read_text(encoding="utf-8").strip()
    return text.format(batch=first["batch"], example=first["id"])


def titles(items):
    """DOI -> title for the sampled abstracts: Crossref's title for the polish tasks, the
    article-language title from ArticleMeta for the translations. Cleaned by comum.clean_title,
    with the abstract sent to the models to give back the capitals of names in a title in
    capitals."""
    found, wanted = {}, {}
    texts = {item["doi"]: item["input"] for item in items}
    for item in items:
        if "code" not in item:
            wanted.setdefault(item["journal"], set()).add(item["doi"])
    for journal, dois in wanted.items():
        path = RAW / "crossref" / f"{journal}.jsonl.gz"
        for row in read_jsonl(path) if path.exists() else []:
            doi = row["doi"].lower()
            if doi in dois:
                found[doi] = clean_title(row.get("title"), texts[doi])
    codes = {item["code"]: item["doi"] for item in items if "code" in item}
    if codes:
        with gzip.open(RAW / "articlemeta" / "articles.jsonl.gz", "rt", encoding="utf-8") as handle:
            for line in handle:
                if any(code in line for code in codes):
                    row = json.loads(line)
                    if row.get("code") in codes:
                        names = row.get("titles") or {}
                        title = names.get(row.get("lang")) or next(iter(names.values()), None)
                        doi = codes[row["code"]]
                        found[doi] = clean_title(title, texts[doi])
    return found


def model_rows(task, task_items, analysis):
    rows = []
    for model in MODELS:
        label = analysis[model][task]["label"]
        rows.append({"id": model, "nome": RUNS[model]["nome"], "versao": version(label),
                     "id_modelo": model_id(label), "plano": RUNS[model]["plano"],
                     "datas": headers(model)[1], "prompt": prompt(task, task_items),
                     "como": RUNS[model]["como"]})
    return rows


def summary(result):
    """The marker counts of one model and task, as analysis/experiment/report.json has them."""
    return {"textos": result["texts"],
            "antes": round(result["markers_before"], 4),
            "depois": round(result["markers_after"], 4),
            "mudanca": round(result["change"], 4),
            "ic": [round(value, 4) for value in result["interval"]],
            "inseridas": len(result["added"]), "inseridas_marcadoras": result["added_markers"],
            "removidas": len(result["dropped"]), "removidas_marcadoras": result["dropped_markers"],
            "p": float(f"{result['p']:.3g}")}


def task_file(task, items, replies, analysis, titles_by_doi, journal_info):
    spec = TASKS[task]
    lang = spec["reply_lang"]
    marker_set = set(markers(lang))
    task_items = sorted((item for item in items.values() if item["task"] == task),
                        key=lambda item: item["id"])
    rows = []
    for item in task_items:
        info = journal_info.get(item["journal"], {})
        rows.append({
            "id": item["id"], "titulo": titles_by_doi.get(item["doi"]), "doi": item["doi"],
            "revista": info.get("title"), "area": AREAS.get(item["area"]), "ano": item["year"],
            "original": item["input"],
            "autores": item.get("reference") if task.startswith("translate") else None,
            "saidas": {model: (replies[model].get(item["id"]) or {}).get("text") for model in MODELS}})
    insere, resumo = {}, {}
    for model in MODELS:
        result = analysis[model][task]
        # The analysis's list of added words (gained in at least MIN_SHIFT texts), in its order.
        insere[model] = [[word, result["shift"][word], int(word in marker_set)]
                         for word in result["added"][:TOP_WORDS]]
        resumo[model] = summary(result)
    return {"tarefa": task, "lingua": lang, "lingua_original": spec["lang"],
            "modelos": model_rows(task, task_items, analysis), "itens": rows,
            "insere": insere, "resumo": resumo, "marcadoras": sorted(marker_set)}


def frame_2025(lang):
    """The analysis's comparison for the last full year (fixed rule, balanced panel)."""
    groups = corpus()
    panel = balanced_panel(groups, lang, frame_years(LAST_FULL))
    return Frame(groups, lang, LAST_FULL, panel, length_edges(groups, lang))


def proof(lang, items, replies, analysis):
    """Points of the cross test for one language: every word the analysis measured in the polish
    task (in at least MIN_SHIFT texts for some model) that the analysis tests in 2025 (at least
    MIN_COUNT abstracts in that year's panel)."""
    task = f"polish-{lang}"
    by_model = {model: shifts(task, items, replies[model]) for model in MODELS}
    measured = set().union(*(analysis[model][task]["shift"] for model in MODELS))
    marker_set = set(markers(lang))
    frame = frame_2025(lang)
    points = []
    for word in sorted(measured):
        if frame.count(word) < MIN_COUNT:
            continue
        observed, expected = frame.observed(word), frame.expected(word)
        per_model = {model: by_model[model].get(word, 0) for model in MODELS}
        points.append([word, round(observed / expected, 4), share(observed - expected),
                       round(sum(per_model.values()) / len(MODELS), 3), per_model,
                       int(word in marker_set)])
    return points


def build():
    items = load_items()
    replies = {model: results(model) for model in MODELS}
    analysis = report()
    titles_by_doi = titles(list(items.values()))
    journal_info = journals()
    for task in TASKS:
        write_json(f"experimento/{task}.json",
                   task_file(task, items, replies, analysis, titles_by_doi, journal_info))
    write_json("experimento/prova.json",
               {lang: proof(lang, items, replies, analysis) for lang in ("pt", "en")})


# --- check ------------------------------------------------------------------------------------

def close(a, b, tolerance=1e-4):
    return a is not None and b is not None and abs(a - b) <= tolerance


def check():
    """Problems in dados/experimento/: missing texts, and any count that differs from the
    analysis or from the texts themselves."""
    problems = []
    items = load_items()
    replies = {model: results(model) for model in MODELS}
    analysis = report()
    for task in TASKS:
        path = SITE / "experimento" / f"{task}.json"
        if not path.exists():
            problems.append(f"{path.name} is missing")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        lang = TASKS[task]["reply_lang"]
        marker_set = set(markers(lang))
        expected_ids = sorted(i for i, item in items.items() if item["task"] == task)
        if [row["id"] for row in data["itens"]] != expected_ids:
            problems.append(f"{task}: the items differ from experiment/items/{task}.jsonl")
        for row in data["itens"]:
            empty = [model for model in MODELS if not row["saidas"].get(model)]
            if empty:
                problems.append(f"{task} {row['id']}: no text from {', '.join(empty)}")
            if not row["revista"] or not row["area"]:
                problems.append(f"{task} {row['id']}: journal or area unknown")
            if task.startswith("translate") and not row["autores"]:
                problems.append(f"{task} {row['id']}: no English abstract by the authors")
        for model in MODELS:
            result = analysis[model][task]
            mine = shifts(task, items, replies[model])
            wrong = [w for w, value in result["shift"].items() if mine.get(w, 0) != value]
            if wrong:
                problems.append(f"{task} {model}: recomputed shift differs for {wrong[:5]}")
            done = [i for i in replies[model] if replies[model][i]["task"] == task]
            before = sum(len(words_of(items[i][baseline_field(task)]) & marker_set)
                         for i in done) / len(done)
            after = sum(len(words_of(replies[model][i]["text"]) & marker_set) for i in done) / len(done)
            summary_row = data["resumo"][model]
            if not (close(before, summary_row["antes"]) and close(after, summary_row["depois"])):
                problems.append(f"{task} {model}: markers per text {before:.4f} -> {after:.4f} "
                                f"in the texts, {summary_row['antes']} -> {summary_row['depois']} "
                                "in the file")
            if summary_row != summary(result):
                problems.append(f"{task} {model}: resumo differs from {REPORT.name}")
            listed = [entry[0] for entry in data["insere"][model]]
            if listed != result["added"][:TOP_WORDS]:
                problems.append(f"{task} {model}: insere differs from the analysis's added words")
            if any(entry[2] != int(entry[0] in marker_set) for entry in data["insere"][model]):
                problems.append(f"{task} {model}: a marker flag in insere is wrong")
            labels = headers(model)[0]
            if labels != {result["label"]}:
                problems.append(f"{task} {model}: inbox headers {sorted(labels)} differ from the "
                                f"results' label '{result['label']}'")
    problems += check_proof()
    return problems


def check_proof():
    """The 2025 ratio and gap of every proof word that is an excess word of 2025 must equal those
    of analysis/excess-fixed (rounded there to six decimals)."""
    path = SITE / "experimento" / "prova.json"
    if not path.exists():
        return ["prova.json is missing"]
    data = json.loads(path.read_text(encoding="utf-8"))
    problems = []
    fixed = read_excess("fixed")
    for lang in ("pt", "en"):
        rows = fixed.get((lang, LAST_FULL), {})
        compared = 0
        for word, ratio, gap, *_ in data[lang]:
            if word in rows:
                compared += 1
                row = rows[word]
                if not (close(ratio, row["ratio"], 1e-3) and close(gap, row["gap"], 2e-6)):
                    problems.append(f"prova {lang} {word}: {ratio}, {gap} against the analysis's "
                                    f"{row['ratio']}, {row['gap']}")
        if not compared:
            problems.append(f"prova {lang}: no excess word of {LAST_FULL} to compare with")
    return problems
