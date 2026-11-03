"""dados/mapa/: the word map, every word the analysis tests in the last full year.

    mapa/<lang>-<area>.json   one point per word with at least MIN_COUNT abstracts in the year's
                              frame (area `todas` = every journal of the balanced panel)
    mapa/pares.json           each marker word and the other language's marker its translation
                              points to (the word panel's 'par'), for the side-by-side mode

A point holds the word's share in 2021-2022, its ratio and gap in YEAR and its abstracts, all
measured in the frame of YEAR (comum.Frame), so the words of the whole corpus get exactly the ratio
and gap of analysis/excess-fixed. In an area file the measures are the area's, while the excess
flag stays the one of the whole corpus (the widespread excess words of YEAR, fixed rule).
"""

import json
import random
from functools import lru_cache

from crosslang import CROSS, OTHER
from excess import MIN_COUNT, SEED, balanced_panel, length_edges
from site_data.comum import (AREAS, LANGS, LAST_FULL, SITE, Frame, area_journals, corpus,
                             counterpart, excess_rows, frame_years, labels, log, markers, share,
                             write_json)

YEAR = LAST_FULL
RATIO_DIGITS = 3
CHECKED = 20  # excess words per language the check compares with analysis/excess-fixed


@lru_cache(maxsize=None)
def edges(lang):
    """Decile edges of abstract length (distinct words) of `lang`, as the analysis uses them."""
    return length_edges(corpus(), lang)


def frame(lang, year=YEAR, journals=None):
    """The Frame of `year` over the balanced panel, restricted to `journals` (a set of codes), as
    comum.frames() builds it for every year; None when no journal is left."""
    groups = corpus()
    panel = balanced_panel(groups, lang, frame_years(year))
    if journals is not None:
        panel &= journals
    return Frame(groups, lang, year, panel, edges(lang)) if panel else None


def point(found, word, classes, excess):
    """[word, share in 2021-22, ratio, gap, abstracts, class, excess 0/1, share in YEAR]."""
    observed, expected = found.observed(word), found.expected(word)
    return [word, share(found.baseline(word)), round(observed / expected, RATIO_DIGITS),
            share(observed - expected), found.count(word), classes.get(word), int(word in excess),
            share(observed)]


def word_map(found, classes, excess):
    """The map of one frame: its size and a point per tested word, by ratio, largest first."""
    if found is None:
        return {"ano": YEAR, "resumos": 0, "revistas": 0, "pontos": []}
    tested = [word for word, count in found.counts[YEAR].items() if count >= MIN_COUNT]
    points = sorted((point(found, word, classes, excess) for word in tested),
                    key=lambda row: (-row[2], row[0]))
    return {"ano": YEAR, "resumos": found.abstracts, "revistas": found.journals, "pontos": points}


def marker_pairs(counts):
    """lang -> {marker: the other language's marker its translation points to}, by the rule of the
    word panel's 'par' (comum.counterpart): every marker with a hit in `crosslang.py compare` gets
    one, on the map or not. `counts`: lang -> word -> abstracts in YEAR over every journal."""
    found = {}
    for lang in LANGS:
        other = OTHER[lang]
        index = {word: counts[other].get(word, 0) for word in markers(other)}
        pairs = {word: counterpart(word, lang, index) for word in sorted(markers(lang))}
        found[lang] = {word: pair for word, pair in pairs.items() if pair}
    return found


def build():
    by_area = area_journals()
    counts = {}
    for lang in LANGS:
        classes = labels(lang)
        excess = set(excess_rows("fixed").get((lang, YEAR), {}))
        found = frame(lang)
        counts[lang] = found.counts[YEAR] if found else {}
        write_json(f"mapa/{lang}-todas.json", word_map(found, classes, excess))
        for slug in AREAS.values():
            write_json(f"mapa/{lang}-{slug}.json",
                       word_map(frame(lang, journals=by_area[slug]), classes, excess))
    pairs = marker_pairs(counts)
    log(f"marker pairs: {len(pairs['pt'])} pt, {len(pairs['en'])} en")
    write_json("mapa/pares.json", pairs)


def panel_pairs(lang):
    """Word -> the 'par' of the word shards (palavras/<lang>/), without the language suffix."""
    found = {}
    for path in (SITE / "palavras" / lang).glob("*.json"):
        if path.name != "indice.json":
            for word, entry in json.loads(path.read_text(encoding="utf-8")).items():
                if entry.get("par"):
                    found[word] = entry["par"].rpartition(".")[0]
    return found


def check():
    """The map's ratio, gap and share of a random sample of YEAR's excess words against
    analysis/excess-fixed; every excess word flagged; the pairs against analysis/crosslang and
    against the word panel's 'par'."""
    problems = []
    rows = excess_rows("fixed")
    for lang in LANGS:
        path = SITE / "mapa" / f"{lang}-todas.json"
        if not path.exists():
            problems.append(f"mapa: {path.name} is missing")
            continue
        points = {row[0]: row for row in json.loads(path.read_text(encoding="utf-8"))["pontos"]}
        expected = rows.get((lang, YEAR), {})
        flagged = {word for word, row in points.items() if row[6]}
        if flagged != set(expected):
            problems.append(f"mapa {lang}: {len(flagged)} words flagged as excess, "
                            f"{len(expected)} in analysis/excess-fixed")
        for word in random.Random(f"{SEED}-mapa-{lang}").sample(sorted(expected),
                                                                 min(CHECKED, len(expected))):
            row, found = expected[word], points.get(word)
            if found is None:
                problems.append(f"mapa {lang}: {word} is missing")
            elif (abs(found[2] - row["ratio"]) > 10 ** -RATIO_DIGITS
                  or abs(found[3] - row["gap"]) > 2e-6 or abs(found[7] - row["p"]) > 2e-6):
                problems.append(f"mapa {lang}: {word} has ratio {found[2]}, gap {found[3]}, "
                                f"share {found[7]}; the analysis has {row['ratio']}, {row['gap']}, "
                                f"{row['p']}")
    path = SITE / "mapa" / "pares.json"
    report = json.loads((CROSS / "report.json").read_text(encoding="utf-8"))
    if path.exists():
        pairs = json.loads(path.read_text(encoding="utf-8"))
        for lang in LANGS:
            hits = report[lang]["pairs"]
            if set(pairs[lang]) != set(hits):
                problems.append(f"mapa/pares.json {lang}: {len(pairs[lang])} words, "
                                f"analysis/crosslang has {len(hits)}")
            wrong = [word for word, match in pairs[lang].items() if match not in hits.get(word, ())]
            if wrong:
                problems.append(f"mapa/pares.json {lang}: no hit in analysis/crosslang for "
                                + ", ".join(wrong[:10]))
            panel = panel_pairs(lang)
            differ = [word for word, match in pairs[lang].items()
                      if word in panel and panel[word] != match]
            if differ:
                problems.append(f"mapa/pares.json {lang}: {len(differ)} pairs differ from the word "
                                "panel's par: " + ", ".join(differ[:10]))
    else:
        problems.append("mapa: pares.json is missing")
    return problems
