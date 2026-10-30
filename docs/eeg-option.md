# The brain-decoding option, and how it joins the paper already planned

Written after a feasibility probe on 2026-10-30. Verdict: **yes, it fits the six days**, and it is
not a different paper from the one already designed. It is the second case study of the same one.

## 1. Feasibility is measured, not estimated

`docs/probe_eeg_feasibility.py` was run on this machine, CPU only, no budget:

| Step | Result |
|---|---|
| Install `mne` + `moabb` + `braindecode` + `torch` on Python 3.12 | works |
| Download BCI Competition IV 2a, subject 1, via MOABB | 83 MB in 30 s |
| Epoch it (4 to 38 Hz, resampled to 128 Hz) | 4.8 s, giving 576 trials of 22 channels x 513 samples |
| Train EEGNet (2,484 parameters), 60 epochs | **19.8 s on CPU** |
| Cross-session accuracy, subject 1, 4 classes | **0.712**, chance 0.25 |
| Extrapolated 9-subject sweep, one condition | about 3 minutes |

The whole dataset is 9 subjects at roughly 83 MB, so under a gigabyte and a few minutes of
downloading. A full factorial over protocols, models and subjects is minutes. The GTX 745 is never
touched; EEGNet is small enough that CPU is the right tool.

Note the accuracy is a real, literature-plausible number, not a toy. This paradigm works.

## 2. Why this is the same paper

The study already designed asks: when an LLM verifies whether generated text is faithful to a source,
how much of the verdict is the configuration of the verifier rather than the text? The answer so far
is that the reported rate swings from 7.2% to 42.3% on identical data, and that the prompt-model
interaction is the largest single term.

Neural decoding has the same disease in a different organ. A published BCI accuracy depends on an
evaluation protocol that is rarely justified and sometimes not even stated: whether trials were split
randomly or by session, whether the test subject was seen in training, whether repetitions of the
same stimulus leaked across the split. The community knows this, which is exactly why it is
measurable rather than speculative.

So the paper becomes one thesis with two independent case studies:

> **When a research result is produced by an automatic system, how much of the number is the
> system's configuration rather than the phenomenon being measured?**

| | Case 1, language | Case 2, neural |
|---|---|---|
| Instrument | An LLM judging faithfulness | A neural network decoding motor imagery |
| Configuration | prompt x model | evaluation protocol x model |
| Data | PublicHearingBR NLI, 4,238 human-labelled items | BCI Competition IV 2a, 9 subjects |
| Cost | zero, results already computed | zero, minutes of CPU |
| Status | done | to run |

Two domains that share no methods, no data and no community, showing the same failure, is a much
stronger claim than either alone. It also removes the obvious objection to a single-case paper, which
is that the effect might be a quirk of that corpus.

And it is the author's own research identity rather than a staple job. The `voicemark-br` thesis asks
whether a watermark detector's verdict survives the real channel between a synthetic voice and its
victim. That is the same question a third time: an automatic detector gives a number, and the number
is only worth what the conditions of measurement are worth.

## 3. The experiment

**Data.** BCI Competition IV 2a via MOABB (`BNCI2014_001`): 9 subjects, 22 EEG channels, 4 motor
imagery classes (left hand, right hand, feet, tongue), 288 trials per session, two sessions recorded
on different days. The two-session structure is what makes the protocol comparison possible, and it
is why this dataset rather than a bigger one.

**Factor A, evaluation protocol.** The variable under study.

1. **Pooled random split.** k-fold over all 576 trials of a subject, ignoring which session they came
   from. The optimistic protocol, and the one that lets day-specific drift leak between train and
   test.
2. **Cross-session.** Train on session 1, test on session 2. The official protocol for this dataset
   and the honest within-subject number.
3. **Leave-one-subject-out.** Train on 8 subjects, test on the ninth. The protocol that matches how a
   BCI would actually be deployed on a new person.

**Factor B, model.** EEGNet against a classical CSP plus LDA baseline, so the protocol effect can be
compared against the architecture effect on the same axis.

**Factor C, injected confound (the controlled demonstration).** Add to each trial a slow drift whose
amplitude correlates with the class label, at a few magnitudes expressed as a fraction of the signal
standard deviation, and measure the apparent accuracy it buys. This quantifies how much of a reported
number a confound of realistic size can manufacture with no neural information at all. It is cheap,
fully controlled, and it is the part that makes the point unarguable rather than merely known.

**Hypotheses.**

| | Hypothesis |
|---|---|
| H1 | Protocol changes reported accuracy more than model architecture does |
| H2 | Pooled random splitting inflates accuracy over cross-session splitting |
| H3 | Cross-subject accuracy falls far enough to change what the result means in practice |
| H4 | A class-correlated drift well below the signal amplitude produces clearly above-chance accuracy with zero neural information |

Same shape as the language case: accepted or refuted against measured numbers, with the variance
decomposition as the common statistical language across both cases.

## 4. Cost and schedule

Six days, with the language case already finished.

- **Day 1.** Download the 9 subjects. Implement the three protocols and the two models. Run the full
  sweep. This is a day because getting the splits right deserves care, not because the compute is
  slow.
- **Day 2.** Confound injection, variance decomposition, figures. Consolidate both cases into one
  analysis package that emits tables and figures directly.
- **Day 3.** Methodology and Results for both cases.
- **Day 4.** Introduction, theoretical foundations, related work. The foundations section now has to
  carry two domains, which is the one place the merged paper costs more than a single-case one.
- **Day 5.** Discussion, conclusion, AI declaration, references.
- **Day 6.** LaTeX, figures, read it aloud, compile, slack.

**The fallback matters more than the plan.** If the neural case is not producing clean results by the
end of day 2, drop it and ship the language case alone. That paper is already complete and needs only
writing, so the downside of trying is two days, not the grade.

## 5. What this is not

Not thought reading. The honest framing, which the paper should state early, is that this decodes
which of four trained movements a person is imagining, under a protocol where the person cooperated
and the system was calibrated on them. Saying so plainly is part of the paper's point: the gap
between "71% on four classes within subject" and "the computer knows what you are thinking" is
exactly the gap that configuration choices and loose reporting let people walk through.

That also keeps the topic the author likes without promising something the data cannot support.

## 6. Risks

- **Protocol implementation.** The pooled-split condition has to leak in the way real papers leak,
  which means splitting trials rather than sessions and not shuffling the drift away by accident. Get
  this wrong in the opposite direction and the headline effect disappears. Write it carefully and
  check that condition 2 reproduces the published cross-session numbers for this dataset.
- **Cross-subject needs channel alignment.** All 9 subjects share the same 22-channel montage here, so
  this is simple, but confirm it rather than assume.
- **Scope.** Two case studies in 16 pages means both get written tightly. The theoretical foundations
  section is the one that can bloat.
- **The download is one-time.** Keep `MNE_DATA` pointed at a stable directory so a reinstall does not
  refetch.
