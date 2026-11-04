# Paper plan: "Is AI delving into Brazilian science?"

Plan as of 2026-11-03. Writing starts once the IAês site is final, so its screens can go into the
paper as figures.

The draft was written on 2026-11-04 in `Artigo/paper.tex`. Changes from this plan: the H3 table
became two sentences in the text; the H2 figure is a pgfplots chart of the year-by-year test, not
the site's hexbins; the word map is out; the AI-use declaration is brief, by the author's decision;
about 50 references are cited, each claim checked against its source; and, after the ENIAC-style
review, H2 reads as not supported (the 2024 English lead comes from an exploratory check) and H3
uses an exact McNemar test on the marker-control pairs. Deadline about 2026-11-05 (to confirm). Paper in English, SBC template, 12 to 20
pages, every text through the humanizer, no em dashes, no mention of the author's master's.
References: `Artigo/references.bib`, every DOI checked at doi.org (see "References" below).

## 1. Framing

**Title options**

1. Is AI delving into Brazilian science? The lexical footprint of LLM chatbots in Portuguese and
   English abstracts
2. Delving into Brazilian science: excess vocabulary of LLM chatbots in SciELO abstracts in two
   languages

**Research question.** Have LLM chatbots left a measurable lexical footprint in the abstracts of
Brazilian scientific journals, and is that footprint larger in the English abstract than in the
Portuguese abstract of the same paper?

**Thesis** (the one sentence the abstract, the introduction and the conclusion all repeat): by 2025
at least one in six SciELO Brasil abstracts carries the vocabulary of LLM chatbots, in Portuguese as
much as in English; English came first, in 2024, Portuguese caught up within a year, and the
Portuguese markers are largely translations of the English ones.

**Why it matters (the justification the assignment asks for)**

- Chatbots now edit, translate and draft scientific text, and researchers say so in surveys
  (Nature 2025 poll: 28% used AI to edit a paper; Wiley 2025: writing help is the most tried use),
  yet few disclose it (Gray 2024: about 1% of 2023 papers LLM-assisted against 767 disclosures).
- Text-based measurement avoids asking authors. Kobak et al. (2025) put at least 13.5% of 2024
  PubMed abstracts as LLM-processed; full-text studies now report most papers (Siler 2026: 57% of
  2025 articles; Holzwarth et al. 2026: 89% of PMC full texts). Nearly all of it is English.
- Brazil is a natural test of the language question. SciELO Brasil journals publish abstracts in
  Portuguese and English, the pressure to publish in English is strong (Meneghini and Packer 2007;
  Packer 2024), and writing in English costs non-native speakers time and rejections (Amano et al.
  2023; Ramírez-Castañeda 2020). Chatbots promise relief (Berdejo-Espinola and Amano 2023), and
  non-native authors adopt them faster (Kobak et al. 2025 by country; Liu et al. 2025).
- Brazilian rules now require disclosure: SciELO's guide (2023), CAPES (2025), CNPq Portaria
  2.664/2026 (Art. 9, I, c: declare any generative AI use, tool and purpose). Measuring use without
  relying on disclosure informs these policies.
- Gap: our search (seven Exa sweeps, 2026-11-03) found no study of LLM vocabulary in SciELO or in
  Portuguese scientific abstracts. Closest: Korean journal abstracts (Lee 2026, unreviewed
  preprint) and news in 34 languages (Juzek 2026, preprint).

**Hypotheses and what the evidence says**

| | Hypothesis | Verdict |
|---|---|---|
| H1 | Since 2023 some style words appear above their pre-2023 trend in both languages | Accepted |
| H2 | The footprint is larger in the English abstracts than in the Portuguese abstracts of the same papers | Only in 2024; not in 2025-2026 |
| H3 | Portuguese markers differ from the English ones and are mostly style words | Style: yes. Differ: refuted, they mirror the English markers |

**Contributions** (end of the introduction)

1. The first excess-vocabulary study of Portuguese and of SciELO, 2015 to 2026.
2. A same-paper test of the language question with paired Portuguese and English abstracts.
3. A cross-language test of whether the Portuguese markers are translations of English ones.
4. A rewriting experiment with three 2026 chatbots on pre-ChatGPT abstracts.
5. A cross-fitted lower bound, which removes the selection-on-the-same-data step of Kobak et al.
6. IAês, an open bilingual site that lets readers explore every word, field and paper.

## 2. Assignment checklist

| Required item | Where |
|---|---|
| English or Portuguese | English |
| AI use declared at the end, how and with which tools | Section "Declaration of AI use", after the conclusion, from `docs/ai-usage.md` |
| Research question, grounded and justified | Introduction, paragraphs 1 to 4 |
| One or more hypotheses | Introduction, H1 to H3 |
| SBC template, at most 20 pages (12 to 20) | Target 17 to 18 pages including references |
| Title, authors (advisor and co-advisor), affiliation | Arthur Sudbrack Ibarra, Rodrigo Coelho Barros, Lucas Silveira Kupssinskü; PPGCC, PUCRS, Porto Alegre |
| Abstract | About 200 words, `\begin{abstract}` only |
| Introduction: context, problem, question, hypotheses, objective, structure | Section 1 (no link to the master's: author's decision) |
| Theoretical foundations, didactic | Section 2 |
| Related work, with a table that shows what is new | Section 3, Table 1 |
| Methodology, enough to reproduce | Section 4, with commands, seeds and versions |
| Results and discussion: authorial opinions from data; accept or refute each hypothesis | Section 5, one subsection per hypothesis |
| Conclusion: findings, limitations, future work, benefits and impacts of AI | Section 6, with its own subsection on benefits and impacts |

## 3. Page budget

| Section | Pages | Floats |
|---|---|---|
| Title, authors, abstract | 0.75 | |
| 1 Introduction | 1.75 | |
| 2 Theoretical foundations | 2.25 | |
| 3 Related work | 1.5 | Table 1 |
| 4 Methodology | 3 | Figure 1 |
| 5 Results and discussion | 4.25 | Figures 2 to 6, Tables 2 to 5 |
| 6 Conclusion (with benefits and impacts of AI) | 1.25 | |
| Declaration of AI use | 0.5 | |
| References (about 40 cited) | 3 | |
| Total | 18.25 | |

About 4,500 words of text. The SBC style fits about 14 references per page (measured on
2026-11-03 by compiling all 115 entries), so every reference costs space: cite about 40, and if the
paper runs long, drop optional references first, then Figure 4.

## 4. Section outlines

### 1 Introduction

1. ChatGPT (OpenAI, 30 November 2022) and its successors write, edit and translate. Surveys:
   kwon2025ok, wiley2025explanaitions. Editorial rules ask for disclosure (nature2023tools,
   thorp2023chatgpt, cope2023authorship, icmje2026recommendations), but disclosure is rare
   (gray2024contamination; kwon2025ok: most users did not disclose).
2. Measuring use from the text itself: kobak2025delving (excess words, at least 13.5% in 2024),
   liang2025quantifying (up to 22% in computer science), siler2026diffusion and holzwarth2026most
   (full texts, 2025). Almost all on English corpora (kousha2026much, botes2026initial).
3. Brazil: SciELO (packer1998scielo, packer2021pioneirismo: 308 journals, about 22,500 articles a
   year in 2021), bilingual abstracts, pressure for English (meneghini2007there,
   packer2024multilingualism, solovova2018publish), costs for non-native authors
   (amano2023manifold, ramirezcastaneda2020disadvantages), chatbots as relief
   (berdejoespinola2023ai) and faster adoption by non-native authors (liu2025aiassisted;
   kobak2025delving: about 20% in China, South Korea and Taiwan against 5% in the UK and Australia).
   Brazilian rules: scielo2023guia, capes2025ia, cnpq2026portaria, gomes2025panorama.
4. Gap, research question, H1 to H3 with one line of grounding each, objective, contributions,
   structure of the paper.

### 2 Theoretical foundations

- **2.1 Language models and chatbots.** Next-token prediction; the transformer
  (vaswani2017attention); scale and few-shot behaviour (brown2020language); instruction tuning and
  learning from human feedback, which turns a model into a chatbot (ouyang2022training). Chatbots
  write and translate Portuguese well, with a style of their own (neves2024findings,
  huang2026pen).
- **2.2 Why chatbots have a vocabulary.** Preference tuning narrows output diversity
  (kirk2024understanding, padmakumar2024does). Words such as delve, intricate and underscore are
  overrepresented, most likely through human feedback (juzek2025delve, juzek2025overuse); the
  annotator-dialect hypothesis has weak support (chooi2026stylistic). Each model leaves its own
  fingerprint (sun2025idiosyncrasies), and the vocabulary moves between model versions
  (nakajima2026turnover; yakura2024empirical: delve odds about 300:1 for GPT-3.5 and GPT-4, 40:1
  for GPT-4o). People can pick the words up (yakura2024empirical, anderson2025model) or avoid them
  once they become known (geng2025coevolution).
- **2.3 Measuring lexical change.** Document frequency (share of abstracts that contain a word) and
  corpus comparison by frequency (rayson2000comparing). The counterfactual idea from excess
  mortality (karlinsky2021tracking) carried to words (kobak2025delving): expected frequency from
  the pre-ChatGPT trend, frequency gap δ = p − q for common words, ratio r = p/q for rare ones,
  and the COVID years as a reminder that content words also surge.
- **2.4 From excess words to a lower bound, and why not detectors.** The share of abstracts with at
  least one marker, observed minus expected, counts only edits that leave a marker, so it is a
  floor. Detectors cannot replace it: unreliable (weberwulff2023testing, sadasivan2023can), biased
  against non-native writers (liang2023gpt, pratama2025accuracy, park2026style) and weak in
  Portuguese (candido2025analise: up to about 30% false positives on human texts). Choosing the
  markers and measuring on the same data inflates the estimate (kriegeskorte2009circular);
  sample splitting with cross-fitting avoids it (chernozhukov2018double).
- **2.5 The bilingual abstract as a paired design.** Short: the facts about SciELO and English
  stay in the introduction; here only why two abstracts of the same paper give a within-paper
  comparison (same topic, authors, journal and year, different language), and what it cannot
  separate (who wrote or translated each version). Linguistic injustice (hanauer2018linguistic)
  in one sentence.
- **2.6 Statistical tools, briefly.** z test with Benjamini-Hochberg FDR (benjamini1995controlling),
  bootstrap (efron1979bootstrap), difference in differences (angrist2009mostly), Cohen's kappa
  (cohen1960coefficient), Fisher's exact test (fisher1922interpretation).

### 3 Related work

- **Estimates from text, English corpora:** kobak2025delving; liang2025quantifying and
  liang2024monitoring (peer reviews); gray2024contamination and gray2025estimating; geng2024transforming
  (about 35% of computer-science abstracts); matsui2025delving; uribe2024estimating (dentistry);
  kousha2026much; botes2026initial (linguistics, about 16% above trend in 2025); cao2026visualizing
  (sociology, 24.3% of sentences in late 2025); siler2026diffusion; holzwarth2026most;
  bao2025where (classifier, country differences).
- **Language background:** liu2025aiassisted, prakash2025writing, lin2025reshape,
  filimonovic2026converge (non-English-country papers converge to U.S. English), berni2026ophthalmology.
- **Other languages:** lee2026korean (Korean abstracts: excess appears in the English abstracts a
  year before the Korean ones, the same pattern as our H2 timing; unreviewed), juzek2026crosslingual
  (news, 34 languages), candido2025analise (detectors in Portuguese).
- **Dynamics:** geng2025coevolution, mak2025style, thelwall2026have, anderson2025model.
- **Table 1** (what sets this study apart): study, corpus, languages, years, method, main estimate,
  with a note that the estimates measure different things (a floor on abstracts, a share of
  sentences, any excess in a full text) and cannot be ranked against each other.
  Rows: Kobak 2025; Liang 2025; Gray 2025; Geng and Trotta 2024; Botes 2026; Siler 2026;
  Holzwarth 2026; Liu 2025; Lee 2026; this study (SciELO Brasil, PT and EN, 2015-2026,
  same-paper pairs, cross-fitted bound, cross-language test, experiment, site).

### 4 Methodology

- **4.1 Overview** with Figure 1 (pipeline: harvest, cleaning, excess words, labels, lower bound,
  H2, H3, experiment, site).
- **4.2 Data.** 427 SciELO Brasil journals and their areas (ArticleMeta API); Crossref abstracts
  2015 to 2026, harvested 2026-10-30, 2026 through October; cleaning (`excess.py prepare`, check
  the filters in the code: length, language, duplicates, errata and retractions) leaves 204,937
  usable abstracts (94,882 Portuguese, 100,718 English, 9,337 Spanish, set aside). Crossref
  coverage gaps (69 journals with none; journals that stopped and restarted depositing), hence
  the balanced panel. ArticleMeta sample: 1,300 articles a year (seed 20261030), 9,312 usable
  papers with both abstracts. Say why two sources: Crossref keeps one abstract per article, in its
  main language, so it gives the whole corpus per language (H1, the bound, H3) but no pairs;
  ArticleMeta keeps every language but costs 1 to 3 s per article, so it gives a sample with pairs
  (H2).
- **4.3 Excess vocabulary.** Words of at least four letters, document frequency smoothed
  (a + 1)/(b + 1); counterfactual q = p(Y-2) + 2·max(p(Y-2) − p(Y-3), 0) with 2023 left out;
  rolling and fixed (2021-2022) baselines; balanced panel (5 or more abstracts per journal and
  year); length standardization to the baseline deciles; excess if δ > 0.01 or
  r > 2^(−log10 p / 4) (state the rule we use; Kobak's printed formula lacks a visible minus
  sign, do not call it a typo); at least 10 abstracts, z test with BH FDR 0.05, at least 5
  journals with none above half the uses. List each change from Kobak et al. and why (corpus
  about a hundred times smaller than PubMed).
- **4.4 Labels.** Claude Opus (`claude -p`) labels every excess word style, content or ambiguous,
  blind to the year; the author labels a blind sample of 100 per language; agreement 72% (kappa
  0.50) and 67% (kappa 0.36); the author's labels replace Claude's for those words.
- **4.5 Lower bound.** Marker set: excess style words with frequency below the T that maximizes the
  gap (Kobak's rare set; no hand-picked common set). Cross-fitted on two halves by DOI; same-data
  version reported for comparison; placebo with the 2015-2016 span; by area.
- **4.6 H2, same papers.** Each paper's abstracts checked against the cross-fitted sets of the
  other half; share of abstracts with a marker per language; difference in differences from
  2021-2022 to 2025-2026 against a flat baseline; length quintiles; 2,000 bootstrap resamples within
  years; placebo; robustness variants; the 2025 sets on every year for timing.
- **4.7 H3, cross-language.** 349 Portuguese and 437 English markers (excess style words of
  2024-2026, either baseline); frequency-matched style controls never excess; dictionary forms and
  blind, shuffled translation by Claude; a hit is a translation that matches a marker of the other
  language; one-sided Fisher test.
- **4.8 Rewriting experiment.** 80 abstracts per task from 2019-2021, ten per SciELO area, two per
  journal in a first pass and more where an area has few journals; tasks polish-pt, polish-en,
  translate-pt-en; prompts in `experiment/prompts/`; ChatGPT (GPT-6, free, temporary chats),
  Gemini 3.6 Flash (Google AI Pro), Claude Sonnet 5.5 (`claude -p`, no tools; about 900 tokens of
  Claude Code context remain); dates 2026-10-30 and 31; checks by `experiment.py ingest`;
  analysis by `experiment.py analyze`.
- **4.9 The IAês site** and **4.10 Reproducibility**: same frames as the paper; Python standard
  library only; commands and run times; hardware; code, data and site addresses (the author will
  make the repository public before submission).

### 5 Results and discussion

- **5.1 H1.** Figure 2 (excess style and content words per year and language): English 14, 50,
  108, 150 style words in 2023-2026 and Portuguese 2, 10, 69, 126, against 0 to 6 a year before;
  content words dominate 2020-2021 (COVID). Figure 3 (site, Words over time): underscore (20.7×
  expected in 2025), examines (6.4×), crucial in Portuguese (5.7×). H1 accepted. Optional
  Figure 4 (site, Word map).
- **5.2 How many abstracts.** Table 2 (lower bound): English 11.2% (2024), 17.3% (2025), 15.8%
  (2026); Portuguese about 0 (2024), 12.7% (2025), 19.4% (2026); placebo near zero; same-data
  estimates 4 to 8 points higher (English 2025: 22.8%), the optimism that cross-fitting removes.
  Compare: Kobak 13.5% in PubMed 2024 (our same-data English 2024: 15.2%); about 20% for China and
  5% for the UK; botes2026initial 16% in 2025; lee2026korean 10.5% and 16.1% for Korean in 2025
  and 2026. Figure 5 (site, Fields heatmap): English highest in human and health sciences in 2025.
- **5.3 H2.** Table 3 and Figure 6 (site, PT × EN). From 2021-2022 to 2025-2026 English rose 17.5
  points and Portuguese 14.9; difference 2.7 [−1.8, 7.4], p = 0.12, no larger than the placebo
  (2.4). In 2024 English led (8.6 against 1.8 points, difference 6.8 [0.8, 12.8]); Portuguese
  caught up in 2025. Growth is in papers with markers in both abstracts (15% to 31%), not English
  only (23% to 24%): the same tool likely touches both versions. H2 holds for 2024 only. State the
  precision: with about 750 papers a year the interval rules out an English excess larger than
  7.4 points, so "no difference" means no difference of that size.
- **5.4 H3.** Table 4: 72% of Portuguese markers translate into an English marker against 44% of
  controls (p = 3e-14); 49% against 22% the other way (p = 3e-17). Examples aprofunda/delves,
  ressaltando/highlighting, moldam/shaping; 28% Portuguese only (tensionam, multifacetada, agrava,
  perpetuando). Style half holds, "differ" half refuted: the chatbots' Portuguese carries an
  English accent (agarwal2025homogenize, filimonovic2026converge, juzek2026crosslingual).
- **5.5 The experiment.** Table 5 and Figure 7 (site, Time machine). Polishing English adds about 5
  markers per text with ChatGPT and Gemini, 1.1 with Claude; Portuguese 2.2, 2.4 and 0.8;
  translation 3.6, 1.5 and 0.3 (Claude not significant). Markers are far more common among added
  than dropped words (ChatGPT, English: 40 of 92 against 1 of 46, p = 4e-8). Markers catch an
  edit more often in English (29, 41 and 8 points) than in Portuguese (8, 14 and 0) with the 2025
  sets, so equal footprints may hide more editing in Portuguese. One polishing pass cannot
  calibrate the bound (implied shares from 35% to over 100%). Side notes: Gemini wrote LaTeX in 23
  of 240 texts; one translation batch was refused because the word "stop" read as an instruction.
- **5.6 Alternative explanations** (one paragraph each, with what the design does about it):
  machine translation and grammar tools, many of them LLM-based now, and human editing services
  (the method sees LLM-style vocabulary, not which tool or person produced it: say "LLM-based
  tools", and note that DeepL or Google Translate were not tested); authors picking up the words
  without any tool (yakura2024empirical, anderson2025model; Kobak et al. expect this to be small
  and slow in writing); journals entering and leaving Crossref (balanced panel); longer abstracts
  (length standardization); topic shifts such as COVID (style labels, spread filter, placebo);
  English-only policies of some journals (per-language corpora, same-paper test); multiple testing
  (FDR); choosing markers on the same data (cross-fitting); the partial 2026 (flagged throughout).
- **5.7 Discussion.** What a floor of one in six abstracts means next to full-text estimates of
  57% to 89%; the language gap was a lag, not a lasting difference; the English accent in
  Portuguese; markers decay (crucial in Portuguese falls from 1.63% of abstracts in 2025 to 0.79%
  in partial 2026, still above expected), consistent with coevolution and model turnover
  (geng2025coevolution, mak2025style, thelwall2026have, nakajima2026turnover), so monitoring needs
  fresh marker sets; why single texts cannot be judged (the X-ray screen).

### 6 Conclusion

- Findings: the answer to the research question and the verdict on each hypothesis.
- Limitations: Crossref coverage and the balanced panel; 2026 through October; a corpus about a
  hundred times smaller than PubMed (rough Portuguese sets in 2023-2024); markers are a floor and
  a proxy; style labels by an LLM with moderate agreement; H3 translations by an LLM; the
  experiment's 80 texts, one pass, specific model versions; abstracts only; Spanish left out; no
  causal attribution to authors.
- Future work: full texts, Spanish and the other SciELO collections, marker sets refreshed per
  model generation, disclosure statements against measured use, field policies.
- **Benefits and impacts of AI in this study** (its own subsection, required by the assignment):
  for Brazilian science, language equity and productivity (kusumegi2026scientific) against
  homogenization (agarwal2025homogenize, sourati2026shrinking), detector bias and undisclosed use;
  for this research, AI as an instrument (code, labels, translations, three chatbots as subjects,
  the site's design and build, the literature search) and its risks (the refusal, the need for
  the author's blind labels, DOI checks of every reference).

### Declaration of AI use

From `docs/ai-usage.md`: Claude Code (Claude Opus 5.5) for code, analyses, the site and drafting
(to be logged when writing); Claude Haiku 5.5 subagents with Exa search for the literature search
(logged 2026-11-03); Claude Opus 5.5 through `claude -p` for labels and translations; Claude in
Cowork and Claude Design for the site design; ChatGPT (GPT-6), Gemini 3.6 Flash and Claude Sonnet
5.5 as the experiment's subjects. Say what the author checked; the log still lists several checks
as pending, and the statement must not claim them before they are done.

## 5. Figures and tables

| # | Content | Source |
|---|---|---|
| Fig. 1 | Pipeline | TikZ |
| Fig. 2 | Excess style and content words per year, PT and EN | pgfplots from `analysis/report.md` |
| Fig. 3 | Words over time: underscore, examines, crucial | Site, `/en/words/`, 2× screenshot |
| Fig. 4 (optional) | Word map, English 2025 | Site, `/en/map/` |
| Fig. 5 | Fields heatmap, marker index | Site, `/en/fields/` |
| Fig. 6 | Same paper, PT × EN hexbins 2019 against 2025 | Site, `/en/pt-en/` |
| Fig. 7 | One abstract polished by ChatGPT, markers highlighted | Site, `/en/time-machine/` |
| Table 1 | Related work | Text |
| Table 2 | Lower bound by language and year, with same-data and placebo | `analysis/report.md` |
| Table 3 | H2 difference in differences and the 2024 timing | `analysis/pairs/report.md` |
| Table 4 | H3 hits against controls | `analysis/crosslang/report.md` |
| Table 5 | Experiment: markers per text by model and task | `analysis/experiment/report.md` |

Site figures come from the English site at 2× pixel density, cropped to the chart, with the
caption saying they are screenshots of IAês.

## 6. References

`Artigo/references.bib` holds the checked entries (keys used above). 108 DOIs resolved at
doi.org on 2026-11-03 and matched the titles the search returned; sources without a DOI (NeurIPS,
ICLR and ICML papers, policies, reports) carry their URL or arXiv id. Core set, about 45:

- Introduction and policy: openai2022chatgpt, kwon2025ok, wiley2025explanaitions, nature2023tools,
  thorp2023chatgpt, cope2023authorship, icmje2026recommendations, gray2024contamination,
  scielo2023guia, capes2025ia, cnpq2026portaria, gomes2025panorama.
- Brazil and language: packer1998scielo, packer2021pioneirismo, meneghini2007there,
  packer2024multilingualism, solovova2018publish, vasconcelos2007writing, amano2023manifold,
  ramirezcastaneda2020disadvantages, hanauer2018linguistic, berdejoespinola2023ai.
- Foundations: vaswani2017attention, brown2020language, ouyang2022training, kirk2024understanding,
  padmakumar2024does, juzek2025delve, juzek2025overuse, chooi2026stylistic, sun2025idiosyncrasies,
  rayson2000comparing, karlinsky2021tracking, weberwulff2023testing, liang2023gpt,
  candido2025analise, kriegeskorte2009circular, chernozhukov2018double, benjamini1995controlling,
  efron1979bootstrap, cohen1960coefficient, angrist2009mostly, fisher1922interpretation.
- Related work: kobak2025delving, liang2025quantifying, gray2025estimating, geng2024transforming,
  matsui2025delving, kousha2026much, botes2026initial, siler2026diffusion, holzwarth2026most,
  bao2025where, liu2025aiassisted, filimonovic2026converge, lee2026korean, juzek2026crosslingual.
- Dynamics and discussion: geng2025coevolution, mak2025style, thelwall2026have,
  anderson2025model, yakura2024empirical, nakajima2026turnover, kusumegi2026scientific,
  agarwal2025homogenize, sourati2026shrinking, huang2026pen, neves2024findings,
  pratama2025accuracy, park2026style.

Optional, if space allows: liang2024monitoring, uribe2024estimating, cao2026visualizing,
prakash2025writing, lin2025reshape, berni2026ophthalmology, sadasivan2023can, packer2025empreendimento.

**Check before quoting** (numbers the search agents flagged): holzwarth2026most (its abstract gives
32% and "above 50%" for Methods paragraphs); gray2024contamination (767 disclosures written as
">0.1%"); lee2026korean (single author, not peer reviewed: cite as a preprint and say so);
siler2026diffusion (an unpublished critique says the 57% is a distribution distance, not a share
of articles: describe it as "LLM-associated language", not as a prevalence); yakura2024empirical
(check the author list); kobak2025delving (13.5% in the abstract, 13.6% for the rare set alone).

## 7. Open items for the author

- Settled on 2026-11-03: authors Arthur Sudbrack Ibarra, Rodrigo Coelho Barros (advisor) and Lucas
  Silveira Kupssinskü (co-advisor); affiliation PPGCC, PUCRS; the author will make the repository
  public, so the paper gives the code, data and site addresses.
- Funding line, if any.
- Exact deadlines for the paper and the video.
- The site's address once GitHub Pages is on (the build takes `--base /Trab-BIIAP/`).
- The site's marker set: keep the H3 set (paper-consistent, dense highlights) or drop words below
  1.5×.
- The pending checks in `docs/ai-usage.md` (reviews of the analyses, translation spot checks):
  the AI-use declaration can only claim checks that were done.

## 8. Schedule

| Day | Work |
|---|---|
| 2026-11-03 | Site review and fixes finish; plan and references (this file); figures 1 and 2 |
| 2026-11-04 | Site screenshots; draft sections 1 to 6 with the humanizer; tables |
| 2026-11-05 | Author's read-through, AI-use declaration, final compile and submission |

The video (at most 5 minutes) is the author's: script and content are theirs. Claude can supply
graphics (site screenshots, figures) and check facts.

## 9. How the writing runs (skills)

- **anthropic-skills:paper-writing** (Claude Desktop): load it before drafting or revising any
  section.
- **academic-paper-composer** (`~/.claude/skills/academic-paper-composer/composer/`, written for
  philosophy preprints, so only its process applies): sections in the order introduction,
  foundations, related work, methodology, results, conclusion, abstract last; after each section a
  five-point check (argument, citations, clarity, structure, fit with the SBC template and the
  assignment), 4 points each, revise below 16 of 20; a coherence pass over the whole paper at the
  end (terms, promises of the introduction kept, citations spread).
- **anthropic-skills:humanizer**: on every section, every caption and the abstract (CLAUDE.md).
- **anthropic-skills:eniac-reviewer** (Claude Desktop): one independent review of the full draft by
  a subagent that sees only the PDF, before the author's read-through. Fix what it finds that
  holds up.
- **academic-paper-strategist** (`~/.claude/skills/academic-paper-strategist/strategist/`): its
  reviewer rubric was applied to this outline (below); its platform and sample-paper phase does
  not fit a course paper in the SBC template.

## 10. Reviewer check of this outline (strategist rubric, 2026-11-03)

| Dimension (1 to 5) | Score | Issue found and what changed |
|---|---|---|
| Argument clarity | 4 | No single thesis sentence: added one under the research question |
| Argument completeness | 4 | Alternative explanations were scattered: added section 5.6; H2 lacked a precision statement: added |
| Literature support | 4 | About 40 cited, key works present; Table 1 needed a note that the estimates are not comparable: added |
| Methodological clarity | 4 | Say why H1 uses one abstract per article (Crossref) and H2 both (ArticleMeta) |
| Originality expression | 4 | Novelty rests on a search that found nothing: write "to our knowledge" and cite the closest work |
| Organization | 4 | Brazilian context appeared in both 1 and 2.5: 2.5 now covers only the paired design |
| Fit with template and assignment | 4 | 18.25 of 20 pages is tight: site screenshots cropped to the chart, two side by side where possible |
| Total | 28 of 35 | Passes the 28 threshold; the changes above should raise clarity and completeness |
