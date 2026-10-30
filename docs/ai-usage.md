# AI usage log

Source for the AI-use statement required at the end of the paper. Add one row per substantive use:
what the tool did and what the author checked or changed afterwards.

| Date | Tool (model) | What it did | Author's check |
|---|---|---|---|
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Summarised the assignment into `CLAUDE.md`, installed TeX Live, proposed candidate topics and searched for related work | Chose topic A |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Proposed ideas for an interactive web companion and wrote its spec (`docs/app-spec.md`) from the features the author picked | Pending: review before Claude Design |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Tested the SciELO, Crossref and OpenAlex APIs, wrote `scripts/harvest_scielo.py` and ran the data collection | Pending: check the harvested counts |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Designed the rewriting experiment (sampling, prompts, reply format) and wrote `scripts/experiment.py` and `experiment/README.md` | Asked for a no-API-key, standardised pipeline; pending: runs ChatGPT and Gemini by hand |
| 2026-10-30 | Claude Sonnet 5.5 via `claude -p` | Subject of the experiment: rewrote and translated the batches (its output is data, not text of the paper) | Checked automatically by `experiment.py ingest` |
| 2026-10-30 | Claude in Cowork (Claude Opus 5.5), Claude Design canvas | Designed the IAês app from `docs/app-spec.md`: color tokens tested for color blindness, type and spacing scales, a chart style guide, components, the 9 screens at 1440 and 390 px, the main states, and `iaes.css` with the tokens and component styles | Chose the editorial direction and one panel per word in Palavras no tempo; pending: review the screens |
| 2026-10-30 | Claude in Cowork (Claude Opus 5.5), Claude Design canvas | Revised the IAês design: Lexend and DM Mono instead of Newsreader, light mode only, and removed common AI-made UI patterns (eyebrow labels, pill badges and status dots, uniform card grids, numbering outside real sequences); added exact counts, offline, slow-loading, broken-link and 404 states, and a table of page routes | Asked for the new font and listed the patterns to avoid; pending: review the revised screens |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Wrote `scripts/excess.py` and ran the corpus analysis: cleaning and coverage audit, excess vocabulary after Kobak et al. with a balanced journal panel, length standardization, significance and spread filters, and a cross-fitted lower bound with a placebo check | Pending: review the method choices and `analysis/report.md` |
| 2026-10-30 | Claude Opus 5.5 via `claude -p` | Labelled the 1,682 excess words as style, content or ambiguous, alphabetically and blind to the year (prompt in `analysis/labels/prompt.txt`) | Pending: labels a blind random sample of 100 words per language to measure agreement |
