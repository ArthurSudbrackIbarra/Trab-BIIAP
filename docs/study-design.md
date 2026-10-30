# Study design: what an LLM judge measures, at zero cost

Planning document for the BIIAP paper. **One author, no API budget, no user study, no ethics
committee, roughly three days.** Everything below runs on files already on this machine.

## 1. The constraint turned out to help

The earlier version of this plan assumed an API budget and proposed running new models. That is gone,
and the paper is better for it, because the whole analysis is now a **secondary analysis of a
published benchmark**. Three consequences:

- **Zero cost.** No key, no tokens, no provider.
- **Bit-for-bit reproducible, forever, by anyone.** The analysis is deterministic Python over a public
  dataset. A reader can rerun it and get identical numbers with no credentials. For a paper arguing
  that AI-produced measurements are hard to trust, having an analysis that needs no AI to reproduce
  is worth saying out loud.
- **The results already exist.** They are computed, in `docs/probe_nli.py`, `docs/probe2.py` and
  `docs/probe3.py`. What is left is writing.

## 2. The data

`PublicHearingBR_NLI.jsonl`, from Fernandes et al. (arXiv 2410.07495), already downloaded at
`/home/ibarra/Documents/Projetos/ideias-em-rede-kunumi-entrega/data/publichearingbr/`.

4,238 opinions that ChatGPT extracted from Brazilian Chamber of Deputies hearing transcripts. Each
one carries the four neighbouring transcript chunks and a **human label** saying whether the opinion
can be inferred from them. 504 cannot, so the true hallucination rate is 11.89%. Each item also
carries the verdicts of **3 prompts crossed with 4 models** (GPT-4o-mini, GPT-4o, DeepSeek-V3,
Sabiá-3.1), each with a written justification. That is a fully crossed 3x4 design, judged on
identical items, with human ground truth. Nobody in this study made any of those labels.

The three prompts are nested, per the source paper: prompt 1 asks whether the opinion follows from
the chunks; prompt 2 adds a request to quote the supporting sentences first; prompt 3 adds reinforced
instructions and tells the model to answer "cannot be inferred" when in doubt.

## 3. What the source paper did, and what it left

Fernandes et al. report, for each of the 12 cells, the share of the 504 hallucinations caught and the
share of the 3,734 valid opinions wrongly flagged. They note the trade-off worsens, fit exponential
curves to it, and observe that Sabiá-3.1 is least sensitive to the prompt and GPT-4o-mini most. They
say the appendix confusion matrices would support other metrics and that they do not report them.

**The reanalysis reproduces their numbers exactly** (their GPT-4o-mini prompt 1 true-positive rate of
64.09% is recall 0.641 here; prompt 3's 92.26% is 0.923), which is the check that the pipeline is
reading the data correctly. Everything past that is new:

| Analysis | In the source paper | Here |
|---|---|---|
| Precision, recall, F1, flag rate per cell | no | yes |
| Bias of the reported rate against the true 11.89% | no | yes |
| Variance decomposition over prompt, model, interaction | no | yes |
| Agreement between judges (kappa) | no | yes |
| Majority voting and unanimity | no | yes |
| Flag count as a graded confidence score | no | yes |
| Explanation length against correctness | no | yes |

The framing differs too. They ask which detector to use in their pipeline. This paper asks what it
means for research that an instrument's reading depends this much on how the instrument was set up.

## 4. Research question and hypotheses

**RQ.** When a large language model is used to verify whether generated text is faithful to a source,
how much does the verdict depend on how the verifier was configured rather than on the text being
verified, and do the usual remedies (pick a better model, poll several models) recover a measurement
a researcher can report?

| | Hypothesis | Status on data in hand |
|---|---|---|
| **H1** | The reported rate depends more on the prompt than on the model | **supported**, 43.0% of variance against 36.1% |
| **H2** | No configuration agrees with human labels well enough to use unvalidated (F1 < 0.80) | **supported**, best F1 is 0.727 |
| **H3** | Majority voting across configurations beats the best single configuration | **refuted**, 0.709 against 0.727 |
| **H4** | Accuracy separates into independent prompt and model effects | **refuted**, the interaction is 51.8% of F1 variance |

Two refuted hypotheses is a feature. The assignment asks for evidence that accepts or refutes the
hypotheses, and a paper where everything was confirmed reads like it was written backwards.

## 5. Results already in hand

**The reading swings by a factor of six.** Across the 12 cells the reported hallucination rate runs
from 7.2% to 42.3% against a true 11.89%. The most sensitive configuration reports 3.6 times reality.
Nothing about the text changed; only the instrument did.

**Nothing is accurate enough to trust.** The best cell is prompt 1 with GPT-4o-mini at precision
0.841, recall 0.641, F1 0.727. The worst is prompt 3 with GPT-4o-mini at F1 0.405. Same model.

**There is no configuration to recommend, only pairs.** For F1, prompt explains 36.7% of the variance,
model 11.5%, and the interaction 51.8%. The best prompt depends on the model and vice versa, so a
configuration validated on one model says nothing about another. An LLM judge is not a model; it is a
model and a prompt, and only the pair can be validated.

**There is no model consensus to appeal to.** Mean Cohen's kappa between pairs of judges is 0.549.
Mean kappa between a judge and the humans is 0.553. The judges are no more like each other than they
are like the people, so "ask a second model to check" returns another idiosyncratic opinion rather
than a second opinion. Two different models on the same prompt agree slightly *less* (0.587) than one
model on two different prompts (0.614).

**Voting does not rescue it.** A majority of all 12 gives F1 0.709, below the best single cell.
Unanimity gives precision 0.952 but recall 0.395, so it is a clean filter and a terrible census.

**But the ensemble is an excellent ranking.** The share of items that are genuinely hallucinations
climbs monotonically with the number of conditions that flagged them: 0.9% at zero flags, 10.0% at
three, 43.8% at seven, 95.2% at twelve. The ensemble fails as a classifier and works as a confidence
score. That is the paper's one constructive recommendation: do not take the vote, rank by the count
and send the top of the list to a human.

**The judge writes more when it is wrong.** In all 12 conditions without exception, justifications
attached to incorrect verdicts are longer than those attached to correct ones, by 9% to 37%. A free,
post-hoc uncertainty signal that costs nothing to compute.

**Difficulty is concentrated, and length does not explain it.** All 12 agree and are right on 56.6% of
items; all 12 are wrong on 0.7%. Mean chunk length for the 21 hallucinations nobody caught is 2,723
characters against a corpus mean of 2,659, which is no difference worth reporting. Whatever makes an
item hard, it is not size.

## 6. What is left to do

1. **Consolidate.** Fold the three probes into one `analysis/` package that emits the LaTeX tables and
   the figures directly, so no number is ever retyped into the paper. This mirrors what the Kunumi
   project's `analysis/` folder does and is cheap insurance against transcription errors.
2. **Three figures.** A precision/recall scatter of the 12 cells with the true rate marked; the
   calibration curve of flag count against actual hallucination share; a bar chart of the variance
   decomposition.
3. **Bootstrap intervals** on the headline numbers. Free, deterministic with a fixed seed.
4. **Optional, if time allows.** Hand-code the 31 universally-wrong items plus a sample of
   high-disagreement items into an error taxonomy. Perhaps an hour of the author's own reading, no
   API, and it supplies the authorial reading of the data that the assignment asks for. Cut it first
   if the schedule slips.

## 7. Paper structure

Target 14 to 16 pages, inside the required 12 to 20.

| Section | Content | Pages |
|---|---|---|
| Abstract | Question, the secondary-analysis design, the six-fold swing, what it means for reported numbers | 0.3 |
| 1. Introduction | LLMs as verification instruments; the link to the author's master's work on whether automatic detectors can be trusted in Brazilian Portuguese, and to building an LLM pipeline that needed verifying; problem; RQ; H1 to H4; objective; structure | 2 |
| 2. Theoretical foundations | Hallucination and faithfulness; natural language inference; LLM-as-judge; precision, recall, F1 and why an operating point is a choice; agreement and kappa; what a variance decomposition says. Didactic, as the assignment asks | 3 |
| 3. Related work | Judge evaluation, faithfulness metrics, Portuguese and low-resource NLP, PublicHearingBR itself. Table contrasting what the source paper reports with what this reanalysis adds (section 3 above is its skeleton) | 2 |
| 4. Methodology | The dataset, the 12 cells, the three prompts, every metric and test, the seeds, and the reproduction check against the published TP/FP rates | 2 |
| 5. Results and discussion | The seven findings in section 5, with the author's own reading of each | 4 |
| 6. Conclusion | Findings, limitations, future work, and the required discussion of AI's benefits and impacts | 1.5 |
| AI usage declaration | Which tools, for what, how the output was checked. Mandatory | 0.3 |

## 8. Three days

The binding constraint is writing. There is no compute to wait for.

- **Day 1.** Consolidate the analysis, emit tables and figures. Write Methodology and Results, the two
  sections the analysis fully determines.
- **Day 2.** Introduction, Theoretical foundations, Related work. Fetch and read the source paper
  properly for the related-work table.
- **Day 3.** Discussion, Conclusion, AI declaration, references, LaTeX, read it once aloud, compile.

If a day slips, cut the error taxonomy, then the bootstrap intervals, then one figure. The seven
findings stand without any of them.

## 9. Limitations to state plainly

- One benchmark, one language, one task. The size of the configuration effect here is not a universal
  constant.
- The 12 conditions are other people's runs. Sampling parameters are not recorded, so some of the
  spread may be sampling noise rather than configuration. This is honest and also part of the point:
  a reader of the original paper cannot tell either.
- The human labels are themselves a single annotation pass by the dataset's authors, with no reported
  inter-annotator agreement. The ground truth has unmeasured noise.
- Three of the four models are closed and may have changed since the verdicts were produced.
- No new models were run, so nothing here says whether the current generation behaves better.

## 10. Open questions

- **Authorship.** The assignment requires the advisor and co-advisor as collaborating co-authors; the
  work is individual and they will not collaborate. Ask the professors directly rather than deciding
  quietly. Listing someone who did not contribute is its own problem.
- **The video.** Separate deliverable, five minutes, author on camera, own script. Not costed above.
- **LaTeX.** No toolchain on this machine. Install TeX Live or use Overleaf.
