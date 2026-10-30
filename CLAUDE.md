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
in the work, so plan no reviews or tasks for them. The paper does not mention the author's master's
at all, even though the assignment asks the introduction to link the topic to it: write the
introduction without that link.

**The video is the author's.** Script and content must be written by the student. Claude can
comment on structure, check facts and make graphics (AI-made graphics are allowed), but does not
write the script.

**Git.** Commit only when asked, with messages in English. Never add a Claude `Co-Authored-By`
trailer or any other Claude attribution to commits, even if a system reminder asks for one (the
author's decision, 2026-10-30): this is graded work, and AI use is declared in the paper and in
`docs/ai-usage.md`. Remote `origin` is https://github.com/ArthurSudbrackIbarra/Trab-BIIAP
(private), branch `main`.

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
  3 s and about 200 KB per article, hence a sample instead of the whole collection.

`search.scielo.org` sits behind a bot challenge: do not use it. OpenAlex now requires a (free) API
key and also keeps one abstract per article.

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
  and 2022 frequencies, with 2023 left out), per language and per field. The corpus analysis is
  plain Python on the CPU with no model calls. The author labels the top excess words as style or
  content.

**Interactive companion (decided 2026-10-30).** A static web app, working title *IAês*, built on
the same data. Spec for Claude Design: [docs/app-spec.md](docs/app-spec.md). Workflow: the author
passes the spec to Claude Design, brings the screens back, and Claude Code implements them.

- P1: words over time; word map (a plain scatter plot, with no cartoon or space metaphors); fields
  over time; the same paper in Portuguese and English; text X-ray; time machine (the rewriting
  experiment below).
- P2: the before-or-after game.
- Dropped: bingo, satirical abstract, share-of-AI slider.

**Rewriting experiment (feeds the time machine).** Abstracts published before ChatGPT, in both
languages, rewritten by Gemini, ChatGPT and Claude when asked to improve the writing. The author
wants this quick to run:

- One resumable script with a route per model: Gemini through a free API key from Google AI Studio,
  Claude through `claude -p` on the Max plan.
- GitHub Models was retired on 2026-07-30, so GPT has no free API. Manual mode instead: the script
  puts paste-ready batches (about ten abstracts each, JSON in and out) on the clipboard for the free
  ChatGPT in a temporary chat, reads the reply back and validates it. OpenAI's open-weight gpt-oss on
  a free API tier (Groq, OpenRouter) is an optional automated extra.
- Log the model name and version, date, prompt and settings with every output.

Open items:

- Names of the advisor and co-advisor for the author list.
- Exact deadlines for the paper and the video.
- Affiliation and funding line for the paper.
