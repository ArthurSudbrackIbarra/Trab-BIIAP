"""dados/palavras/: every word's yearly series, for the search, Palavras no tempo and the panel.

    palavras/<lang>/indice.json            the search index: words with at least MIN_ABSTRACTS
                                           abstracts over the twelve yearly frames
    palavras/<lang>/<initial>.json         series, the other language's word, the highlight level
                                           of a marker word, sentences in context and the rewriting
                                           experiment, one shard per initial
    palavras/<lang>/areas/<initial>.json   the same series within each SciELO area
    palavras/padrao.json                   the words Palavras no tempo opens with, and suggestions

The series come from comum.frames(), so that obs and esp of 2023 to 2026 are the p and q of
analysis/excess-fixed. The sentences in context come from the raw Crossref abstracts of 2019 and
2025, cleaned as scripts/excess.py prepare cleans them. The contract is site/DADOS.md.
"""

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict

from crosslang import CROSS, OTHER
from excess import OUT, TOKEN
from harvest_scielo import read_jsonl
from site_data.comum import (ANOS, LANGS, LAST_FULL, PRE_LLM, RAW, SITE, area_journals,
                             counterpart, excess_rank, excess_rows, frames, journals, labels, log,
                             marker_levels, markers, read_sheet, records, series, write_json)
from textutil import clean_abstract

MIN_ABSTRACTS = 20  # abstracts summed over the yearly frames for a word (or a word in an area)
CONTEXT_YEARS = (2019, LAST_FULL)  # a year well before ChatGPT and the last full year
CONTEXT_PER_YEAR = 3
CONTEXT_CHARS = (40, 280)
# Abstracts in 2025 for a default word to draw a line clean enough to read (fewer in Portuguese,
# whose corpus is smaller).
DEFAULT_MIN = {"en": 100, "pt": 50}
MODELS = ("chatgpt", "gemini", "claude")
TASKS = {"pt": ("polish-pt",), "en": ("polish-en", "translate-pt-en")}
INITIALS = [*"abcdefghijklmnopqrstuvwxyz", "_"]


def initial(word):
    """The shard of a word: its first letter without accents, or '_' (as inicial() in base.js)."""
    letters = unicodedata.normalize("NFD", word)
    first = "".join(c for c in letters if not unicodedata.combining(c))[:1]
    return first if "a" <= first <= "z" else "_"


# --- series -----------------------------------------------------------------------------------

def frame_totals(found):
    """Word -> abstracts containing it, summed over the target years of the frames `found`."""
    total = Counter()
    for frame in found.values():
        total.update(frame.counts[frame.year])
    return total


def all_series(lang, journals=None, extra=frozenset()):
    """Word -> yearly series, for the words with at least MIN_ABSTRACTS abstracts over the frames
    (all journals, or the journals of one area) and the words of `extra` found in any of them."""
    found = frames(lang, journals)
    total = frame_totals(found)
    return {word: series(word, found) for word, count in total.items()
            if count >= MIN_ABSTRACTS or (count and word in extra)}


def area_series(lang, words):
    """Word -> area slug -> series, for the words of `words` with at least MIN_ABSTRACTS abstracts
    over that area's frames. One area at a time, to keep a single area's frames in memory."""
    found = defaultdict(dict)
    for area, codes in sorted(area_journals().items()):
        within = all_series(lang, codes)
        for word, values in within.items():
            if word in words:
                found[word][area] = values
        log(f"{lang} {area}: {len(within)} words")
    return found


# --- the other language's word (H3) ------------------------------------------------------------

def counterparts(lang, n2025):
    """Word -> its counterpart in the other language ('explores.en'), for markers and their
    controls: comum.counterpart, the rule the map's pairs follow too. `n2025` is lang -> word ->
    abstracts in 2025; only words of the other index count."""
    other = OTHER[lang]
    wanted = set(markers(lang)) | {row["control"] for row in read_sheet(
        CROSS / f"controls-{lang}.csv", "marker").values() if row["control"]}
    found = {word: counterpart(word, lang, n2025[other]) for word in sorted(wanted)}
    return {word: f"{pair}.{other}" for word, pair in found.items() if pair}


# --- the rewriting experiment ------------------------------------------------------------------

def experiment(lang):
    """Word -> model -> task -> how many more of the 80 texts contain the word after the rewrite
    (the shift of analysis/experiment/report.json), zeros left out."""
    path = OUT / "experiment" / "report.json"
    report = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    found = defaultdict(dict)
    for model in MODELS:
        for task in TASKS[lang]:
            for word, value in report.get(model, {}).get(task, {}).get("shift", {}).items():
                if value:
                    found[word].setdefault(model, {})[task] = value
    return found


# --- the default words -------------------------------------------------------------------------

def defaults(classes, n2025):
    """padrao: two English words and one Portuguese; sugestoes: three more per language.

    The rule: the excess words of 2025 (fixed baseline) labelled style, with at least
    DEFAULT_MIN[lang] abstracts in 2025, by decreasing ratio, skipping a word whose dictionary
    form (analysis/crosslang/lemmas-<lang>.csv) is already taken, so that underscore and
    underscores do not both open the page.
    """
    excess = excess_rows("fixed")
    ranked = {}
    for lang in LANGS:
        lemmas = read_sheet(CROSS / f"lemmas-{lang}.csv")
        rows = sorted(excess.get((lang, LAST_FULL), {}).values(), key=lambda row: -row["ratio"])
        picked, forms = [], set()
        for row in rows:
            word = row["word"]
            form = lemmas.get(word, {}).get("lemma", word).lower()
            enough = n2025[lang].get(word, 0) >= DEFAULT_MIN[lang]
            if classes[lang].get(word) == "estilo" and enough and form not in forms:
                picked.append(f"{word}.{lang}")
                forms.add(form)
        ranked[lang] = picked
    en, pt = ranked["en"], ranked["pt"]
    padrao = [*en[:2], pt[0]]
    sugestoes = [w for pair in zip(en[2:5], pt[1:4]) for w in pair]
    return {"padrao": padrao, "sugestoes": sugestoes}


# --- sentences in context ----------------------------------------------------------------------

# A sentence ends at . ! or ? (and any closing quote or bracket), before a space and a capital, or,
# for text glued together by the source, right before a capital that follows a lowercase word.
BOUNDARY = re.compile(r"([.!?])([\"”’)\]]*)(\s+)(?=[\"“(\[]?[A-ZÀ-ÖØ-Þ])"
                      r"|(?<=[a-zà-öø-ÿ]{3})(\.)()()(?=[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ])")
# Abbreviations after which a period does not end the sentence (lowercase, without the period).
ABBREVIATIONS = {
    "al", "e.g", "i.e", "vs", "cf", "fig", "figs", "ca", "approx", "aprox", "sp", "spp", "ssp",
    "var", "subsp", "cv", "cvs", "nov", "comb", "gen", "no", "nº", "nos", "dr", "dra", "drs",
    "prof", "profa", "sr", "sra", "srs", "jr", "eq", "eqs", "ref", "refs", "vol", "vols", "pp",
    "ed", "eds", "inc", "ltd", "co", "st", "mr", "mrs", "ms", "ex", "obs", "pág", "págs", "séc",
    "art", "arts", "cap", "tab", "op", "cit", "ibid", "et", "aff", "resp", "est"}
# A structured abstract's section label at the start of a sentence (OBJECTIVE:, Métodos:).
LABEL = re.compile(r"^((?:[^\s:]+\s+){0,4}?[^\s:]+)\s*:\s+")
LABEL_WORDS = {
    "objective", "objectives", "objetivo", "objetivos", "aim", "aims", "purpose", "background",
    "introduction", "introdução", "context", "contexto", "method", "methods", "methodology",
    "método", "métodos", "metodologia", "material", "materials", "materiais", "result", "results",
    "resultado", "resultados", "conclusion", "conclusions", "conclusão", "conclusões",
    "discussion", "discussão", "design", "desenho", "setting", "participants", "participantes",
    "interventions", "main", "outcome", "outcomes", "measures", "findings", "approach",
    "originality", "value", "limitations", "implications", "practical", "social", "research",
    "case", "report", "relato", "caso", "considerações", "finais", "final", "considerations",
    "and", "e", "de", "do", "da", "dos", "das", "of", "the", "study", "estudo", "local",
    "casuística", "goal", "goals", "problem", "problema", "procedimentos", "procedures",
    "highlights", "summary", "síntese", "fundamentos", "justificativa", "abordagem", "propósito",
    "for", "practice", "fundamento", "objetive", "contribution", "contributions", "consideration",
    "development", "desenvolvimento", "description", "theoretical", "methodological",
    "finalidade", "constatações", "originalidade", "valor", "comentários", "marco", "teórico",
    "esperados", "relevância", "relevance", "critérios", "inclusão", "management"}
# The same without the colon, in capitals (RESULTADOS Emergiram duas categorias...) or as one
# common section name (Introduction Even people with normal hearing...).
UPPER_LABEL = re.compile(r"^([A-ZÀ-ÖØ-Þ]{4,}(?:[\s/]+[A-ZÀ-ÖØ-Þ]+)*)\s+"
                         r"(?=[A-ZÀ-ÖØ-Þ](?:[a-zà-öø-ÿ]|\s))")
TITLE_LABEL = re.compile(r"^(?:Introduction|Introdução|Objectives?|Objetivos?|Aims?|Purpose|"
                         r"Background|Methods?|Métodos?|Methodology|Metodologia|Results?|"
                         r"Resultados?|Conclusions?|Conclusão|Conclusões|Discussion|Discussão|"
                         r"Context|Contexto)\s+(?=[A-ZÀ-ÖØ-Þ](?:[a-zà-öø-ÿ]|\s))")
ENDING = re.compile(r"[.!?][\"”’)\]]*$")
# An abstract label glued to the first word (ABSTRACTUpwelling), which clean_abstract leaves.
GLUED = re.compile(r"^(?i:abstract|resumo|resumen|summary)\s*(?=[A-ZÀ-ÖØ-Þ])")


def ends_sentence(before):
    """Whether a period after the text `before` ends a sentence (not an abbreviation or an
    initial: et al., e.g., E. coli, A. B. Silva)."""
    match = re.search(r"([^\s(\[\"“]+)$", before)
    if not match:
        return True
    last = match.group(1).lower()
    if len(last) == 1 and last.isalpha():
        return False
    if re.fullmatch(r"(?:[^\W\d_]\.)+[^\W\d_]", last):
        return False
    return last not in ABBREVIATIONS


def sentences(text):
    """The sentences of a cleaned abstract, in order."""
    start = 0
    for match in BOUNDARY.finditer(text):
        period = match.group(1) or match.group(4)
        position = match.start(1) if match.group(1) else match.start(4)
        if period == "." and not ends_sentence(text[start:position]):
            continue
        end = match.end(2) if match.group(1) else match.end(4)
        yield text[start:end].strip()
        start = match.end()
    yield text[start:].strip()


def strip_label(sentence):
    """The sentence without a leading section label in capitals or made of label words."""
    sentence = GLUED.sub("", sentence)
    match = LABEL.match(sentence)
    if match:
        label = match.group(1)
        words = re.findall(r"[^\W\d_]+", label.lower())
        if words and (label.isupper() or all(w in LABEL_WORDS for w in words)):
            return sentence[match.end():]
    match = UPPER_LABEL.match(sentence)
    if match and all(w in LABEL_WORDS for w in re.findall(r"[^\W\d_]+", match.group(1).lower())):
        return sentence[match.end():]
    return TITLE_LABEL.sub("", sentence)


def readable(sentence):
    """A whole sentence of the right length: starts with a capital, ends with . ! or ?, brackets
    balanced (a bad split leaves them open), no links, and lowercasing keeps its length (so the
    match found in lowercase falls on the same characters)."""
    low, high = CONTEXT_CHARS
    return (low <= len(sentence) <= high and sentence[0].isupper() and ENDING.search(sentence)
            and sentence.count("(") == sentence.count(")")
            and sentence.count("[") == sentence.count("]")
            and "http" not in sentence and "www." not in sentence
            and len(sentence.lower()) == len(sentence))


def split_at(sentence, word):
    """antes, palavra, depois around the first token of the sentence that is `word`."""
    for match in TOKEN.finditer(sentence.lower()):
        if match.group() == word:
            return (sentence[:match.start()], sentence[match.start():match.end()],
                    sentence[match.end():])
    return None


def usable_abstracts():
    """DOI -> (lang, year, journal) for the usable abstracts of the context years."""
    return {r["doi"]: (r["lang"], r["year"], r["journal"]) for r in records()
            if r["status"] == "ok" and r["lang"] in LANGS and r["year"] in CONTEXT_YEARS}


def contexts(wanted):
    """lang -> word -> year -> up to CONTEXT_PER_YEAR sentences, from different journals.

    `wanted` is lang -> set of words. Each abstract gives each word its first readable sentence
    with the word; per journal the abstract with the smallest hash of (word, DOI) stays, and the
    journals with the smallest hashes win, so the choice is random but the same on every run.
    """
    usable = usable_abstracts()
    titles = {code: info["title"] for code, info in journals().items()}
    best = defaultdict(dict)  # (lang, word, year) -> journal -> (key, sentence, doi)
    seen = set()
    files = sorted((RAW / "crossref").glob("*.jsonl.gz"))
    for path in files:
        for row in read_jsonl(path):
            doi = row["doi"].lower()
            # The first row with a DOI is the one scripts/excess.py prepare kept.
            if doi in seen or doi not in usable:
                seen.add(doi)
                continue
            seen.add(doi)
            lang, year, journal = usable[doi]
            if row["journal"] != journal:
                continue
            text = unicodedata.normalize("NFC", clean_abstract(row["abstract"], titles=False))
            done = set()
            for whole in sentences(text):
                sentence = strip_label(whole)
                if not sentence or not readable(sentence):
                    continue
                # A word counts when the analysis saw it (in the sentence as the abstract has it,
                # where a glued label hides it) and it is still there once the label is gone.
                present = set(TOKEN.findall(whole.lower())) & set(TOKEN.findall(sentence.lower()))
                for word in (wanted[lang] & present) - done:
                    done.add(word)
                    key = hashlib.md5(f"{word} {doi}".encode()).hexdigest()
                    cell = best[lang, word, year]
                    if journal not in cell or key < cell[journal][0]:
                        cell[journal] = (key, sentence, doi)
    found = defaultdict(lambda: defaultdict(dict))
    for lang in LANGS:
        for word in wanted[lang]:
            for year in CONTEXT_YEARS:
                cell = best.get((lang, word, year), {})
                chosen = sorted(cell.items(), key=lambda item: item[1][0])
                found[lang][word][str(year)] = [
                    context(sentence, word, titles.get(journal, journal), year, doi)
                    for journal, (_, sentence, doi) in chosen[:CONTEXT_PER_YEAR]]
    log(f"sentences in context from {len(files)} journals' files")
    return found


def context(sentence, word, journal, year, doi):
    antes, palavra, depois = split_at(sentence, word)
    return {"antes": antes, "palavra": palavra, "depois": depois, "revista": journal, "ano": year,
            "doi": doi}


def excess_words(lang):
    """Every word of any analysis/excess-*/excess-words.csv table for `lang`."""
    found = set()
    for path in sorted(OUT.glob("excess-*/excess-words.csv")):
        found |= {row["word"] for row in read_csv(path) if row["lang"] == lang}
    return found


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


# --- build -------------------------------------------------------------------------------------

def shards(entries):
    """initial -> {word: entry}, every initial present (empty shards included)."""
    found = {letter: {} for letter in INITIALS}
    for word in sorted(entries):
        found[initial(word)][word] = entries[word]
    return found


def write_shards(prefix, entries):
    sizes = {}
    for letter, part in shards(entries).items():
        sizes[letter] = write_json(f"{prefix}/{letter}.json", part)
    largest = max(sizes, key=sizes.get)
    log(f"{prefix}: {len(entries)} words, {sum(sizes.values()) / 1024:.0f} KB in {len(sizes)} "
        f"shards, largest {largest}.json {sizes[largest] / 1024:.0f} KB")
    return sizes


def build():
    year_index = ANOS.index(LAST_FULL)
    shifts = {lang: experiment(lang) for lang in LANGS}
    # The words other screens link to (an excess word of the map, a marker of the X-ray, a word a
    # model inserts) stay in the index even when rarer than MIN_ABSTRACTS.
    linked = {lang: excess_words(lang) | set(markers(lang)) | set(shifts[lang]) for lang in LANGS}
    found, classes, n2025 = {}, {}, {}
    for lang in LANGS:
        found[lang] = all_series(lang, extra=linked[lang])
        classes[lang] = labels(lang)
        n2025[lang] = {word: values["n"][year_index] or 0 for word, values in found[lang].items()}
        log(f"{lang}: {len(found[lang])} words in the index")
    chosen = defaults(classes, n2025)
    write_json("palavras/padrao.json", chosen)

    wanted = {}
    for lang in LANGS:
        default_words = {key.rsplit(".", 1)[0] for key in chosen["padrao"] + chosen["sugestoes"]
                         if key.endswith(f".{lang}")}
        wanted[lang] = (linked[lang] | default_words) & set(found[lang])
        log(f"{lang}: {len(wanted[lang])} words get sentences in context")
    sentences_found = contexts(wanted)

    for lang in LANGS:
        rank = excess_rank(lang)
        pairs = counterparts(lang, n2025)
        levels = marker_levels(lang)
        rows = sorted(found[lang], key=lambda w: (-n2025[lang][w], w))
        write_json(f"palavras/{lang}/indice.json", {
            "anos": ANOS,
            "palavras": [[w, n2025[lang][w], classes[lang].get(w), rank.get(w)] for w in rows]})
        entries = {}
        for word, values in found[lang].items():
            entry = {**values, "par": pairs.get(word)}
            if word in levels:
                entry["nivel"] = levels[word]
            if word in wanted[lang]:
                entry["contexto"] = sentences_found[lang][word]
            if word in shifts[lang]:
                entry["experimento"] = shifts[lang][word]
            entries[word] = entry
        write_shards(f"palavras/{lang}", entries)
        write_shards(f"palavras/{lang}/areas", area_series(lang, set(found[lang])))


# --- check -------------------------------------------------------------------------------------

def load(name):
    return json.loads((SITE / name).read_text(encoding="utf-8"))


def load_shards(prefix, problems):
    """word -> entry over the 27 shards under `prefix`, noting shards that do not parse and words
    in the wrong shard."""
    found = {}
    for letter in INITIALS:
        try:
            part = load(f"{prefix}/{letter}.json")
        except (OSError, ValueError) as error:
            problems.append(f"{prefix}/{letter}.json: {error}")
            continue
        for word, entry in part.items():
            if initial(word) != letter:
                problems.append(f"{prefix}/{letter}.json: {word} in the wrong shard")
            found[word] = entry
    return found


def check_series(name, values, problems):
    lengths = {key: len(values.get(key) or ()) for key in ("n", "obs", "esp")}
    if lengths != {"n": len(ANOS), "obs": len(ANOS), "esp": ANOS[-1] - PRE_LLM[0] + 1}:
        problems.append(f"{name}: series of lengths {lengths}")


def check_excess(lang, words, excess, problems):
    """obs, esp and n of the last full year against analysis/excess-fixed/excess-words.csv."""
    year = ANOS.index(LAST_FULL)
    for word, row in excess.get((lang, LAST_FULL), {}).items():
        entry = words.get(word)
        if entry is None:
            problems.append(f"{word}.{lang}: excess word of {LAST_FULL} not in the shards")
            continue
        obs, esp = entry["obs"][year], entry["esp"][LAST_FULL - PRE_LLM[0]]
        # The CSV rounds to 6 decimals and the site to 7, so they may differ by 5.5e-7.
        if abs(obs - row["p"]) > 6e-7 or abs(esp - row["q"]) > 6e-7:
            problems.append(f"{word}.{lang}: {LAST_FULL} obs/esp {obs}/{esp}, analysis "
                            f"{row['p']}/{row['q']}")
        if entry["n"][year] != int(row["count"]):
            problems.append(f"{word}.{lang}: {LAST_FULL} n {entry['n'][year]}, analysis "
                            f"{row['count']}")


def check_base(lang, words, problems):
    """base against the 2021-22 share of the map (mapa/<lang>-todas.json), measured in the same
    frame of the last full year."""
    try:
        points = load(f"mapa/{lang}-todas.json")["pontos"]
    except (OSError, ValueError, KeyError) as error:
        problems.append(f"mapa/{lang}-todas.json: {error}")
        return
    wrong = [row[0] for row in points
             if row[0] in words and abs((words[row[0]].get("base") or 0) - row[1]) > 1e-7]
    if wrong:
        problems.append(f"palavras/{lang}: base differs from the map's 2021-22 share for "
                        f"{len(wrong)} words ({', '.join(wrong[:5])})")


def check():
    """Problems in the written files: shards that do not parse or do not match the index, series
    of the wrong length, 2025 values that differ from analysis/excess-fixed/excess-words.csv, a
    base that differs from the map's, and counterparts or default words missing from an index."""
    problems, indices, words = [], {}, {}
    excess = excess_rows("fixed")
    year = ANOS.index(LAST_FULL)
    for lang in LANGS:
        try:
            rows = load(f"palavras/{lang}/indice.json")["palavras"]
            indices[lang] = {row[0]: row for row in rows}
        except (OSError, ValueError, KeyError) as error:
            problems.append(f"palavras/{lang}/indice.json: {error}")
            continue
        words[lang] = load_shards(f"palavras/{lang}", problems)
        areas = load_shards(f"palavras/{lang}/areas", problems)
        if set(words[lang]) != set(indices[lang]):
            differ = len(set(words[lang]) ^ set(indices[lang]))
            problems.append(f"palavras/{lang}: {differ} words differ between index and shards")
        if set(areas) - set(indices[lang]):
            problems.append(f"palavras/{lang}/areas: {len(set(areas) - set(indices[lang]))} words "
                            "outside the index")
        for word, entry in words[lang].items():
            check_series(f"{word}.{lang}", entry, problems)
            if word in indices[lang] and entry["n"][year] != indices[lang][word][1]:
                problems.append(f"{word}.{lang}: index and shard disagree on {LAST_FULL}")
        for word, by_area in areas.items():
            for area, values in by_area.items():
                check_series(f"{word}.{lang} ({area})", values, problems)
        check_excess(lang, words[lang], excess, problems)
        check_base(lang, words[lang], problems)
    for lang, found in words.items():
        other = indices.get(OTHER[lang], {})
        for word, entry in found.items():
            pair, _, pair_lang = (entry.get("par") or "").rpartition(".")
            if entry.get("par") and (pair_lang != OTHER[lang] or pair not in other):
                problems.append(f"{word}.{lang}: par {entry['par']} not in the other index")
    try:
        chosen = load("palavras/padrao.json")
        for key in chosen["padrao"] + chosen["sugestoes"]:
            word, lang = key.rsplit(".", 1)
            if word not in indices.get(lang, {}):
                problems.append(f"palavras/padrao.json: {key} not in the index")
    except (OSError, ValueError, KeyError) as error:
        problems.append(f"palavras/padrao.json: {error}")
    return problems
