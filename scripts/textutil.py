"""Text helpers shared by the experiment and the analysis: abstract cleaning and a language guess."""

import html
import re

JATS_TITLE = re.compile(r"<jats:title[^>]*>(.*?)</jats:title>", re.S)
TAG = re.compile(r"<[^>]+>")
LEADING_LABEL = re.compile(r"^(resumo|abstract|resumen|summary)\b\s*[:.]?\s*", re.I)
# Inside an abstract these mean a second abstract or the keywords were glued on (common in Crossref).
INNER_LABEL = re.compile(r"\b(abstract|resumo|resumen|résumé|keywords?|key words|palavras[- ]chave|"
                         r"palabras clave|mots[- ]cl[ée]s)\b", re.I)
WORD = re.compile(r"[^\W\d_]+(?:['-][^\W\d_]+)*")

# Function words that tell apart the three languages SciELO publishes in. Words that Portuguese
# and Spanish share (que, para, como, se...) are left out on purpose.
STOPWORDS = {
    "pt": {"não", "são", "também", "em", "com", "uma", "foi", "os", "dos", "das", "ao", "pelo",
           "pela", "e", "à", "é", "nos", "nas", "ou", "seus", "suas"},
    "en": {"the", "of", "and", "to", "in", "is", "was", "were", "that", "with", "for", "this",
           "are", "by", "from", "an", "on", "be", "which", "these"},
    "es": {"el", "los", "y", "con", "en", "del", "una", "fue", "las", "es", "al", "lo", "su",
           "sus", "pero"},
}


def clean_abstract(raw):
    """Plain text from a Crossref (JATS) or ArticleMeta abstract, without the leading label."""
    if not raw:
        return ""
    # Section titles of structured abstracts become "Objetivo: ...".
    text = JATS_TITLE.sub(lambda m: f" {m.group(1).strip()}: ", raw)
    text = html.unescape(TAG.sub(" ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return LEADING_LABEL.sub("", text).strip()


def words(text):
    return WORD.findall(text.lower())


def word_count(text):
    return len(WORD.findall(text))


def detect_language(text):
    """'pt', 'en' or 'es' when one language clearly dominates the function words, else None.

    Abstracts with two languages glued together get None: the runner-up may have at most a fifth
    of the leader's function words.
    """
    counts = {lang: 0 for lang in STOPWORDS}
    for word in words(text):
        for lang, vocabulary in STOPWORDS.items():
            if word in vocabulary:
                counts[lang] += 1
    ranked = sorted(counts.items(), key=lambda pair: pair[1], reverse=True)
    (best, top), (_, second) = ranked[0], ranked[1]
    return best if top >= 3 and top >= 5 * second else None


def has_inner_label(text):
    return bool(INNER_LABEL.search(text))
