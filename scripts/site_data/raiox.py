"""dados/marcadoras.json and dados/jogo.json: what the X-ray and the before-or-after game need.

marcadoras.json holds every marker word with its excess ratio, highlight level and class; the marks
per 100 words of every abstract of 2019 and of 2025 in the pair sample, sorted (the "honest
comparison"); one real abstract of each of those years to try the X-ray with; and the abstracts of
2019 to 2021 with the most marks, to show that a text written before ChatGPT can score as high as
the one pasted.

jogo.json holds the game's abstracts: per language, GAME_EACH from 2019-2021 and GAME_EACH from
2024-2025, drawn with a fixed seed from the pair sample, none whose texts or titles give the date
away (COVID-19, ChatGPT, a year from 2020 on...), and no paper in both languages. The rule that only
counts marker words says "after" when an abstract's marks per 100 words pass the median of that
language's game abstracts.

Every text is scored by pares.score(), the rule the browser repeats (site/DADOS.md).
"""

import json
import random
import re
import statistics
import unicodedata

from excess import LANGS, SEED
from site_data.comum import LAST_FULL, SITE, labels, log, marker_level, marker_levels, write_json
from site_data.palavras import load_shards
from site_data.pares import (area_slugs, journal_title, marker_set, marks, papers, recount, score,
                             scores, title_in, titles, word_count)

HIST_YEARS = (2019, LAST_FULL)  # the X-ray's histograms: a year before ChatGPT, the last full one
EXAMPLE_WORDS = (120, 250)  # length of the two example abstracts
HIGH = 0.9  # the 2025 example sits at this quantile of the 2025 scores; the 2019 one at the median
SIMILAR, SIMILAR_YEARS, SIMILAR_MIN_WORDS = 30, (2019, 2020, 2021), 80
GAME_EACH, GAME_WORDS = 20, (80, 260)  # abstracts per language and period; words per abstract
PERIODS = {"antes": (2019, 2020, 2021), "depois": (2024, 2025)}
# Topics that date an abstract by themselves. Checked on every text and title of the paper.
TOPIC = re.compile(r"covid|coronav|sars[- ]?cov|pand[eê]mi|lockdown|isolamento social|"
                   r"social isolation|distanciamento social|social distancing|chat-?gpt|\bgpt|"
                   r"\bllms?\b|large language model|modelos? de linguagem|"
                   r"intelig[eê]ncia artificial generativa|\bia generativa|generative ai\b|"
                   r"generative artificial intelligence", re.I)
LATE_YEAR = re.compile(r"(?<!\d)20[2-9]\d(?!\d)")  # a year from 2020 on, cited in the text


def marker_table(lang):
    """Word -> [ratio (2 decimals), highlight level 1 to 4, class], in alphabetical order. The
    level is comum.marker_levels', the one the word shards carry too."""
    found, classes, levels = marker_set(lang), labels(lang), marker_levels(lang)
    return {word: [round(ratio, 2), levels[word], classes.get(word)]
            for word, ratio in sorted(found.items())}


def abstracts(lang, years):
    """(paper, text, score) of the `lang` abstracts of the pair sample published in `years`."""
    found = scores()
    return [(p, p[f"text_{lang}"], found[p["code"], lang]) for p in papers() if p["year"] in years]


def quantile(values, q):
    """The q-quantile of `values` by the nearest rank."""
    ordered = sorted(values)
    return ordered[min(int(q * len(ordered)), len(ordered) - 1)]


def source(paper, lang):
    """Where an abstract comes from, for the line under it on the page."""
    return {"titulo": title_in(paper, lang), "revista": journal_title(paper),
            "ano": paper["year"], "doi": paper["doi"], "areas": area_slugs(paper)}


def paper_texts(paper):
    """Every text of a paper that could date it: both abstracts and every title."""
    return [paper["text_pt"], paper["text_en"], *titles().get(paper["code"], {}).values()]


def dated_by_topic(paper):
    """True if a text or title of the paper names a topic that dates it (years not checked)."""
    return any(TOPIC.search(text) for text in paper_texts(paper))


def gives_date_away(paper):
    """True if a text or title of the paper names a topic or a year that dates it."""
    return any(TOPIC.search(text) or LATE_YEAR.search(text) for text in paper_texts(paper))


def closest(rows, target):
    """The row whose score is closest to `target` (ties by DOI, so the choice is fixed)."""
    return min(rows, key=lambda row: (abs(row[2]["por100"] - target), row[0]["doi"]))


def example(lang, year, target):
    """The X-ray's example abstract of `year`: the one of EXAMPLE_WORDS words, on no dating topic,
    whose marks per 100 words are closest to `target`."""
    paper, text, found = closest(
        [row for row in abstracts(lang, (year,))
         if EXAMPLE_WORDS[0] <= row[2]["palavras"] <= EXAMPLE_WORDS[1]
         and not dated_by_topic(row[0])], target)
    return {"texto": text, **source(paper, lang), "por100": found["por100"]}


def similar(lang):
    """The SIMILAR abstracts of SIMILAR_YEARS with the most marks per 100 words (at least
    SIMILAR_MIN_WORDS words, so that a short text with two marks does not lead the list)."""
    rows = [row for row in abstracts(lang, SIMILAR_YEARS)
            if row[2]["palavras"] >= SIMILAR_MIN_WORDS]
    rows.sort(key=lambda row: (-row[2]["por100"], row[0]["doi"]))
    return [{"por100": found["por100"], "texto": text, **source(paper, lang)}
            for paper, text, found in rows[:SIMILAR]]


def markers_file():
    """marcadoras.json: the marker tables, then per language the sorted scores of HIST_YEARS (the
    page draws its histogram from them), examples and the high-scoring abstracts of before
    ChatGPT."""
    tables = {lang: marker_table(lang) for lang in LANGS}
    found = dict(tables)
    found["hist"], found["exemplos"], found["parecidos"] = {}, {}, {}
    for lang in LANGS:
        values = {year: sorted(row[2]["por100"] for row in abstracts(lang, (year,)))
                  for year in HIST_YEARS}
        hist = {f"n{year}": len(values[year]) for year in HIST_YEARS}
        hist["ordenados"] = {str(year): values[year] for year in HIST_YEARS}
        found["hist"][lang] = hist
        before, after = HIST_YEARS
        medians = {year: statistics.median(values[year]) for year in HIST_YEARS}
        found["exemplos"][lang] = {
            str(before): example(lang, before, medians[before]),
            str(after): example(lang, after, quantile(values[after], HIGH))}
        found["parecidos"][lang] = similar(lang)
        log(f"{lang}: {len(tables[lang])} markers, median marks per 100 words "
            f"{medians[before]} in {before} and {medians[after]} in {after}")
    return found


# --- the game ---------------------------------------------------------------------------------

def game_pool(lang, years, taken):
    """Papers of `years` whose `lang` abstract can go into the game, sorted by code."""
    pool = [p for p in papers() if p["year"] in years and p["code"] not in taken
            and GAME_WORDS[0] <= word_count(p[f"text_{lang}"]) <= GAME_WORDS[1]
            and not gives_date_away(p)]
    return sorted(pool, key=lambda p: p["code"])


def median(values):
    """The median of two-decimal scores, to three decimals (the mean of the middle two is exact
    there; the rounding only drops floating-point noise)."""
    return round(statistics.median(values), 3)


def rule_hits(items, threshold):
    """How many items the marker-only rule gets right: 'depois' above the threshold, else
    'antes'."""
    return sum((item["por100"] > threshold) == (item["periodo"] == "depois") for item in items)


def game_file():
    """jogo.json: the drawn abstracts, the rule's threshold per language and how often the rule
    is right."""
    rng = random.Random(f"{SEED}-jogo")
    found_markers = {lang: set(marker_set(lang)) for lang in LANGS}
    items, taken = [], set()
    for lang in LANGS:
        for period, years in PERIODS.items():
            pool = game_pool(lang, years, taken)
            for paper in rng.sample(pool, GAME_EACH):
                taken.add(paper["code"])
                text = paper[f"text_{lang}"]
                found = score(text, found_markers[lang])
                items.append({"id": paper["code"], "lingua": lang, "texto": text,
                              "ano": paper["year"], "periodo": period,
                              **{k: v for k, v in source(paper, lang).items() if k != "ano"},
                              "marcas": marks(text, found_markers[lang]),
                              "palavras": found["palavras"], "por100": found["por100"]})
            log(f"game {lang} {period}: {GAME_EACH} of {len(pool)} eligible abstracts")
    threshold = {lang: median([i["por100"] for i in items if i["lingua"] == lang])
                 for lang in LANGS}
    rule = {}
    for lang in LANGS:
        chosen = [i for i in items if i["lingua"] == lang]
        rule[lang] = {"acertos": rule_hits(chosen, threshold[lang]), "total": len(chosen)}
        log(f"game {lang}: threshold {threshold[lang]}, the marker-only rule gets "
            f"{rule[lang]['acertos']} of {len(chosen)} right")
    rng.shuffle(items)
    return {"limiar": threshold, "regra": rule, "resumos": items}


def build():
    write_json("marcadoras.json", markers_file())
    write_json("jogo.json", game_file())


# --- check ------------------------------------------------------------------------------------

# Plain substrings for the check, written apart from TOPIC on purpose.
GIVEAWAYS = ("covid", "coronav", "sars-cov", "sars cov", "pandemi", "pandêmi", "lockdown",
             "isolamento social", "social isolation", "distanciamento social", "social distancing",
             "chatgpt", "gpt", "llm", "language model", "modelo de linguagem",
             "modelos de linguagem", "inteligência artificial generativa", "ia generativa",
             "generative ai")


def gives_away(text):
    return any(term in text.lower() for term in GIVEAWAYS)


def late_year(text):
    return any(len(run) == 4 and 2020 <= int(run) <= 2099 for run in re.findall(r"\d+", text))


def check():
    """marcadoras.json and jogo.json against the marker lists, the pair sample and the rules."""
    problems = []
    try:
        found = json.loads((SITE / "marcadoras.json").read_text(encoding="utf-8"))
        game = json.loads((SITE / "jogo.json").read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        return [f"raiox: {error.filename} missing"]
    lists = {lang: set(marker_set(lang)) for lang in LANGS}
    for lang in LANGS:
        if set(found[lang]) != lists[lang]:
            problems.append(f"raiox: marcadoras {lang} differs from the marker list")
        if any(level != marker_level(ratio) for ratio, level, _ in found[lang].values()):
            problems.append(f"raiox: a highlight level of {lang} does not match its ratio")
        shards = load_shards(f"palavras/{lang}", problems)
        levels = {word: row[1] for word, row in found[lang].items()}
        differ = [word for word, entry in shards.items() if entry.get("nivel") != levels.get(word)]
        differ += [word for word in levels if word not in shards]
        if differ:
            problems.append(f"raiox: the nivel of {len(differ)} words in palavras/{lang} differs "
                            "from marcadoras.json: " + ", ".join(differ[:5]))
        hist = found["hist"][lang]
        for year in HIST_YEARS:
            ordered = hist["ordenados"][str(year)]
            if len(ordered) != hist[f"n{year}"] or ordered != sorted(ordered) \
                    or len(ordered) != len(abstracts(lang, (year,))):
                problems.append(f"raiox: the scores of {lang} {year} do not add up")
        shown = [*found["exemplos"][lang].values(), *found["parecidos"][lang]]
        for entry in shown:
            if score(entry["texto"], lists[lang])["por100"] != entry["por100"]:
                problems.append(f"raiox: {entry['doi']} por100 differs from its text")
        for year, entry in found["exemplos"][lang].items():
            words = word_count(entry["texto"])
            if entry["ano"] != int(year) or not EXAMPLE_WORDS[0] <= words <= EXAMPLE_WORDS[1] \
                    or gives_away(entry["texto"]):
                problems.append(f"raiox: example {lang} {year} breaks a rule")
        scores_ = [entry["por100"] for entry in found["parecidos"][lang]]
        if scores_ != sorted(scores_, reverse=True) or \
                any(e["ano"] not in SIMILAR_YEARS for e in found["parecidos"][lang]):
            problems.append(f"raiox: parecidos {lang} out of order or out of years")

    by_code = {p["code"]: p for p in papers()}
    items = game["resumos"]
    if len({i["id"] for i in items}) != len(items):
        problems.append("jogo: a paper appears twice")
    for lang in LANGS:
        chosen = [i for i in items if i["lingua"] == lang]
        for period, years in PERIODS.items():
            count = sum(i["periodo"] == period and i["ano"] in years for i in chosen)
            if count != GAME_EACH:
                problems.append(f"jogo: {lang} {period} has {count} abstracts, not {GAME_EACH}")
        if game["limiar"][lang] != median([i["por100"] for i in chosen]):
            problems.append(f"jogo: threshold of {lang} is not the median")
        for item in chosen:
            paper = by_code[item["id"]]
            texts = [item["texto"], item["titulo"] or "", *paper_texts(paper)]
            if any(gives_away(text) or late_year(text) for text in texts):
                problems.append(f"jogo: {item['id']} gives its date away")
            if not GAME_WORDS[0] <= word_count(item["texto"]) <= GAME_WORDS[1]:
                problems.append(f"jogo: {item['id']} has {word_count(item['texto'])} words")
            words, counted = recount(item["texto"], lists[lang])
            if item["texto"] != paper[f"text_{lang}"] or item["palavras"] != words \
                    or len(item["marcas"]) != counted or not set(item["marcas"]) <= lists[lang] \
                    or item["por100"] != score(item["texto"], lists[lang])["por100"]:
                problems.append(f"jogo: {item['id']} text or marks differ from the sample")
            if unicodedata.normalize("NFC", item["texto"]) != item["texto"]:
                problems.append(f"jogo: {item['id']} is not NFC")
    return problems
