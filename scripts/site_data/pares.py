"""dados/pares/: the Portuguese and English abstracts of the same papers (the PT × EN screen).

    pares/<ano>.json         every usable paper of the ArticleMeta sample published that year,
                             with the marks of each abstract
    pares/textos-<ano>.json  the two abstracts of those papers, downloaded only when a pair opens
    pares/linha.json         per year (and per area): papers, the share in which the English
                             abstract has more marks per 100 words than the Portuguese one and the
                             reverse, and the mean marks per 100 words

The papers are those of data/interim/pairs.jsonl.gz (scripts/pairs.py prepare), with the corpus
filters applied to both abstracts. Marks are counted by `score()`, the one rule the site uses for a
text (site/DADOS.md, "Marcas num texto"): raiox.py imports it and the browser repeats it.
"""

import gzip
import html
import json
import re
import sys
import unicodedata
from collections import defaultdict

from excess import LANGS, TOKEN
from harvest_scielo import read_jsonl
from pairs import PAIRS, SOURCE
from site_data.comum import (AREAS, SITE, YEARS, clean_title, journals, log, markers, share,
                             write_json)
from textutil import TAG

LINE_DIGITS = 3  # decimals of the yearly means of marks per 100 words
# Markers whose highest excess ratio is below this do not count as marks. 0 counts every marker
# word, as site/DADOS.md says. The H3 set holds a few dozen very common words that grew only a
# little (como, entre, this, these), and they make most of the marks of any abstract; 1.5 would
# leave them out. Changing it changes every file of this step and of raiox, marcadoras.json
# included, so the browser follows; the word counts in site/DADOS.md would need updating.
MIN_RATIO = 0
_CACHE = {}  # papers, titles, journals, marker lists and scores, each loaded once


# --- marks in a text --------------------------------------------------------------------------
#
# The browser counts with
#     words: /[\p{L}]+(?:['-][\p{L}]+)*/gu        marks: /[a-zà-öø-ÿ]{4,}/g on NFC, lower case
# Python's re has no \p{L}. [^\W\d_] comes close but also takes the numeric characters that are
# not decimal digits (², ½, Ⅻ), so those are taken out of the class: what is left is exactly the
# Unicode letters, the same set \p{L} names.

def _numeric_ranges():
    """Character-class ranges of the characters [^\\W\\d_] matches that are not letters."""
    codes = [c for c in range(sys.maxunicode + 1)
             if chr(c).isnumeric() and not chr(c).isdecimal() and not chr(c).isalpha()]
    ranges, start = [], None
    for i, code in enumerate(codes):
        if start is None:
            start = code
        if i + 1 == len(codes) or codes[i + 1] != code + 1:
            last = "" if start == code else "-" + re.escape(chr(code))
            ranges.append(re.escape(chr(start)) + last)
            start = None
    return "".join(ranges)


LETTER = rf"[^\W\d_{_numeric_ranges()}]"
WORD = re.compile(rf"{LETTER}+(?:['-]{LETTER}+)*")


def marker_set(lang):
    """The words that count as marks in `lang`: word -> highest excess ratio (comum.markers, from
    MIN_RATIO up)."""
    if ("markers", lang) not in _CACHE:
        _CACHE["markers", lang] = {word: ratio for word, ratio in markers(lang).items()
                                   if ratio >= MIN_RATIO}
    return _CACHE["markers", lang]


def word_count(text):
    """Words in the text, as the site counts them: runs of letters, which an apostrophe or a hyphen
    between two letters keeps together."""
    return len(WORD.findall(text))


def marks(text, found_markers):
    """The marker words of the text, one entry per occurrence, in reading order: the analysis's
    words (four or more letters a to ÿ, in the NFC lower-case text; hyphens and digits split them)
    that are in `found_markers`."""
    words = TOKEN.findall(unicodedata.normalize("NFC", text).lower())
    return [word for word in words if word in found_markers]


def per_100(found, words):
    """100 × found / words rounded half up to two decimals (0 without words). Done in integers, so
    the browser's Math.floor((20000 * found + words) / (2 * words)) / 100 gives the same number."""
    return (20000 * found + words) // (2 * words) / 100 if words else 0.0


def score(text, found_markers):
    """{palavras, marcas, por100} of one text: words, marker occurrences and marks per 100 words.
    Every number of the site about one text comes from here or from the same rule in the browser."""
    words = word_count(text)
    found = len(marks(text, found_markers))
    return {"palavras": words, "marcas": found, "por100": per_100(found, words)}


# --- the papers -------------------------------------------------------------------------------


def papers():
    """Usable papers of the ArticleMeta sample (status ok), in file order. Loaded once."""
    if "papers" not in _CACHE:
        with gzip.open(PAIRS, "rt", encoding="utf-8") as handle:
            _CACHE["papers"] = [p for p in map(json.loads, handle) if p["status"] == "ok"]
        log(f"{len(_CACHE['papers'])} usable papers with both abstracts")
    return _CACHE["papers"]


def plain_title(text):
    """A title as plain text: markup dropped (Fe<sup>2+</sup> becomes Fe2+), entities decoded,
    runs of spaces and tabs collapsed. What the dating checks of raiox.py read."""
    text = html.unescape(TAG.sub("", text or ""))
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", text).strip())


def titles():
    """SciELO code -> {language: plain title} from the raw ArticleMeta sample. Loaded once."""
    if "titles" not in _CACHE:
        found = {}
        for row in read_jsonl(SOURCE):
            cleaned = {lang: plain_title(text) for lang, text in (row.get("titles") or {}).items()}
            found[row["code"]] = {lang: text for lang, text in cleaned.items() if text}
        _CACHE["titles"] = found
    return _CACHE["titles"]


def shown_title(paper, lang):
    """The paper's title in `lang` as the pages show it (comum.clean_title: no footnote mark, a
    title in capitals in sentence case, with the names its abstract in `lang` writes with a
    capital), or None."""
    return clean_title(titles().get(paper["code"], {}).get(lang), paper.get(f"text_{lang}"))


def title_in(paper, lang):
    """The paper's title in `lang`; failing that, in the paper's language, Portuguese, English or
    any other; None if it has none. Cleaned as the pages show it (shown_title)."""
    found = titles().get(paper["code"], {})
    for choice in dict.fromkeys((lang, paper["lang"], "pt", "en", *found)):
        title = shown_title(paper, choice)
        if title:
            return title
    return None


def area_slugs(paper):
    return [AREAS[a] for a in paper["areas"] if a in AREAS]


def journal_title(paper):
    """The SciELO title of the paper's journal (its ISSN if the journal list lacks it)."""
    if "journals" not in _CACHE:
        _CACHE["journals"] = journals()
    info = _CACHE["journals"].get(paper["journal"])
    return info["title"] if info else paper["journal"]


def scores():
    """(code, lang) -> score of that abstract, with the site's marker lists. Computed once."""
    if "scores" not in _CACHE:
        lists = {lang: set(marker_set(lang)) for lang in LANGS}
        _CACHE["scores"] = {(p["code"], lang): score(p[f"text_{lang}"], lists[lang])
                            for p in papers() for lang in LANGS}
    return _CACHE["scores"]


def article(paper):
    """One paper's entry in pares/<ano>.json."""
    found = scores()
    return {"id": paper["code"], "doi": paper["doi"], "titulo": title_in(paper, paper["lang"]),
            "titulo_en": shown_title(paper, "en"), "revista": journal_title(paper),
            "areas": area_slugs(paper), "lingua": paper["lang"],
            **{lang: found[paper["code"], lang] for lang in LANGS}}


def summary(entries):
    """linha.json's numbers for a list of pares/<ano>.json entries: papers, share where English has
    more marks per 100 words than Portuguese (and the reverse), and the mean marks per 100 words.
    Uses the rounded por100 of the entries, so the browser can recompute it from the year file."""
    n = len(entries)
    if not n:
        return {"artigos": 0} | dict.fromkeys(("en_maior", "pt_maior", "media_pt", "media_en"))
    return {"artigos": n,
            "en_maior": share(sum(e["en"]["por100"] > e["pt"]["por100"] for e in entries) / n),
            "pt_maior": share(sum(e["pt"]["por100"] > e["en"]["por100"] for e in entries) / n),
            "media_pt": round(sum(e["pt"]["por100"] for e in entries) / n, LINE_DIGITS),
            "media_en": round(sum(e["en"]["por100"] for e in entries) / n, LINE_DIGITS)}


def line(by_year):
    """linha.json: the yearly summary of every paper, then of each area's papers."""
    keys = ("artigos", "en_maior", "pt_maior", "media_pt", "media_en")

    def columns(select):
        rows = [summary([e for e in by_year[year] if select(e)]) for year in YEARS]
        return {key: [row[key] for row in rows] for key in keys}

    found = {"anos": list(YEARS)} | columns(lambda e: True)
    found["areas"] = {slug: columns(lambda e, slug=slug: slug in e["areas"])
                      for slug in AREAS.values()}
    return found


def build():
    by_year = defaultdict(list)
    for paper in papers():
        by_year[paper["year"]].append(paper)
    entries = {}
    for year in YEARS:
        chosen = sorted(by_year[year], key=lambda p: p["code"])
        entries[year] = [article(p) for p in chosen]
        write_json(f"pares/{year}.json", {"ano": year, "artigos": entries[year]})
        write_json(f"pares/textos-{year}.json",
                   {p["code"]: {lang: p[f"text_{lang}"] for lang in LANGS} for p in chosen})
    write_json("pares/linha.json", line(entries))


# --- check ------------------------------------------------------------------------------------

def recount(text, found_markers):
    """The rule of `score`, written out character by character with unicodedata instead of
    regular expressions, to check it: (words, marks)."""
    def letter(ch):
        return unicodedata.category(ch).startswith("L")

    words, i, n = 0, 0, len(text)
    while i < n:
        if not letter(text[i]):
            i += 1
            continue
        words += 1
        while i < n:  # one word: letters, and ' or - only with a letter on each side
            if letter(text[i]):
                i += 1
            elif text[i] in "'-" and i + 1 < n and letter(text[i + 1]):
                i += 1
            else:
                break
    lowered = unicodedata.normalize("NFC", text).lower()
    found, run = 0, []
    for ch in lowered + " ":
        if "a" <= ch <= "z" or "à" <= ch <= "ö" or "ø" <= ch <= "ÿ":
            run.append(ch)
        else:
            if len(run) >= 4 and "".join(run) in found_markers:
                found += 1
            run = []
    return words, found


SAMPLES = ("Fe²⁺ e ½ dose: m² por hectare, R ² = 0,9; Ⅻ congresso.",
           "Well-being, don't, auto--teste, -início, l'eau e 'aspas'.",
           "Este estudo aprofunda a análise; os resultados destacam um papel crucial.",
           "These findings underscore the pivotal role of comprehensive, robust approaches.",
           "ÉSTE ESTUDO APROFUNDA, notavelmente, a questão (aprofunda-se) em 2025.")


def check():
    """The counting rule against an independent recount, and pares/ against the papers."""
    problems = []
    lists = {lang: set(marker_set(lang)) for lang in LANGS}
    texts = [(lang, text) for text in SAMPLES for lang in LANGS]
    texts += [(lang, p[f"text_{lang}"]) for p in papers()[::400] for lang in LANGS]
    for lang, text in texts:
        found = score(text, lists[lang])
        words, counted = recount(text, lists[lang])
        if (found["palavras"], found["marcas"]) != (words, counted):
            problems.append(f"pares: count {found['palavras']}/{found['marcas']} against recount "
                            f"{words}/{counted} for {text[:60]!r}")
    by_code = {p["code"]: p for p in papers()}
    for year in YEARS:
        path = f"pares/{year}.json"
        try:
            entries = json.loads((SITE / path).read_text(encoding="utf-8"))["artigos"]
            texts = json.loads((SITE / f"pares/textos-{year}.json").read_text(encoding="utf-8"))
        except FileNotFoundError:
            problems.append(f"pares: {path} missing")
            continue
        expected = sum(p["year"] == year for p in papers())
        if len(entries) != expected or set(texts) != {e["id"] for e in entries}:
            problems.append(f"pares: {path} has {len(entries)} papers, the sample {expected}")
        for entry in entries[::50]:
            for lang in LANGS:
                if score(texts[entry["id"]][lang], lists[lang]) != entry[lang]:
                    problems.append(f"pares: {entry['id']} {lang} score differs from its text")
                if texts[entry["id"]][lang] != by_code[entry["id"]][f"text_{lang}"]:
                    problems.append(f"pares: {entry['id']} {lang} text differs from the sample")
    return problems
