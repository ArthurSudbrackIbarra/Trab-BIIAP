# AI usage log

Source for the AI-use statement required at the end of the paper. Add one row per substantive use:
what the tool did and what the author checked or changed afterwards.

| Date | Tool (model) | What it did | Author's check |
|---|---|---|---|
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Summarised the assignment into `CLAUDE.md`, installed TeX Live, proposed candidate topics and searched for related work | Chose topic A |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Proposed ideas for an interactive web companion and wrote its spec (`docs/app-spec.md`) from the features the author picked | Pending: review before Claude Design |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Tested the SciELO, Crossref and OpenAlex APIs, wrote `scripts/harvest_scielo.py` and ran the data collection | Pending: check the harvested counts |
| 2026-10-30 | Claude Code (Claude Opus 5.5) | Designed the rewriting experiment (sampling, prompts, reply format) and wrote `scripts/experiment.py` and `experiment/README.md` | Asked for a no-API-key, standardised pipeline; pending: runs ChatGPT and Gemini by hand |
| 2026-10-30 | Claude Sonnet 5.5 via `claude -p` | Subject of the experiment: rewrote the batches (its output is data, not text of the paper) | Checked automatically by `experiment.py ingest` |
