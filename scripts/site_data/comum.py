"""Shared pieces of the site data build: paths, the corpus, labels, marker words and the yearly
frames in which every word's share is measured.

A frame is the analysis's comparison for one target year Y (scripts/excess.py, fixed rule): the
balanced panel of journals with at least PANEL_MIN abstracts in the language in 2021, 2022 and Y,
with frequencies standardized to that panel's 2021-2022 abstract lengths and Kobak et al.'s
(a+1)/(b+1) smoothing. For 2021 and 2022 the frame is the panel of those two years. So the share of
a word in 2025 and its expected value are exactly the p and q of analysis/excess-fixed, for every
word and not only the excess ones; the years before 2021 are measured the same way, against the
2021-2022 lengths of their own panel.
"""

import csv
import gzip
import html
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from functools import lru_cache
from pathlib import Path

from crosslang import CROSS, OTHER, marker_words, tokens
from excess import (CORPUS, LABELS, LANGS, OUT, PANEL_MIN, PRE_LLM, YEARS, balanced_panel,
                    by_language_year, frequencies, length_edges, length_weights, load_corpus,
                    read_excess, read_labels)
from harvest_scielo import RAW, ROOT, log, read_jsonl

SITE = ROOT / "site" / "public" / "dados"
REPORT = OUT / "report.json"
FIRST, LAST = YEARS[0], YEARS[-1]
ANOS = list(YEARS)
LAST_FULL = LAST - 1  # 2026 is partial
# SciELO area (as the analysis names it) -> slug used by the site; names are in site/src/i18n.
AREAS = {
    "Agricultural Sciences": "agrarias",
    "Biological Sciences": "biologicas",
    "Health Sciences": "saude",
    "Exact and Earth Sciences": "exatas",
    "Human Sciences": "humanas",
    "Applied Social Sciences": "sociais",
    "Engineering": "engenharias",
    "Linguistics, Letters and Arts": "linguistica",
}
CLASSES = {"style": "estilo", "content": "conteudo", "ambiguous": "sem-classe"}
MIN_MONTH = 100  # abstracts in a month of the partial year for that month to count as covered


def write_json(name, value):
    """Write site/public/dados/<name> as compact JSON and log its size."""
    path = SITE / name
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    path.write_text(text, encoding="utf-8")
    size = len(text.encode("utf-8"))
    log(f"wrote {path.relative_to(ROOT)} ({size / 1024:.0f} KB)")
    return size


def share(value, digits=7):
    """A share (0 to 1) rounded for the site, or None."""
    return None if value is None else round(value, digits)


def journals():
    """ISSN code -> {title, areas (site slugs)}. A journal may sit in two areas."""
    found = {}
    for journal in read_jsonl(RAW / "journals.jsonl"):
        info = {"title": journal["title"], "areas": [AREAS[a] for a in journal["areas"] if a in AREAS]}
        for code in {journal["code"], *journal.get("issns", [])}:
            found[code] = info
    return found


def area_journals():
    """Site area slug -> set of journal codes."""
    found = defaultdict(set)
    for journal in read_jsonl(RAW / "journals.jsonl"):
        for area in journal["areas"]:
            if area in AREAS:
                found[AREAS[area]].add(journal["code"])
    return found


def labels(lang):
    """Word -> estilo, conteudo or sem-classe: the author's label where there is one, else Claude's."""
    found = read_labels(LABELS / f"claude-{lang}.csv") | read_labels(LABELS / f"author-{lang}.csv")
    return {word: CLASSES[label] for word, label in found.items()}


def excess_rows(variant="fixed"):
    """(lang, year) -> {word: row} for the widespread excess words of analysis/excess-<variant>."""
    return read_excess(variant)


def excess_rank(lang, year=LAST_FULL):
    """Word -> position (1 = largest gap) among the widespread excess words of `year`, fixed rule."""
    rows = excess_rows("fixed").get((lang, year), {})
    ordered = sorted(rows.values(), key=lambda row: -row["gap"])
    return {row["word"]: index for index, row in enumerate(ordered, 1)}


def markers(lang):
    """The site's marker words: the excess style words of 2024-2026 under either baseline (the H3
    set, the same the experiment analysis uses), word -> highest excess ratio."""
    return marker_words(lang)


def marker_level(ratio):
    """Highlight step 1 to 4 for a marker word, from its excess ratio rounded to two decimals as the
    site shows it, so a word shown as 1.50 is never on the step below 1.5 (legend: grew a little to
    grew a lot)."""
    ratio = round(ratio, 2)
    return 1 if ratio < 1.5 else 2 if ratio < 2.5 else 3 if ratio < 5 else 4


def marker_levels(lang):
    """Word -> highlight step of every marker word, from its highest ratio of 2024-2026 under either
    baseline: the one level marcadoras.json and the word shards (palavras/) both carry."""
    return {word: marker_level(ratio) for word, ratio in markers(lang).items()}


@lru_cache(maxsize=None)
def _translations(lang):
    """Claude's translations of `lang`'s markers and controls, and the other language's markers by
    dictionary form, as scripts/crosslang.py compare reads them."""
    other = OTHER[lang]
    lemmas = read_sheet(CROSS / f"lemmas-{other}.csv")
    targets = defaultdict(set)  # a dictionary form -> the other language's markers that have it
    for word in markers(other):
        for form in {word, lemmas.get(word, {}).get("lemma", "").lower()} - {""}:
            targets[form].add(word)
    return read_sheet(CROSS / f"translations-{lang}.csv"), targets


def counterpart(word, lang, index):
    """The other language's marker that Claude's translation of `word` points to (H3), or None: the
    word panel's 'par' and the map's pair.

    As in scripts/crosslang.py compare, a token of a translation points to the other language's
    markers whose surface form or dictionary form it is. The translations are read in the order
    Claude gave them (the first is the main sense), and the first token that points to a marker of
    `index` gives the counterpart: among that token's markers, the one in most abstracts in 2025
    (delve, delves and delving share a dictionary form), ties in alphabetical order. So aprofunda
    ("deepen, explore, delve into") gets explores and abrangente gets comprehensive. A word whose
    translations point to no marker has none: out of context Claude's first sense can be the wrong
    one (cerca became fence). `index`: the other language's word -> abstracts in 2025.
    """
    translations, targets = _translations(lang)
    if word not in translations:
        return None
    for entry in translations[word]["translations"].split(","):
        for token in sorted(tokens(entry), key=entry.lower().find):
            hits = [hit for hit in targets.get(token, ()) if hit in index]
            if hits:
                return min(hits, key=lambda hit: (-index[hit], hit))
    return None


def report():
    return json.loads(REPORT.read_text(encoding="utf-8"))


def partial_month(records):
    """Last month of the final year with at least MIN_MONTH usable abstracts."""
    months = Counter(r["month"] for r in records
                     if r["status"] == "ok" and r["year"] == LAST and r["month"])
    covered = [month for month, count in months.items() if count >= MIN_MONTH]
    return max(covered) if covered else 12


_GROUPS = {}


def corpus():
    """Usable Crossref abstracts grouped by (lang, year), with their words. Loaded once."""
    if "groups" not in _GROUPS:
        log("loading the corpus")
        records = load_corpus(with_words=True)
        _GROUPS["records"] = records
        _GROUPS["groups"] = by_language_year(records)
    return _GROUPS["groups"]


def records():
    corpus()
    return _GROUPS["records"]


def frame_years(year):
    return PRE_LLM if year in PRE_LLM else (*PRE_LLM, year)


class Frame:
    """One target year's comparison: per word, its smoothed share in the target year and, for
    2023 on, its expected share and the 2021 and 2022 shares it extrapolates from."""

    def __init__(self, groups, lang, year, journals, edges):
        self.year = year
        years = frame_years(year)
        sizes, counts = frequencies(groups, lang, years, journals, edges)
        weights = length_weights(sizes, years, *PRE_LLM)
        self.abstracts = sum(sizes[year, b] for b in weights)
        self.journals = len(journals) if journals is not None else None
        self.shares, self.counts, self.totals = {}, {}, {}
        for y in years:
            total = sum(sizes[y, b] for b in weights)
            raw, count = defaultdict(float), Counter()
            for b, weight in weights.items():
                if sizes[y, b]:
                    for word, n in counts[y, b].items():
                        raw[word] += weight * n / sizes[y, b]
                        count[word] += n
            self.shares[y] = raw
            self.counts[y] = count
            self.totals[y] = total

    def smoothed(self, word, y):
        total = self.totals[y]
        return (self.shares[y].get(word, 0.0) * total + 1) / (total + 1) if total else None

    def count(self, word, y=None):
        return self.counts[self.year if y is None else y].get(word, 0)

    def observed(self, word):
        return self.smoothed(word, self.year)

    def expected(self, word):
        """Kobak et al.'s counterfactual from 2021 and 2022 (None for 2022 and before)."""
        if self.year <= PRE_LLM[1]:
            return None
        p1, p2 = self.smoothed(word, PRE_LLM[0]), self.smoothed(word, PRE_LLM[1])
        if p1 is None or p2 is None:
            return None
        return p2 + (self.year - PRE_LLM[1]) * max(p2 - p1, 0)

    def baseline(self, word):
        """Mean smoothed share in 2021 and 2022 within this frame."""
        values = [self.smoothed(word, y) for y in PRE_LLM]
        return None if None in values else sum(values) / 2

    def words(self):
        return set().union(*(self.counts[y] for y in self.counts))


def frames(lang, journals=None):
    """Year -> Frame for every year 2015-2026, over the balanced panels (intersected with
    `journals`, a set of codes, for one area). Years whose panel is empty are left out."""
    groups = corpus()
    edges = length_edges(groups, lang)
    found = {}
    for year in YEARS:
        panel = balanced_panel(groups, lang, frame_years(year))
        if journals is not None:
            panel &= journals
        if panel:
            found[year] = Frame(groups, lang, year, panel, edges)
    return found


def series(word, found):
    """The site's yearly series of one word over the frames `found`:
    n (abstracts with the word), obs (share), esp (expected, 2021 on; 2021 and 2022 equal obs) and
    base, the mean share of 2021 and 2022 in the frame of LAST_FULL: the level that year's expected
    value and ratio start from (obs of 2021 and 2022 come from the frame of those two years, whose
    journals differ)."""
    n = [found[y].count(word) if y in found else None for y in YEARS]
    obs = [share(found[y].observed(word)) if y in found else None for y in YEARS]
    esp = []
    for y in range(PRE_LLM[0], LAST + 1):
        if y not in found:
            esp.append(None)
        elif y <= PRE_LLM[1]:
            esp.append(obs[YEARS.index(y)])
        else:
            esp.append(share(found[y].expected(word)))
    base = share(found[LAST_FULL].baseline(word)) if LAST_FULL in found else None
    return {"n": n, "obs": obs, "esp": esp, "base": base}


def today():
    return date.today().isoformat()


def read_sheet(path, key="word"):
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as handle:
        return {row[key]: row for row in csv.DictReader(handle)}


# --- titles -------------------------------------------------------------------------------------

MARKUP = re.compile(r"</?[A-Za-z][^<>]*>")
# A soft hyphen at the start of a word is a typesetting leftover; inside a word it is mangling.
SOFT_HYPHEN = re.compile(r"(?:(?<=\s)|^)\u00ad+")
MANGLED = re.compile("[\u00ad\ufffd\u0080-\u009f]|Ã[\u0080-\u00bf]")
LETTERS = re.compile(r"[^\W\d_]+")


def drop_footnote(title):
    """The title without a footnote mark glued to its end: 1 or * after a word ("Brasil1",
    "Benth.1", "hospital*"), or 1 after a year that closes a span of years ("1999 TO 20191")."""
    if re.search(r"(?:[^\W\d_]{3}|[^\W\d_]\.)[1*]$", title):
        return title[:-1]
    year = re.search(r"\b(?:19|20)\d\d1$", title)
    if year and re.search(r"\b(?:19|20)\d\d\b", title[:year.start()]):
        return title[:-1]
    return title


def proper_forms(text):
    """Lower-case word -> its form in `text`, for the words `text` always writes with a capital
    inside a sentence (Brasil, SUS, Maceió): the names a title in capitals has lost. Nothing for a
    text in capitals."""
    letters = [char for char in text if char.isalpha()]
    if not letters or sum(char.isupper() for char in letters) >= 0.5 * len(letters):
        return {}
    forms = {}
    for match in LETTERS.finditer(text):
        before = text[:match.start()].rstrip()
        if before and before[-1] not in ".!?:":
            word = match.group()
            form = word if word != word.lower() else None
            forms[word.lower()] = form if forms.get(word.lower(), form) == form else None
    return {word: form for word, form in forms.items() if form}


def capitals(word):
    """Whether a word is written in capitals: a capital and no lower-case letter a to z. A converter
    sometimes lowered the accented letters of a title in capitals (ESPAçADOR, MóRBIDO), so those do
    not count."""
    return not re.search("[a-z]", word) and any(char.isupper() for char in word)


def in_capitals(title):
    """Whether the title is written in capitals: three quarters or more of its words of two letters
    or more are, or three words of four letters or more in a row are (short words in capitals
    between them do not break the row). So a species name or a subtitle in lower case does not
    stop it ("PROBIOTIC POTENTIAL OF Bacillus cereus AGAINST Vibrio spp."), and a few acronyms
    (HIV, SUS) do not make it."""
    words = [word for word in LETTERS.findall(title) if len(word) > 1]
    if words and sum(map(capitals, words)) >= 0.75 * len(words):
        return True
    row = longest = 0
    for word in words:
        row = row + (len(word) >= 4) if capitals(word) else 0
        longest = max(longest, row)
    return longest >= 3


def sentence_case(title, forms):
    """A title in capitals in sentence case: each word in capitals goes to lower case, or to its
    form in `forms` (proper_forms), and the first letter is a capital. Words with a lower-case
    letter (Quesnelia quesneliana), initials (L.) and a letter after a hyphen (AMIOFE-E) stay as
    they are."""
    def word(match):
        found = match.group()
        before, after = title[match.start() - 1:match.start()], title[match.end():match.end() + 1]
        if not capitals(found) or (len(found) == 1 and (after == "." or before == "-")):
            return found
        return forms.get(found.lower(), found.lower())

    title = LETTERS.sub(word, title)
    first = next(index for index, char in enumerate(title) if char.isalpha())
    return title[:first] + title[first].upper() + title[first + 1:]


def clean_title(raw, text=None):
    """A title as plain text, or None. Titles may carry markup, escaped or not (Fe<sup>2+</sup>,
    &lt;i&gt;), soft hyphens, a footnote mark (drop_footnote), capitals throughout or mangled
    encoding (then None). A title in capitals becomes sentence case, and `text`, the abstract in
    the title's language, gives back the capitals of the names it always writes with one."""
    title = MARKUP.sub("", html.unescape(html.unescape(raw or "")))
    title = unicodedata.normalize("NFC", re.sub(r"\s+", " ", SOFT_HYPHEN.sub("", title)).strip())
    if not title or MANGLED.search(title):
        return None
    title = drop_footnote(title)
    return sentence_case(title, proper_forms(text or "")) if in_capitals(title) else title


__all__ = ["AREAS", "ANOS", "CLASSES", "CORPUS", "FIRST", "LANGS", "LAST", "LAST_FULL", "OUT",
           "PANEL_MIN", "PRE_LLM", "RAW", "ROOT", "SITE", "YEARS", "Frame", "area_journals",
           "clean_title", "corpus", "counterpart", "excess_rank", "excess_rows", "frames",
           "journals", "labels", "log", "marker_level", "marker_levels", "markers", "math",
           "partial_month", "read_sheet", "records", "report", "series", "share", "today",
           "write_json", "gzip", "json"]
