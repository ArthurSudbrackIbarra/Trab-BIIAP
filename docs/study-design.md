# Study design: calibrating an LLM used as a verification instrument

Planning document for the BIIAP paper. Scoped for **one author in five days**, no user study, no
ethics committee. Not final; the research question and hypotheses below are a proposal.

## 1. What changed from the first sketch

The first version of this idea was built on a self-preference hypothesis: that an LLM judge goes
soft on text its own family produced. A zero-cost probe over the PublicHearingBR NLI benchmark
(`docs/probe_nli.py`, no API calls) says that is not what happens, and points at something more
useful.

The benchmark holds 4,238 opinions extracted from hearing transcripts by ChatGPT, each with a human
label saying whether the opinion can be inferred from the four neighbouring transcript chunks. 504
of them (11.89%) cannot, which is the human-labelled hallucination rate. The dataset also ships the
verdicts of 3 prompts crossed with 4 models. Scored against the human labels:

| Condition | Precision | Recall | F1 | Flag rate |
|---|---|---|---|---|
| prompt 1, gpt-4o-mini | 0.841 | 0.641 | **0.727** | 9.1% |
| prompt 1, sabia-3.1 | 0.814 | 0.494 | 0.615 | 7.2% |
| prompt 1, deepseek-chat | 0.795 | 0.522 | 0.630 | 7.8% |
| prompt 1, gpt-4o | 0.662 | 0.673 | 0.667 | 12.1% |
| prompt 2, gpt-4o-mini | 0.474 | 0.823 | 0.602 | 20.6% |
| prompt 3, deepseek-chat | 0.485 | 0.812 | 0.607 | 19.9% |
| prompt 3, gpt-4o | 0.361 | 0.909 | 0.516 | 30.0% |
| prompt 3, gpt-4o-mini | 0.259 | 0.923 | **0.405** | **42.3%** |

Two things stand out.

**The prompt moves the measurement more than the model does.** Holding gpt-4o-mini fixed and
changing only the prompt moves F1 from 0.727 to 0.405 and the flag rate from 9.1% to 42.3%. Holding
the prompt fixed at 1 and changing the model moves F1 from 0.615 to 0.727. The prompt effect is
roughly three times the model effect, and the worst configuration reports a hallucination rate 3.6
times the true one.

**No configuration is good enough to use unchecked.** The best F1 in the whole grid is 0.727. Every
condition sits somewhere on a precision/recall trade-off that the person writing the prompt chose
without knowing they were choosing it.

That is the paper. If a researcher uses an LLM to verify something and reports the resulting number,
the number is partly an artifact of a prompt nobody reports and nobody validated. This is squarely
what BIIAP asks about: a benefit of AI in research (verification at a scale no one could do by hand)
that arrives with an impact (a measurement whose value depends on an undisclosed configuration
choice).

## 2. Research question and hypotheses

**RQ.** When a large language model is used as a verification instrument in research, how much of
the measurement it produces is determined by the instrument's configuration rather than by the data,
and what does it take to calibrate it?

- **H1.** Prompt formulation changes the measured rate more than model choice does.
  *Status: already supported by the probe above, on a third-party benchmark. The study extends it to
  current-generation models to test whether the newer generation closes the gap.*
- **H2.** No off-the-shelf configuration agrees with human labels well enough to be used without
  validation (operationalised as F1 below 0.80 on the hallucination class).
- **H3.** A configuration calibrated on one labelled corpus keeps part of its advantage when moved to
  a different corpus and a related but different task, and loses part of it.

H3 is the one that can fail outright, which is what makes it worth testing.

## 3. Two experiments

### E1. Instrument behaviour against independent human labels (primary)

- **Data.** PublicHearingBR NLI, 4,238 items, human labels made by the dataset's authors. Nobody in
  this study produced those labels, so there is no single-coder problem here at all.
- **Conditions.** 3 current models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`)
  crossed with the dataset's own 3 prompts, translated faithfully from the original paper. That is 9
  new conditions on top of the 12 already published, giving a 21-condition grid.
- **Metrics.** Precision, recall, F1 and flag rate on the hallucination class; Matthews correlation;
  bootstrap confidence intervals; McNemar tests for paired comparisons between conditions on the same
  items; a variance decomposition splitting the measured rate into prompt, model and interaction
  components.
- **What it answers.** H1 and H2, with n=4,238 and labels this study did not create.

E1 carries the paper on its own. Everything below is extension.

### E2. Does the calibration transfer? (secondary)

- **Data.** The 8,779 plain-language rewrites from the Kunumi project (4,145 `plain`, 4,145 `gist`,
  489 questions), none of which carry a gold label.
- **Conditions.** The best and worst configurations from E1, plus `claude-opus-5` judging text that
  `claude-opus-5` itself wrote. That last one is genuine self-judging and is where the
  self-preference question survives as a secondary test rather than the headline.
- **Gold.** A random sample of 250 pairs coded by the author against the six criteria of the
  project's annotation rule 19 (same meaning, nothing added, nothing essential dropped, numbers and
  names identical, the speaker's own voice, a question stays a question).
- **What it answers.** H3, and it closes a limitation the Kunumi paper states out loud.

## 4. Doing this alone, credibly

One coder is the real methodological problem, and it has standard answers. Four of them, in order of
how much weight they carry.

**Put the weight on labels you did not make.** E1 needs no coding at all. The headline claim rests on
4,238 labels published by other researchers and already peer reviewed. A single-author paper can say
something strong here without anyone taking the author's word for anything.

**Pre-register the codebook in git.** Write the six criteria, the decision rules and the tie-breaks
into `docs/codebook.md` and commit it *before* looking at a single judge verdict. The commit
timestamp is the pre-registration. This costs nothing and it is the difference between coding and
rationalising.

**Draw the sample before coding, with a fixed seed, and commit the ids.** Simple random sample of 250
pairs, seed in the script, id list committed. No stratification on judge disagreement, because that
would make the sample depend on verdicts the author has then seen. Simpler and harder to argue with.

**Report intra-coder reliability instead of inter-coder.** Re-code 80 of the 250 pairs blind, in
shuffled order, at least 48 hours later, and report Cohen's kappa against yourself. This is the
accepted substitute when a second coder is not available. It measures how noisy the instrument of
record is, and reporting it honestly is worth more than quietly having one coder and saying nothing.

Two more things that cost nothing: the coding tool shows the pair alone, never the judge verdicts, in
randomised order; and the sample and verdicts stay in separate files until analysis.

What this design cannot claim: that the author's coding is correct in an absolute sense. It can claim
it is self-consistent, blind, and made against rules fixed in advance. For a course paper with an
externally labelled primary experiment, that is enough, and the limitations section says so plainly.

## 5. Tools

| Need | Choice | Notes |
|---|---|---|
| Runtime | Python 3.13 with `uv` | Already how the Kunumi project runs |
| Model access | `anthropic` SDK | Already a dependency there; needs `ANTHROPIC_API_KEY` |
| Cheap bulk calls | Batch API | Async, 50% off, results in hours. Use it for every run that is not a dry run |
| Metrics | `scikit-learn`, `statsmodels` | F1, MCC, McNemar, bootstrap |
| Figures | `matplotlib` | Precision/recall grid, variance decomposition |
| Coding tool | A terminal script, maybe 80 lines | Prints one pair, reads a keypress, appends JSONL. No web app. Keeps the record in git |
| Paper | SBC LaTeX template | No toolchain on this machine. Either `texlive-latex-recommended` + `texlive-fonts-recommended` + `texlive-latex-extra`, or Overleaf |
| References | BibTeX with `sbc.bst` | |
| Optional | Maritaca API for a Sabiá condition | Comparability with the published baselines. Skip if the key is a hassle |

## 6. Hardware

Nothing beyond the machine already here, because nothing runs locally.

This box is an i7-4790 with 8 threads, 15 GB of RAM and a GTX 745 with 4 GB. That GPU is Maxwell
(sm_50) and current CUDA builds do not support it, which the `voicemark-br` README already records
for the thesis work. So no local open-weight model, no quantised judge, no fine-tuning. Every model
call goes to an API.

What stays local is small: the NLI file is 56 MB of JSON, the annotations are 100 files, and the
analysis is pandas-sized. Loading everything at once fits in RAM several times over. The machine is
not a constraint on this study, and the paper should say the work needs no specialised hardware,
because that is part of the accessibility argument.

## 7. Budget

Measured from the data, not guessed. NLI items average 789 tokens of content; adding instructions and
batching eight per request gives roughly 850 input and 110 output tokens per item. Project rewrite
pairs are about 260 tokens each, batched 20 per request as `verify_plain.py` already does.

| Run | Items | Standard | With Batch API |
|---|---|---|---|
| E1, Haiku 5.5, 3 prompts | 4,238 | $2 | $1 |
| E1, Sonnet 5.5, 3 prompts | 4,238 | $36 | $18 |
| E1, Opus 5.5, 3 prompts | 4,238 | $71 | $36 |
| E2, four judges | 8,779 | $50 | $25 |
| **Total** | | **~$160** | **~$80** |

Prices as of this writing: Opus 5.5 at $4/$20 per million tokens, Sonnet 5.5 at $2/$10, Haiku 5.5 at
$0.10/$0.50.

Cutting E1 to a 1,200-item stratified sample drops its cost to about $15 batched and still leaves
roughly 140 gold positives, enough to separate effects the size of the ones the probe already found.
**Budget US$100 and expect to spend less than half of it.** This is not a project where compute is
the constraint.

## 8. Paper structure

Mapped onto what the assignment requires. Target 14 to 16 pages, inside the 12 to 20 band.

| Section | Content | Pages |
|---|---|---|
| Abstract | Question, method, the prompt-versus-model result, what it means for reported numbers | 0.3 |
| 1. Introduction | LLMs as verification instruments in research; the link to the author's master's work on measuring whether automatic detectors can be trusted in Brazilian Portuguese; problem; RQ; H1 to H3; objective; structure | 2 |
| 2. Theoretical foundations | Faithfulness and hallucination; attribution and grounding; LLM-as-judge; precision, recall and what a flag rate is; why a judge's operating point is a choice. Written didactically, as the assignment asks | 3 |
| 3. Related work | Judge evaluation, faithfulness metrics, Portuguese and low-resource NLP, PublicHearingBR itself. Comparison table showing that none of them measures judge configuration sensitivity against human labels on Brazilian parliamentary text | 2 |
| 4. Methodology | Both experiments in enough detail to reproduce: data, conditions, prompts verbatim in an appendix or listing, sampling, codebook, reliability protocol, metrics, seeds | 3 |
| 5. Results and discussion | The 21-condition grid, variance decomposition, transfer to E2, self-judging, with the author's own reading of what the numbers mean | 3.5 |
| 6. Conclusion | Findings, limitations (single coder, one language, two corpora, closed models), future work, and the required discussion of AI's benefits and impacts | 1.5 |
| AI usage declaration | Which tools, for what, how it was checked. Mandatory | 0.3 |

## 9. Five days

The binding constraint is writing, not computing. Every API run finishes overnight; the paper does
not write itself.

- **Day 1.** Finish the zero-cost E1 analysis on the 12 published conditions, since that result
  already exists. Write and commit `docs/codebook.md` and the sample-drawing script. Port the 3
  benchmark prompts. Dry-run the judge harness on 50 items and check the parsing.
- **Day 2.** Launch every batch job in the morning. Build the coding tool. Code the 250-pair sample
  while the batches run. Start writing Methodology, which is the section that is fully determined by
  what you just did.
- **Day 3.** Collect batch results. Run the full E1 analysis, make the figures. Write Results. Draft
  Theoretical foundations.
- **Day 4.** Re-code the 80-pair reliability subset, now at least 48 hours after Day 2. Run E2
  analysis. Write Introduction and Related work.
- **Day 5.** Discussion, conclusion, AI declaration, references, LaTeX formatting, read the whole
  thing once aloud, compile.

If a day is lost, cut in this order: the Maritaca condition, then E2's extra judges down to one, then
E1 down to a 1,200-item sample, then E2 entirely. E1 alone with the published baselines and three new
models is still a complete paper.

## 10. Open questions

- **Authorship.** The assignment says the advisor and co-advisor must appear as authors and
  collaborate, and the work is in practice individual. Listing someone who did not contribute is its
  own problem, so this needs a direct question to the professors. If they are to be listed, send them
  the draft for a review pass so the collaboration is real.
- **The video.** A separate deliverable, five minutes, author on camera, own script. Not costed in
  the five days above. Confirm whether it is due at the same time.
- **Ethics.** No human subjects. The author coding their own data is expert annotation, not a user
  study. Worth one sentence in Methodology so nobody has to wonder.
