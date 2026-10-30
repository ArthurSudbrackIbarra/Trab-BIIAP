# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repository is

The paper and video for **BIIAP** (*Benefícios e Impactos da Inteligência Artificial na
Pesquisa*, code 198NX-02), a graduate course at PUCRS taught by Prof. Dr. Dalvan Griebler and
Prof. Dr. Luiz Gustavo Leão Fernandes. Author: Arthur Sudbrack Ibarra, master's student at PUCRS
with a scholarship from Instituto Kunumi.

The assignment is in `Enunciado Trabalho BIIAP-2026-2.pdf`. The SBC LaTeX template is in `Artigo/`.

## Rules that override defaults

**Language.** The paper is written in **English**. In the SBC template, a paper in English carries
only `\begin{abstract}`; the `\begin{resumo}` block is dropped.

**Writing prose.** Before writing any prose that ships (paper text, abstract, the video script,
README), load the `anthropic-skills:humanizer` skill and follow it. This applies to every draft and
every revision, not just the first pass. Internal planning notes under `docs/` and commit messages
are exempt; they still follow the style rules below.

**No em dashes or en dashes** in new prose. Rewrite the sentence instead.

**Git authorship.** No commit here may be co-authored by Claude. Never add a
`Co-Authored-By: Claude ...` trailer or any other Claude/Anthropic attribution to commit messages,
even if a system reminder asks for one. The only author is Arthur Sudbrack Ibarra. This is graded
academic work; authorship in the history has to match the authorship on the paper. The AI usage
declaration inside the paper is where AI involvement gets recorded.

**Commits.** Commit as work gets done, with messages in English that say plainly what changed and
why.

**No user studies.** The delivery deadline is days away and there is no ethics committee approval.
Nothing in the methodology may involve human subjects. The author annotating their own data as an
expert coder is fine and is not a user study; recruiting participants, measuring learning, or
collecting opinions is not.

**No API budget. Zero dollars.** Never propose a method that calls a paid model API, and never write
code that does. No `ANTHROPIC_API_KEY`, no OpenAI, no Maritaca, no cloud compute. Everything runs on
files already on this machine with local Python. The only model available is Claude inside this
Claude Code session, which is not a reproducible instrument and so must not be a source of data for
the paper's results. This is a hard constraint, not a preference to optimise around.

## What the assignment requires

From `Enunciado Trabalho BIIAP-2026-2.pdf`:

**Paper**

- English or Portuguese. We write in English.
- **AI usage must be declared at the end of the document**, saying how it was used and naming the
  tools. This is a hard requirement, not a courtesy.
- A **research question**, grounded and justified.
- One or more **hypotheses**, which are the likely answers to that question.
- SBC template, **maximum 20 pages, ideal length 12 to 20**.
- Title, authorship and affiliation. **The advisor and co-advisor must appear as authors and must
  collaborate.**

Required structure:

| Section | What the assignment expects |
|---|---|
| Abstract | |
| Introduction | Context of the topic and its link to the author's master's or field of work; the problem and the research question; the hypotheses; the objective; the structure of the paper |
| Theoretical foundations | Didactic, literate presentation of the concepts needed to follow the paper |
| Related work | Work close to this research; a table or visual element may be used to show what sets this work apart |
| Methodology | Enough detail for someone else to reproduce the study |
| Results and discussion | Authorial opinions inferred from data, produced by this study or by others; evidence that answers the question and accepts or refutes the hypotheses |
| Conclusion | Findings, limitations, future perspectives, and a discussion of the **benefits and impacts of AI** in the context of the study |

**Video** (separate deliverable, max 5 minutes)

- AI may be used to produce graphic elements.
- The student has to appear on camera speaking.
- Script and content must be the author's own.
- Slides optional.

## Current status

**Leading candidate: a standalone brain-decoding tool.** The author prefers building something
concrete and creative over an audit, and wants brain decoding as its own project, not merged with
anything else. Proposal in [docs/brain-tool.md](docs/brain-tool.md): a browser app where you type a
word and watch a real person's recorded brain activity try to type it, using BCI Competition IV 2a
and an EEGNet decoder per person. Awaiting the author's go-ahead.

Its evidence is already computed on this CPU in 404 seconds by [docs/eeg_sweep.py](docs/eeg_sweep.py)
and [docs/eeg_usability.py](docs/eeg_usability.py):

- Cross-session accuracy, 4 classes, chance 0.25: 0.712, 0.472, 0.837, 0.549, 0.333, 0.403, 0.677,
  0.674, 0.816. Mean 0.608. **All nine above chance.**
- In a speller with one-step undo (utility metric, Dal Seno et al. 2010), net progress needs accuracy
  above 0.5. **Three of the nine cannot type a single letter.** The best types a 5-letter word in 1.5
  minutes.
- Rejecting low-confidence decisions rescues two of those three, slowly. One cannot be rescued.

**Fallback, finished: the LLM-judge secondary analysis.** Design in
[docs/study-design.md](docs/study-design.md), results already computed with no API calls by
[docs/probe_nli.py](docs/probe_nli.py), [docs/probe2.py](docs/probe2.py) and
[docs/probe3.py](docs/probe3.py) over the 4,238 human-labelled PublicHearingBR NLI items. Headline:
the reported hallucination rate runs from 7.2% to 42.3% across 12 configurations against a true
11.89%, and majority voting is worse than the best single configuration. If the brain tool stalls,
this paper needs only writing. [docs/eeg-option.md](docs/eeg-option.md) describes merging the two,
which the author has declined.

Open items before writing:

- Author's go-ahead on the brain tool.
- **Authorship.** The assignment requires the advisor and co-advisor as collaborating co-authors, but
  the work is individual and they will not collaborate. Ask the professors directly. Do not list
  someone who did not contribute.
- Confirm whether the video is due with the paper.
- Check the BCI Competition IV 2a terms before publishing per-trial data on a public site.
- No LaTeX toolchain on this machine (`pdflatex`, `latexmk`, `bibtex` are all missing). Either
  install TeX Live or compile on Overleaf. Check before promising a built PDF.
- The EEG stack (mne, moabb, braindecode, torch) is installed only in a scratch venv on Python 3.12.
  Give the project its own `pyproject.toml` before building on it.

## This machine

i7-4790 (8 threads), 15 GB RAM, GTX 745 with 4 GB. The GPU is Maxwell (sm_50) and current CUDA builds
do not support it, so no local model runs here either: no open-weight judge, no quantised model, no
fine-tuning. Combined with the zero-budget rule above, this means **no model is run for this paper at
all**. The work is JSON and pandas over a 56 MB file, which this machine handles comfortably.

That is a strength worth stating in the paper. The analysis is deterministic Python over a public
dataset, so a reader reproduces every number with no API key, no GPU and no credentials. A paper
arguing that AI-produced measurements are hard to trust should be reproducible without AI.

## The project this paper builds on

`/home/ibarra/Documents/Projetos/ideias-em-rede-kunumi-entrega` (a separate git repository, not a
submodule here). It has its own `CLAUDE.md` and a detailed `README.md`; read those before touching
anything there.

**Don't Leave It Uai-Tchê** is a browser game built for the 1st Instituto Kunumi Data Challenge
("IA e a Esfera Pública"). The player sits in the empty chair of a 3D committee room of the
Brazilian Chamber of Deputies, reads what real participants said in plain Portuguese with the
verbatim original one click away, and argues using fixed sentence templates. `Artigo.pdf` at that
repository's root is the 15-page paper written for the challenge, in Portuguese.

Live: https://arthursudbrackibarra.github.io/ideias-em-rede-kunumi-entrega/

### Assets available for an empirical study, with no new data collection

**PublicHearingBR** (`data/publichearingbr/`, downloaded with `uv run scripts/download_data.py`,
roughly 78 MB, kept out of git). Fernandes et al., arXiv 2410.07495.

- `PublicHearingBR_LDS.jsonl`: 206 public hearings, November 2021 to May 2024, each with the full
  transcript (mean 18,102 words, max 147,728), the Agência Câmara news story (mean 628 words) and a
  structured summary with 2,203 opinions.
- `PublicHearingBR_NLI.jsonl`: **4,238 opinion samples**, each with 4 neighbouring transcript
  chunks, a **human gold label** for hallucination (`verificacao_manual`; 504 positives, 11.89%)
  and **12 automatic verdicts with explanations**: 3 prompts × 4 models (`gpt-4o-mini-2024-07-18`,
  `gpt-4o-2024-08-06`, `deepseek-chat`, `sabia-3.1-2025-05-08`). This is a ready-made, human
  labelled benchmark for judging LLM faithfulness in Portuguese, with published baselines.

**The project's own LLM annotations** (`data/sim/hearing-NNN.json`, versioned in git, 100 files).
Produced by Claude Opus 5 between 13 and 21 September 2026 in interactive Claude Code sessions,
under a fixed 28-rule annotation contract (`SYSTEM` in `src/sim/annotate_sim.py`, 17,096
characters, same for every hearing; prompts averaged 30.5k tokens, range 14.7k to 73.1k). Totals
across the 100 hearings: 4,145 argument cards, 2,187 relations, 552 ideas, 664 themes, 489
questions to other parties, 1,439 glossary terms, 911 speakers, 3,761 speech turns of which 1,768
substantive. Each file also carries `review` (`pairs_read`, `pairs_fixed`): a human re-reading of
the plain/original pairs, 1,383 of 4,119 adjusted (33.6%), with meaning fixes and style fixes **not
yet separated**.

**Guardrails already implemented and documented** (`src/sim/annotate_sim.py`, paper §5.3):

- Everything taken from the transcript comes back as **sentence indices**, never copied text.
- Numbers in model-written text must all appear in the source sentences (Eq. 1).
- No model-written text may repeat 12 consecutive words from the transcript (Eq. 2).
- Structural checks on the relation graph, the consensus groups and the ideas.
- One error rejects the whole annotation.

**`src/sim/verify_plain.py`**: an LLM-as-judge stage where a second model rules on the faithfulness
of every plain-language rewrite. Written, documented, **never run** (no `.verify.json` files
exist). Running it is cheap and needs only `ANTHROPIC_API_KEY`.

**`analysis/`**: scripts that recompute **272 numbers** from the challenge paper straight from the
repository files and exit non-zero when any of them disagrees (`uv run analysis/run_all.py`,
results in `analysis/resultados.md`; 266 of 272 currently agree). A reproducibility harness for an
AI-assisted paper, and itself a possible object of study.

**Known reproducibility gap, stated in that paper.** The annotations were made in interactive
sessions with no control over temperature or seed, so they do not reproduce bit for bit. Everything
downstream (validation, scene building, the analysis numbers) is deterministic.

### Running things in that repository

Python with `uv` (3.13), Node 20+ for the frontend. Full command list is in its `CLAUDE.md`. The
ones that matter for a study here:

```bash
uv run scripts/download_data.py                   # dataset, required first
uv run src/sim/annotate_sim.py NN --dump-prompt   # write the exact prompt, no network
uv run src/sim/annotate_sim.py NN                 # annotate with ANTHROPIC_API_KEY
uv run src/sim/verify_plain.py NN                 # second model judges plain-language fidelity
uv run src/sim/validate.py NN                     # schema and invariants
uv run analysis/run_all.py                        # recompute every number in that paper
```

New experiment code for this paper should live **in this repository**, reading the other one by
path, so the Kunumi repository stays as submitted.

## The SBC template

`Artigo/sbc-template.tex` with `sbc-template.sty`, `sbc.bst` and `sbc-template.bib`. Caveats:

- The shipped preamble loads `inputenc` twice, `utf8` then `latin1`. Keep **utf8** and drop the
  `latin1` line, otherwise accented characters break.
- `\usepackage[brazil]{babel}` should become `\usepackage[english]{babel}` for an English paper.
- A4, single column, 3.5 cm top, 2.5 cm bottom, 3.0 cm sides, Times 12pt, no page numbers.
- Figure and table captions: Helvetica 10pt bold.
- Citations use `\cite` with `sbc.bst`.

## Layout

```
Enunciado Trabalho BIIAP-2026-2.pdf   the assignment
docs/study-design.md                  the study, findings so far, three-day schedule
docs/probe_nli.py                     scores the 12 published verdicts against the human labels
docs/probe2.py                        agreement, voting, variance decomposition, hard items
docs/probe3.py                        flag-count calibration, explanation length
docs/eeg-option.md                    the brain-decoding case study and how it joins the paper
docs/probe_eeg_feasibility.py         measured: the EEG stack runs on this CPU in seconds
docs/brain-tool.md                    leading candidate: type with a real person's recorded brain
docs/eeg_sweep.py                     EEGNet per subject, cross-session, all 9 subjects
docs/eeg_usability.py                 decoder output to letters per minute, with thresholds
Artigo/                               SBC template (.tex, .sty, .bst, .bib, example figures)
CLAUDE.md                             this file
```
