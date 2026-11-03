# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

Paper and video for **BIIAP**, *Benefícios e Impactos da Inteligência Artificial na Pesquisa*
(code 198NX-02), a graduate course at PUCRS taught by Prof. Dr. Dalvan Griebler and Prof. Dr. Luiz
Gustavo Leão Fernandes. Author: Arthur Sudbrack Ibarra, master's student at PUCRS.

- Assignment: `Enunciado Trabalho BIIAP-2026-2.pdf` (one page, summarised below).
- SBC LaTeX template: `Artigo/`.
- Deadline: about **2026-11-05**. On 2026-10-30 the author said six days were left. Confirm the
  exact date, and whether the video is due on the same day.

## Rules

**Language.** Talk to the author in Portuguese. The paper is written in **English**. In the SBC
template an English paper keeps only `\begin{abstract}` and drops the `\begin{resumo}` block.

**Humanizer on every text.** Before writing or revising any text that ships (paper sections,
abstract, captions, slide text, README), load the `anthropic-skills:humanizer` skill and apply it.
This holds for every draft and every revision, not only the first pass. Avoid em dashes in the
paper: they are one of the commonest AI tells.

**Declare AI use.** The paper must end with a statement of how AI was used, naming every tool. Log
each substantive AI contribution in `docs/ai-usage.md` when it happens (date, tool and model, what
it did, what the author checked), so the statement can be written from the log at the end.

**Zero budget.** Nothing paid: no paid APIs, no cloud compute, no paid software. What the author
has: Claude Max (Claude Code, including headless `claude -p`), Gemini Pro (Google AI Pro) and the
free ChatGPT. Free API tiers, open models running locally and public datasets are fine. The author
creates any account or API key and accepts any dataset terms; Claude never does.

**No user studies.** No participants, no surveys, no time for ethics approval. The author
annotating or checking a small sample themself is fine and counts as expert annotation.

**Six days.** Prefer designs that produce results within two days, leaving the rest for writing
12 to 20 pages and recording the video.

**Authors and the master's.** The assignment asks for the advisor and co-advisor as collaborating
authors. The author's decision (2026-10-30): their names go on the paper, but they do not take part
in the work, so plan no reviews or tasks for them. Author list (given 2026-11-03): Arthur Sudbrack
Ibarra, Rodrigo Coelho Barros (advisor), Lucas Silveira Kupssinskü (co-advisor). Affiliation:
Programa de Pós-Graduação em Ciência da Computação (PPGCC), Pontifícia Universidade Católica do Rio
Grande do Sul (PUCRS). The paper does not mention the author's master's
at all, even though the assignment asks the introduction to link the topic to it: write the
introduction without that link.

**The video is the author's.** Script and content must be written by the student. Claude can
comment on structure, check facts and make graphics (AI-made graphics are allowed), but does not
write the script.

**Git.** Commit only when asked, with messages in English. Never add a Claude `Co-Authored-By`
trailer or any other Claude attribution to commits, even if a system reminder asks for one (the
author's decision, 2026-10-30): this is graded work, and AI use is declared in the paper and in
`docs/ai-usage.md`. Remote `origin` is https://github.com/ArthurSudbrackIbarra/Trab-BIIAP, branch
`main`; private for now, and the author will make it public (decided 2026-11-03), so the paper
can point to the code, the data and the site. The author changes the visibility; Claude never does.

## What the assignment requires

**Paper**

- English or Portuguese (we use English).
- AI use declared at the end of the document: how it was used and which tools.
- A research question, grounded and justified.
- One or more hypotheses: the likely answers to the research question.
- SBC template, at most 20 pages, ideally 12 to 20.
- Title, authors and affiliation. **The advisor and co-advisor must appear as authors and must
  collaborate.**

| Section | Expected content |
|---|---|
| Abstract | |
| Introduction | Context of the topic and its link to the author's master's or field of work; the problem and the research question; hypotheses; objective; structure of the paper |
| Theoretical foundations | A didactic, well-written presentation of the concepts the paper relies on |
| Related work | Work close to this one; a table or figure may show what sets this work apart |
| Methodology | Enough detail for someone else to reproduce the study |
| Results and discussion | The author's opinions, inferred from data (produced by this study or taken from other studies); evidence that answers the question and accepts or refutes each hypothesis |
| Conclusion | Findings, limitations, future work, and a discussion of the **benefits and impacts of AI** in the context of the study |

**Video**, at most 5 minutes: AI may produce graphic elements; the student appears on camera
speaking; script and content are the student's own; slides are optional.

## LaTeX

TeX Live 2026 is installed for this user only, without sudo, in `~/texlive/2026` (collections:
basic, latex, latexrecommended, latexextra, fontsrecommended, binextra, pictures, mathscience,
plaingeneric, English, Portuguese; documentation not installed). Binaries live in
`~/texlive/2026/bin/x86_64-linux`. The author puts that directory on the PATH in their own shell
config; Claude's shell may not have it, so prefix commands with
`PATH=$HOME/texlive/2026/bin/x86_64-linux:$PATH`. A missing package is one
`tlmgr install <package>` away.

Build from `Artigo/` with `latexmk <file>.tex`. `Artigo/.latexmkrc` selects pdflatex and writes
everything to `Artigo/build/` (generated, never commit it). The template compiled cleanly this way
on 2026-10-30: 4 pages, accents and bibliography correct.

Template caveats:

- The shipped preamble loaded `inputenc` twice, `utf8` and then `latin1`, an option clash that
  also breaks accents in these UTF-8 files. The `latin1` line was removed from
  `sbc-template.tex`; keep it out of the paper.
- Replace `\usepackage[brazil]{babel}` with `\usepackage[english]{babel}`.
- `sbc-template.sty` sets the layout (A4, Times 12 pt, margins 3.5 cm top, 2.5 cm bottom, 3.0 cm
  sides, no page numbers, captions in Helvetica 10 pt bold). Do not override it.
- Cite with `\cite{}`; the bibliography style is `sbc` (`sbc.bst`).
- The `.aux`, `.bbl`, `.blg`, `.dvi` and `.log` files in `Artigo/` came with the template (built
  with MiKTeX in 2006). They are not ours and can be ignored.

## Data collection

`scripts/harvest_scielo.py` (standard library only; run with `python3 -I`) writes to `data/raw/`,
which git ignores. Every step resumes where it stopped when run again.

- `journals`: the 427 SciELO Brasil journals with their ISSNs and SciELO subject areas, from the
  ArticleMeta API. Takes about a minute.
- `crossref`: every journal article with an abstract from 2015 to 2026, one gzipped file per journal
  in `data/raw/crossref/`. Crossref keeps a single abstract per article, in the article's main
  language, so it serves the per-language analysis but cannot pair languages.
- `pairs`: 1,300 random articles per year (seed 20261030) from ArticleMeta, which keeps the
  abstracts in every language, in `data/raw/articlemeta/articles.jsonl.gz`. ArticleMeta takes 1 to
  3 s and about 200 KB per article, hence a sample instead of the whole collection. Finished on
  2026-10-30 with no errors: 15,600 records, 9,505 with both a Portuguese and an English abstract
  (708 to 877 per year, before cleaning), 4,785 of them Portuguese-language articles.

`search.scielo.org` sits behind a bot challenge: do not use it. OpenAlex now requires a (free) API
key and also keeps one abstract per article.

Crossref holds abstracts for some journal-years and not others: 69 journals have none, and 49 have
abstracts in 2024-2025 but none in 2021-2022 (many deposited them in 2015-2017, stopped, and started
again in 2025). Never compare raw yearly totals of the whole corpus; see Analysis.

## Analysis

`scripts/excess.py` (standard library only; run with `python3 -I`; every step takes seconds to two
minutes):

- `prepare`: cleans the 214,252 Crossref abstracts into `data/interim/abstracts.jsonl.gz` (git
  ignores it): 204,937 usable, with each abstract's set of words.
- `audit`: coverage by year, language, area and journal (`analysis/coverage.md`).
- `excess --rule rolling|fixed [--half a|b] [--full] [--raw]`: excess words per language and year
  (`analysis/excess-<variant>/`), and the list of words to label (`analysis/labels/words-*.txt`).
- `label`: Claude Opus labels every listed word through `claude -p` (`analysis/labels/claude-*.csv`)
  and draws the author's blind sample of 100 words per language (`analysis/labels/author-*.csv`;
  instructions in `analysis/labels/README.md`).
- `report`: style and content counts per year, author-Claude agreement (kappa), and the lower bound
  per language, year and area (`analysis/report.md`, `analysis/report.json`).

Rerun the four `excess` variants used by the report (`rolling`, `fixed`, `fixed --half a`,
`fixed --half b`), then `label` (it only sends unlabelled words), then `report`. Changes from
Kobak et al., all for a corpus about a hundred times smaller than PubMed, each to be stated in the
paper:

- **Balanced panel.** Each comparison uses only the journals with at least 5 usable abstracts in the
  language in every year it involves. Without it, journals entering and leaving Crossref produce
  dozens of spurious excess words in years before ChatGPT (`--full` shows this).
- **Length standardization.** Abstracts got longer (distinct words per abstract in English: 85 in
  2022, 99 in 2026), which raises the frequency of any word. Frequencies are reweighted to the
  baseline years' length deciles (`--raw` turns this off).
- **Significance and spread.** A word must appear in at least 10 abstracts that year, pass Kobak's
  thresholds and a z test with Benjamini-Hochberg FDR 0.05, and be used by at least 5 journals with
  none holding more than half its uses (this drops one-journal artifacts such as reprinted old
  articles).
- **Two baselines.** `rolling` is Kobak's rule for every year (years Y-3 and Y-2, same span every
  year): use it to count excess words per year (H1). `fixed` keeps 2021-2022 for every year after
  2022: use it for the lower bound.
- **Cross-fitted lower bound.** Marker words are chosen on one random half of the abstracts (by DOI)
  and the gap is measured on the other half, both ways; the same-data estimate (Kobak's procedure)
  is reported next to it. A placebo applies the same markers and span to 2015-2016 and should give
  about zero.
- Kobak et al. print the ratio threshold as log10 r > (log10 2 / 4) log10 p, which read literally
  passes almost every word; the code uses r > 2^(-log10(p) / 4) (r > 2 at p = 1e-4, rising for
  rarer words). Check this against the published version before describing it in the paper.

`scripts/crosslang.py` tests whether the Portuguese markers echo the English ones (H3). Markers
are the excess style words of 2024-2026 under either baseline. Each marker gets a control: a word
of the same language with the closest frequency in 2021-2022 that was never excess and that Claude
labels style with the markers' prompt. Claude (through `claude -p`, prompts in
`analysis/crosslang/`) gives the dictionary form of every marker and translates markers and
controls, shuffled together, into the other language; a word hits when one of its translations is
the dictionary form of a marker of the other language. Commands: `controls`, `translate`,
`compare` (`analysis/crosslang/report.md`).

`scripts/pairs.py` tests H2 on the ArticleMeta sample. `prepare` cleans both abstracts of every
sampled paper with the corpus filters (`data/interim/pairs.jsonl.gz`, 9,312 usable papers).
`compare` (about a minute; `analysis/pairs/report.md`) checks each paper's English and Portuguese
abstracts against the cross-fitted marker sets of the lower bound, taking the sets picked on the
Crossref half the paper's DOI is not in (`excess.py report` saves them in `analysis/report.json`;
rerun `compare` whenever it changes). Only years with at least 10 markers per half in both
languages are used: 2025 and 2026, since the 2023 and 2024 Portuguese sets have 0 or 1 words. With
about 750 papers a year the counterfactual is flat (the 2021-2022 share), and the estimate is a
difference in differences, how much more the English share rose than the Portuguese share in the
same papers: length-standardized (quintiles), with 2,000 bootstrap resamples of papers within
years and a placebo. The report adds the 2025 sets applied to every year (timing and pre-trends),
which abstract carries the markers, robustness variants, and how often the experiment's texts
carry a marker.

## Site (IAês)

A static site that goes with the paper: 9 tools plus Método, in English (default, at the root)
and Portuguese (`/pt/`), no framework, no npm, no cookies, no third-party requests. Built on
2026-10-31 from the design made in Claude Design. Details in `site/README.md` (structure, shared JavaScript API, rules) and
`site/DADOS.md` (data contract).

```
python3 -I scripts/build_site_data.py all     # site/public/dados/ from analysis/ and data/interim/
python3 -I scripts/build_site_data.py check   # compare the site data with the analysis outputs
python3 -I site/build.py                      # site/dist/ (git ignores it); --base /Trab-BIIAP/ for a subpath
python3 -m http.server 8000 -d site/dist
```

- `site/public/dados/` (about 65 MB, committed: the build cannot see `data/`) is generated by
  `scripts/site_data/<step>.py`; each step has a `check()` against `analysis/`. Rerun `all` and
  `check` whenever the analysis changes.
- Measurement frames match the paper: for year Y, the journals with at least 5 abstracts in the
  language in 2021, 2022 and Y, length-standardized to their 2021-22 deciles, smoothed (a+1)/(b+1),
  expected = p2022 + (Y-2022)·max(p2022-p2021, 0). For 2023 to 2026 the site's observed and expected
  equal p and q of `analysis/excess-fixed/`; earlier years use the same 2021-22 frame, so they differ
  from the rolling baseline by design.
- Marker words everywhere on the site are the H3 set (349 PT, 437 EN). It includes frequent words
  with ratios below 1.5 (como, entre, this, these, using), so highlights are dense: an open choice
  for the author. The Fields index uses the cross-fitted 2025 sets of the lower bound instead.
- Totals: the home page counts 195,600 abstracts (Portuguese plus English); the 204,937 usable
  abstracts include 9,337 in Spanish.
- Pages: `site/src/pages/<id>.html` and `site/src/i18n/<id>.json` (same keys in pt and en), with
  `site/public/js/pages/<id>.js` and `css/pages/<id>.css`. Shared code in `site/public/js/lib/`.
  `site/public/css/iaes.css` is the design's copy; fix its effects in `site.css`, never edit it.
- Testing: headless Chrome through a small CDP script (screenshots at 1440×900 and 390×844, console
  errors, failed requests). No test suite.
- No AI-use statement and no how-to-cite section on the site (the author's decision, 2026-11-03):
  the AI-use declaration belongs in the paper. Mentions of Claude that describe the method (the
  labels, the cross-language translations, the experiment) stay.
- Deploy: `.github/workflows/pages.yml` builds with the Pages base path and publishes on every push
  to `main` that touches `site/`. It works once the author makes the repository public and sets
  Settings > Pages > Source to "GitHub Actions"; the address will be
  https://arthursudbrackibarra.github.io/Trab-BIIAP/.

## This machine

Intel i7-4790 (4 cores, 8 threads, AVX2), 15 GB RAM, GeForce GTX 745 with 4 GB (Maxwell, too old
and slow for current ML stacks): treat it as CPU only. Fine for pandas over a few GB of data and for
small quantised models (about 1 to 4 B parameters) on llama.cpp, slowly. Training or running large
models locally is out.

## Status

**Topic chosen on 2026-10-30: "Is AI delving into Brazilian science?"** Have LLM chatbots left a
measurable lexical footprint in Brazilian scientific abstracts, and is it larger in the English
abstract than in the Portuguese abstract of the same paper?

- H1: since 2023, some style words appear above their pre-2023 trend (excess vocabulary), as Kobak
  et al. found in PubMed.
- H2: the footprint is larger in the English abstracts than in the Portuguese abstracts of the same
  papers.
- H3: the Portuguese marker words differ from the English ones, and they are mostly style words,
  not content words.
- Data: abstracts of the 427 SciELO Brasil journals, 2015 to 2026. Crossref supplies the full
  corpus and an ArticleMeta sample supplies the Portuguese and English pairs (see Data collection).
- Method: the excess-vocabulary method of Kobak et al. (a counterfactual extrapolated from the 2021
  and 2022 frequencies, with 2023 left out), per language and per field, with the changes listed
  under Analysis. Claude labels every excess word as style or content; the author labels a blind
  random sample to measure agreement.
- Author's labels (2026-10-31): the author labelled the blind sample with style or content only,
  never ambiguous. Agreement with Claude: Portuguese 72% (kappa 0.50), English 67% (kappa 0.36);
  where Claude chose style or content, 92% and 91%. Most disagreements are words Claude called
  ambiguous and the author called style, so Claude's labels, and with them the marker sets, lean
  conservative. The author's label replaces Claude's for the 200 sampled words; every result below
  uses them.
- Results (2026-10-31): excess style words per year stay at 0 to 6 until 2022, then English 14
  (2023), 50 (2024), 108 (2025), 150 (2026) and Portuguese 2, 10, 69, 126. Cross-fitted lower
  bound on the share of abstracts processed by an LLM: English 11% in 2024, 17% in 2025, 16% in
  2026; Portuguese 0% in 2024, 13% in 2025, 19% in 2026; placebo about 0. H3 test
  (`scripts/crosslang.py`): 72% of the 349 Portuguese markers translate into an English marker
  against 44% of their controls (Fisher p = 3e-14); 49% of the 437 English markers translate into
  a Portuguese marker against 22% of controls (p = 3e-17). The Portuguese markers are mostly style
  words but largely mirror the English ones (aprofunda/delves, ressaltando/highlighting,
  moldam/shaping), so the "differ" half of H3 fails; 28% are Portuguese only (tensionam,
  multifacetada, agrava, perpetuando).
- H2 (`scripts/pairs.py`, same papers): from 2021-2022 to 2025-2026 the share of English abstracts
  with an English marker rose 17.5 points and the share of Portuguese abstracts with a Portuguese
  marker 14.9; the difference, 2.7 points [-1.8, 7.4] (p = 0.12), is no larger than the placebo
  (2.4) and stays between 0.2 and 2.7 in every robustness variant. With the 2025 sets on every
  year, English led in 2024 (8.6 against 1.8 points, difference 6.8 [0.8, 12.8]) and Portuguese
  caught up in 2025. The growth is in papers with markers in both abstracts (15% to 31% with the
  2025 sets), while papers with markers in English only went from 23% to 24%. So H2 holds for 2024
  only. The placebo of the papers written in Portuguese is 5.4 [-0.2, 10.9], too large to read the
  subgroups by article language.
- Rewriting experiment (2026-10-31, 80 texts per task and model). Word analysis
  (`experiment.py analyze`, `analysis/experiment/report.md`, markers = the H3 markers): polishing an
  English abstract adds about 5 markers per text with ChatGPT and Gemini (8.1 to 13.2) and 1.1 with
  Claude; a Portuguese one, 2.2 (ChatGPT), 2.4 (Gemini) and 0.8 (Claude); translating adds 3.6, 1.5
  and 0.3 (Claude, not significant) over the authors' own English. Markers are far more common
  among the words ChatGPT and Gemini add than among those they drop (ChatGPT polishing English: 40
  of 92 added words against 1 of 46 dropped, p = 4e-8). All three models add across, findings,
  these, using and whereas to English abstracts. With the lower-bound sets (`analysis/pairs/report.md`),
  polishing raises the share of abstracts with a marker by 29 (ChatGPT), 41 (Gemini) and 8 (Claude)
  points in English but by 8, 14 and 0 in Portuguese with the 2025 sets, and by 21, 33 and 1
  against 13, 28 and 5 with the 2026 sets. So the markers catch an edit more often in English than
  in Portuguese, and similar footprints in the two languages may hide more editing of the
  Portuguese abstracts. Dividing the rises in the same papers by these rates gives shares from about
  35% to over 100% in both languages, so one polishing pass by a 2026 model cannot calibrate the
  markers: real use evidently leaves more of them (older models, several passes, drafting). Gemini
  also wrote chemical and mathematical notation as LaTeX in 23 of its 240 texts (the analysis drops
  LaTeX commands). With 80 texts per task, treat the rates as rough.
- One translation batch was answered with a refusal (the model read the listed word "stop" as an
  instruction); its words were resent in batches of 25 in a new order. Mention it in the paper as
  a small example of LLM fragility in research pipelines.

**Interactive companion (decided 2026-10-30, built 2026-10-31).** A static web app, *IAês*, built
on the same data; see the Site section. Spec for Claude Design: [docs/app-spec.md](docs/app-spec.md).
The author passed the spec to Claude Design and brought the design back; Claude Code
implemented every screen. On 2026-11-03 subagents reviewed it in six dimensions and fixed the
findings screen by screen; the author then looked at it and asked for the last changes (English as
the default, no AI-use or citation section). It goes live through the Pages workflow once the
repository is public.

- P1: words over time; word map (a plain scatter plot, with no cartoon or space metaphors); fields
  over time; the same paper in Portuguese and English; text X-ray; time machine (the rewriting
  experiment below).
- P2: the before-or-after game.
- Dropped: bingo, satirical abstract, share-of-AI slider.

**Rewriting experiment (feeds the time machine).** No API keys (GitHub Models, the free GPT API,
was retired on 2026-07-30). `scripts/experiment.py` samples abstracts published 2019 to 2021, ten
per SciELO area, at most two per journal in a first pass and then more where an area has too few
journals (polish-en keeps the cap; polish-pt has up to 7 from one journal and translate-pt-en up
to 10, from 50 and 48 journals), with no paper in two tasks, and writes identical batches of ten
for every model:

- `polish-pt` and `polish-en`: improve the writing, from the Crossref corpus.
- `translate-pt-en`: translate into English, from Portuguese-language articles in the ArticleMeta
  sample; the authors' own English abstract is the human reference.

The prompts (`experiment/prompts/`) ask for one code block: `=== batch ===`, then `### id` and the
text. ChatGPT (free, temporary chat) and Gemini (the author's Pro plan) are manual: the author pastes
each batch into a new chat and pastes the reply into `experiment/inbox/<model>/` under a
`# modelo: <name>` line (step by step in `experiment/README.md`). Claude is automatic:
`python3 -I scripts/experiment.py claude` runs `claude -p` (Sonnet on the Max plan) from an empty
temporary directory, with a one-line system prompt, no tools, no MCP and no user settings. Claude
Code still adds about 900 tokens of environment information to that context: report it as a
limitation. `python3 -I scripts/experiment.py ingest` parses and checks every reply, writes
`experiment/results/<model>.jsonl` and retry batches for missing or broken items.

ChatGPT is done (2026-10-31, GPT-6 per the author, 240 of 240 replies, no warnings). The author
sent the replies as files named `1.txt` (polish-pt-01), `1-en.txt` (polish-en-01) and `t1.txt`
(translate-pt-en-01), with Windows line endings, some without the code block and none with the
model line; they were rewritten into `experiment/inbox/chatgpt/<batch>.txt` in Claude's format
without touching the replies. The reply to polish-en-02 is headed `polish-en-01` but holds batch
02's abstracts, which is what counts. Gemini is done too (2026-10-31, Gemini 3.6 Flash on the
author's Google AI Pro plan, same file names, 240 of 240, no warnings).
`python3 -I scripts/experiment.py analyze` compares each model's text with the original (a
translation with the authors' English): markers per text with a bootstrap interval, the words
each model adds and drops (a word counts when its number of texts changes by at least 4 of 80),
and a Fisher test of markers among added against dropped words.

Open items:

- Exact deadlines for the paper and the video.
- Funding line for the paper, if any.
- The site's address once the repository is public (GitHub Pages, expected at
  https://arthursudbrackibarra.github.io/Trab-BIIAP/), to cite in the paper.
