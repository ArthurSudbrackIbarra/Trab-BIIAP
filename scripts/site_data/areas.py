"""dados/areas.json: the fields of knowledge, year by year.

For each language, SciELO area and year:

    parcela    share of the abstracts with at least one marker word, in the year's frame (the
               balanced panel of 2021, 2022 and the year, as in comum.Frame) restricted to the
               area's journals, standardized to that frame's 2021-2022 abstract lengths as
               excess.marker_gap does
    indice     that share over the mean of the 2021 and 2022 shares of the same frame
    resumos    abstracts of the year in the frame
    minimo     the cross-fitted lower bound of `excess.py report` and its standard error
               (minimo_ep); null in the years where neither half of the corpus picked more than one
               marker word (minimo_sem_marcadoras)
    top        from 2023 on, the excess words of the year (fixed rule) with the largest ratio in the
               area's frame

The marker words are the cross-fitted sets of MARKER_YEAR in analysis/report.json: each abstract
is checked against the set picked on the half of the corpus its DOI is not in, as in the lower
bound and in scripts/pairs.py. The same is computed over every journal, under "todas".
"""

import json
import math
from bisect import bisect_right
from collections import Counter, defaultdict

from excess import AREA_MIN, BOUND_YEARS, balanced_panel, half_of, length_weights, standardized
from site_data.comum import (AREAS, ANOS, LANGS, LAST_FULL, PRE_LLM, SITE, YEARS, area_journals,
                             corpus, excess_rows, frame_years, log, report, share, write_json)
from site_data.mapa import edges, frame

MARKER_YEAR = LAST_FULL
TOP, TOP_MIN = 5, 5  # words per area and year, and abstracts with the word in the area that year
INDEX_DIGITS = 4
# A cross-fitted lower bound needs a marker set of at least this many words in one half. With one
# word or none (Portuguese in 2023 and 2024: autores, destacando) it measures that word, not LLMs.
BOUND_MIN_MARKERS = 2


def marker_sets(lang):
    """Half of an abstract's DOI -> the cross-fitted MARKER_YEAR set picked on the other half."""
    picked = report()["crossfit_markers"][lang][str(MARKER_YEAR)]
    return {"a": set(picked["b"]), "b": set(picked["a"])}


def cells(lang):
    """Year -> [(journal, length bin, has a marker word)] for every usable abstract of `lang`."""
    groups, bins, sets = corpus(), edges(lang), marker_sets(lang)
    return {year: [(r["journal"], bisect_right(bins, len(r["words"])),
                    not sets[half_of(r["doi"])].isdisjoint(r["words"])) for r in groups[lang, year]]
            for year in YEARS}


def marker_share(found, year, journals):
    """(share of `year`, mean share of 2021 and 2022, abstracts of `year`) in the frame of `year`
    restricted to `journals`, or None when the frame is empty. `found`: the output of cells()."""
    years = frame_years(year)
    sizes, counts = Counter(), defaultdict(Counter)
    for y in years:
        for journal, cell_bin, marked in found[y]:
            if journal in journals:
                sizes[y, cell_bin] += 1
                counts[y, cell_bin]["*"] += marked
    weights = length_weights(sizes, years, *PRE_LLM)
    if not weights:
        return None
    shares = {y: standardized("*", y, sizes, counts, weights)[0] for y in years}
    return shares[year], sum(shares[y] for y in PRE_LLM) / 2, sum(sizes[year, b] for b in weights)


def index_rows(lang, by_area):
    """Area slug (and None for every journal) -> {parcela, indice, resumos}, one value per year."""
    found, groups = cells(lang), corpus()
    rows = {area: {"parcela": [], "indice": [], "resumos": []} for area in (None, *by_area)}
    for year in YEARS:
        panel = balanced_panel(groups, lang, frame_years(year))
        for area, row in rows.items():
            result = marker_share(found, year, panel if area is None else panel & by_area[area])
            value, base, abstracts = result or (None, None, 0)
            row["parcela"].append(share(value))
            row["indice"].append(round(value / base, INDEX_DIGITS) if base else None)
            row["resumos"].append(abstracts)
    return rows


def bound_rows(cells_by_year, skip=()):
    """Year -> {gap, se} cells of report.json as two arrays over every year (None outside
    BOUND_YEARS, in the years of `skip` and where the report has nothing or fewer than AREA_MIN
    abstracts)."""
    gap, se = [], []
    for year in YEARS:
        cell = cells_by_year.get(str(year)) if year in BOUND_YEARS and year not in skip else None
        usable = cell is not None and cell["abstracts"] >= AREA_MIN
        gap.append(share(cell["gap"]) if usable else None)
        se.append(share(cell["se"]) if usable else None)
    return gap, se


def without_markers(analysis, lang):
    """The years of BOUND_YEARS in which neither half of the corpus picked BOUND_MIN_MARKERS marker
    words: there is no lower bound for them."""
    return [year for year in BOUND_YEARS
            if max(analysis["bound"][lang][str(year)]["markers"].values()) < BOUND_MIN_MARKERS]


def top_words(lang, journals, excess):
    """Year (from 2023) -> up to TOP [word, ratio] of the year's excess words (`excess`, fixed
    rule) with the largest ratio above 1 in the frame restricted to `journals`, each in at least
    TOP_MIN of the frame's abstracts that year."""
    found = {}
    for year in BOUND_YEARS:
        area, ranked = frame(lang, year, journals), []
        for word in excess.get((lang, year), {}) if area else ():
            if area.count(word) >= TOP_MIN:
                ratio = area.observed(word) / area.expected(word)
                if ratio > 1:
                    ranked.append((-ratio, word))
        found[str(year)] = [[word, round(-ratio, 2)] for ratio, word in sorted(ranked)[:TOP]]
    return found


def build():
    journals = area_journals()
    by_area = {slug: journals[slug] for slug in AREAS.values()}
    analysis, excess = report(), excess_rows("fixed")
    keys = ("indice", "parcela", "resumos", "minimo", "minimo_ep")
    out = {"anos": ANOS, "areas": list(by_area),
           **{key: {lang: {} for lang in LANGS} for key in (*keys, "top")},
           "todas": {key: {} for key in keys}, "marcadoras": {}, "minimo_sem_marcadoras": {}}
    for lang in LANGS:
        log(f"areas: {lang}")
        for area, row in index_rows(lang, by_area).items():
            for key, values in row.items():
                if area is None:
                    out["todas"][key][lang] = values
                else:
                    out[key][lang][area] = values
        skip = out["minimo_sem_marcadoras"][lang] = without_markers(analysis, lang)
        whole = {year: result["crossfit"] for year, result in analysis["bound"][lang].items()
                 if result["crossfit"]}
        out["todas"]["minimo"][lang], out["todas"]["minimo_ep"][lang] = bound_rows(whole, skip)
        for name, slug in AREAS.items():
            bound = bound_rows(analysis["areas"][lang].get(name, {}), skip)
            out["minimo"][lang][slug], out["minimo_ep"][lang][slug] = bound
            out["top"][lang][slug] = top_words(lang, by_area[slug], excess)
        sets = marker_sets(lang)
        out["marcadoras"][lang] = len(sets["a"] | sets["b"])
    write_json("areas.json", out)


def check():
    """todas.minimo against report.json's cross-fitted bound, each area's minimo against
    report.json's areas (null in the years without markers), and the 2021 and 2022 indices of
    every row averaging 1."""
    path = SITE / "areas.json"
    if not path.exists():
        return ["areas: areas.json is missing"]
    data, analysis, problems = json.loads(path.read_text(encoding="utf-8")), report(), []
    names = {slug: name for name, slug in AREAS.items()}
    first, second = (YEARS.index(y) for y in PRE_LLM)
    for lang in LANGS:
        skip = without_markers(analysis, lang)
        if data.get("minimo_sem_marcadoras", {}).get(lang) != skip:
            problems.append(f"areas {lang}: minimo_sem_marcadoras should be {skip}")
        for year in BOUND_YEARS:
            cross = None if year in skip else analysis["bound"][lang][str(year)]["crossfit"]
            site = data["todas"]["minimo"][lang][YEARS.index(year)]
            if (cross is None) != (site is None) or (cross and abs(site - cross["gap"]) > 1e-7):
                problems.append(f"areas {lang} {year}: todas.minimo {site}, report.json "
                                f"{cross and cross['gap']}")
        for slug in data["areas"]:
            cells_by_year = analysis["areas"][lang].get(names[slug], {})
            for year in BOUND_YEARS:
                cell = None if year in skip else cells_by_year.get(str(year))
                site = data["minimo"][lang][slug][YEARS.index(year)]
                if (cell is None) != (site is None) or (cell and abs(site - cell["gap"]) > 1e-7):
                    problems.append(f"areas {lang} {slug} {year}: minimo {site}, report.json "
                                    f"{cell and cell['gap']}")
        rows = {"todas": data["todas"]["indice"][lang], **data["indice"][lang]}
        for name, values in rows.items():
            pair = (values[first], values[second])
            if None not in pair and not math.isclose(sum(pair) / 2, 1, abs_tol=10 ** -INDEX_DIGITS):
                problems.append(f"areas {lang} {name}: indices of 2021 and 2022 average "
                                f"{sum(pair) / 2}, not 1")
    return problems
