# A tool: type with a real person's recorded brain

Proposal for the BIIAP paper as a standalone brain-decoding project, written 2026-10-30. A concrete,
creative artifact, backed by evidence that is **already computed** on this machine.

## 1. The idea in one paragraph

A browser app where you pick one of nine real people, type a word, and watch that person's real
recorded brain activity try to type it for you. Each letter needs a few imagined movements (left
hand, right hand, feet, tongue). For each one the app plays a real trial in which that person was
imagining that movement, a decoder trained on that person reads it, and the letter moves forward or
goes wrong exactly as the real brain and the real decoder would make it go. With person 3 the word
appears in a minute and a half. With person 5 it never appears. A slider lets you make the system
wait until it is confident, and you watch two of the three "hopeless" people start to type, slowly.

It is the Kunumi move again: take a real public dataset and put a person inside it. Hearings then,
brains now.

It is also the honest version of the original dream. You cannot spawn an apple by thinking "apple".
But a real person imagining their left hand can spawn one, with the real error rate attached, and a
game mode can show exactly that.

## 2. The evidence is already in hand

`docs/eeg_sweep.py` trains EEGNet per subject on session 1 of BCI Competition IV 2a and scores session
2, recorded on a different day. `docs/eeg_usability.py` turns the per-trial outputs into task-level
numbers. Whole thing: 404 seconds on this CPU, downloads included.

**Speller model.** The four decoded classes become three selection classes plus one undo. 27 symbols
(26 letters and space) is exactly 3³, so a character takes three correct selections. With one-step
undo, each trial makes an expected net progress of (2p − 1) selections when accuracy p exceeds 0.5,
and none otherwise. That is the utility metric of Dal Seno et al. (2010), a standard in the BCI
literature rather than something invented here. Decision time is 4 s, the decoding window, which
ignores rest periods and is therefore the generous case.

| Person | Accuracy | Wolpaw ITR (bits/min) | Letters/min | A 5-letter word | With best threshold |
|---|---|---|---|---|---|
| 1 | 0.712 | 10.15 | 2.12 | 2.4 min | 2.15 |
| 2 | 0.472 | 2.49 | 0 | **never** | 0.49 (acts on 25% of trials) |
| 3 | 0.837 | 16.49 | 3.37 | 1.5 min | 3.42 |
| 4 | 0.549 | 4.37 | 0.49 | 10.3 min | 0.69 |
| 5 | 0.333 | 0.38 | 0 | **never** | 0, nothing helps |
| 6 | 0.403 | 1.21 | 0 | **never** | 0.14 (acts on 16% of trials) |
| 7 | 0.677 | 8.71 | 1.77 | 2.8 min | 1.81 |
| 8 | 0.674 | 8.57 | 1.74 | 2.9 min | 1.81 |
| 9 | 0.816 | 15.29 | 3.16 | 1.6 min | 3.16 |

Mean accuracy 0.608, standard deviation 0.168.

What that table says:

- **Every one of the nine is above chance.** In a paper's results table, all nine "work".
- **Three of the nine cannot type a single letter.** Above chance and usable are different thresholds:
  0.25 and 0.5.
- **The mean describes nobody.** 0.608 sits between a person who types a word in 90 seconds and a
  person who never finishes one.
- **Waiting for confidence rescues two of the three**, at a steep price. Person 2 goes from never to
  half a letter a minute by acting on only a quarter of the trials. Person 5 cannot be rescued by this
  decoder at all.
- **It barely matters for the people who were already fine.** Thresholding moves person 3 from 3.37
  to 3.42.

## 3. Research question and hypotheses

**RQ.** How does the decoding accuracy that brain-computer interface research reports translate into
what a person can actually do with the system?

| | Hypothesis | Status on data in hand |
|---|---|---|
| H1 | Every subject decodes above chance, but a substantial share cannot make net progress in a practical task | **supported**, 9 of 9 above chance, 3 of 9 cannot type |
| H2 | Task-level usability varies across people far more than the mean accuracy conveys | **supported**, 0 to 3.37 letters per minute |
| H3 | Rejecting low-confidence decisions turns unusable decoders into usable ones | **partly supported**, 2 of 3 rescued, 1 not, and the rescue costs most of the trials |
| H4 | A decoder trained on other people lets a newcomer type with no calibration session | **to test**, leave-one-subject-out; expected to be refuted, which answers the "put on the cap and play" question directly |

H4 is cheap (nine more trainings on this CPU) and it is the one most likely to fail, which is what
makes it worth including.

**Why this is a BIIAP paper and not only a BCI paper.** The benefit of AI here is real and
remarkable: a 2,484-parameter network decodes imagined movement from scalp electrodes for most people,
with no surgery, on a ten-year-old CPU, in twenty seconds of training. The impact is that the metric
the research community reports (accuracy above chance, averaged over subjects) and the outcome a human
cares about (can I type my name) diverge, and the reporting conventions hide the people for whom it
fails. The tool is a way of communicating an AI research result that makes that gap visible instead
of averaging it away.

**Link to the master's.** `voicemark-br` asks whether a watermark detector's verdict survives the real
path from a synthetic voice to its victim. This asks whether a decoder's accuracy survives the path to
a person trying to use it. Both are about the distance between a detector's number and what happens
in practice.

## 4. The tool

Same stack as the Kunumi game, which the author already knows: Vite, React, TypeScript, a static site
on GitHub Pages, no server, no model running at play time. Offline Python produces JSON, the browser
replays it.

**Offline (Python).** For each of the nine people, from the session-2 test trials: the cued class, the
decoder's four probabilities, and a short downsampled snippet of the three motor-cortex channels (C3,
Cz, C4) for display. Roughly a few megabytes in total.

**In the browser.**

- **Person picker.** "Pessoa 1" to "Pessoa 9", anonymous, as the dataset is.
- **Speller.** You type a target word. For each selection the word needs, the app draws one of that
  person's real trials whose cue matches the needed class and applies the decoder's real output. The
  letter advances, goes wrong, or gets undone. This is the standard offline simulation of online use
  in BCI research: real trials, real decoder, real errors, conditioned on intent.
- **Live view.** The scrolling EEG of C3, Cz and C4 for the trial being played, and four probability
  bars filling as the decoder decides. Intended movement and decoded movement side by side.
- **Confidence slider.** Drag it and the system waits for certainty. Speed and reliability trade off
  in front of you.
- **Game mode.** The four imagined movements spawn four objects. The apple, made honest.
- **Comparison view.** All nine people trying the same word at once. The single most striking image
  for the paper and the video.

**Optional, only if time is left.** EEGNet is 2,484 parameters, small enough to run in the browser
with `onnxruntime-web`, so the decoder could genuinely run live on the replayed signal. Visually the
same as precomputed probabilities, so it is a nice touch, not a requirement.

## 5. Paper structure

Target 14 to 16 pages.

| Section | Content | Pages |
|---|---|---|
| Abstract | The gap between above-chance and usable, measured on nine real people, and the tool that shows it | 0.3 |
| 1. Introduction | The popular idea of mind reading against what non-invasive decoding does; the author's master's and the Kunumi work as context; problem; RQ; H1 to H4; objective; structure | 2 |
| 2. Theoretical foundations | EEG and what it can see; motor imagery and the mu and beta rhythms; EEGNet; accuracy, chance level, Wolpaw ITR and the utility metric; why a speller needs p above 0.5; confidence rejection | 3 |
| 3. Related work | BCI spellers, BCI inefficiency, offline simulation of online performance, decoding benchmarks and how they report results, public BCI demos. Table showing what this tool does that they do not | 2 |
| 4. Methodology | Dataset, preprocessing, the cross-session protocol, training, the speller model, the threshold sweep, the leave-one-subject-out test, the tool's replay design. Enough to reproduce | 3 |
| 5. Results and discussion | The table above, the threshold curves, the cross-subject result, the tool, and the author's reading of each | 3.5 |
| 6. Conclusion | Findings, limitations, future work, benefits and impacts of AI | 1.5 |
| AI usage declaration | Mandatory | 0.3 |

## 6. Six days

The evidence is done. The work left is the tool and the writing, and the tool is the part that can
slip without costing the grade, because the results come from the simulation, not from the tool.

- **Day 1.** Set the project up properly (a `pyproject.toml` with mne, moabb, braindecode, torch on
  Python 3.12). Run the leave-one-subject-out test for H4. Export the JSON for the tool.
- **Day 2.** The speller engine as a pure, seeded function, the way the Kunumi game's engine was
  built, so the tool's behaviour can be tested and reproduced. A working, ugly page.
- **Day 3.** EEG traces, probability bars, slider, comparison view, game mode. Deploy to GitHub Pages.
- **Day 4.** Methodology and Results, with figures generated from the scripts.
- **Day 5.** Introduction, Theoretical foundations, Related work.
- **Day 6.** Discussion, Conclusion, AI declaration, LaTeX, compile.

If day 3 slips, ship the speller without game mode and comparison view, and use screenshots.

## 7. Limitations to state plainly

- **Replay is not closed loop.** In a live BCI the person sees feedback and their brain signal adapts.
  Offline replay cannot capture that; it is the standard simulation, and it is a known limitation of
  it.
- **One dataset, nine people, one paradigm.** BCI Competition IV 2a is the field's reference dataset,
  which is why it is useful, and also why nine people is all there is.
- **One decoder, one training recipe.** A better decoder would move the numbers. The gap between above
  chance and usable would remain, because it is a property of the task arithmetic, not of the network.
- **The 4-second decision time is generous.** A real trial in this dataset, with fixation and rest,
  is roughly twice that, which roughly halves every letters-per-minute figure.
- **This is not thought reading.** It decodes which of four trained movements a cooperating person is
  imagining. The paper should say so early, because the distance between that and "the computer knows
  what you think" is the very gap the paper is about.

## 8. Open questions

- **Data licence.** BCI Competition IV 2a is freely available for research. Check its terms before
  publishing per-trial probabilities and EEG snippets on a public site.
- **Authorship.** Still open: the assignment requires the advisor and co-advisor as collaborating
  co-authors, and the work is individual. Ask the professors directly.
- **The video.** The comparison view (nine people typing the same word) is the obvious centrepiece.
- **Ethics.** Public, anonymised data collected under the original study's consent. Reanalysis is not
  a user study. One sentence in Methodology.
- **Name.** The author's call. The last one was a pun in two regional dialects and an English phrase.
