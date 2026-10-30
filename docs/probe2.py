"""Second probe: what the published verdicts alone can support, with no API calls.

Agreement structure, ensembling, the factorial decomposition and the items every condition misses.
"""
import json, itertools, statistics

PATH = "/home/ibarra/Documents/Projetos/ideias-em-rede-kunumi-entrega/data/publichearingbr/PublicHearingBR_NLI.jsonl"

gold, preds, meta = [], [], []
with open(PATH) as f:
    for line in f:
        d = json.loads(line)
        for e in d["metadados_extraidos"]["envolvidos"]:
            for op in e["opinioes"]:
                v = op["verificacao_alucinacao"]
                gold.append(bool(v["verificacao_manual"]))
                preds.append({k: bool(v[k]["alucinacao"]) for k in v if k != "verificacao_manual"})
                meta.append({"op_len": len(op["opiniao"]),
                             "chunk_len": sum(len(c) for c in op["chunks_proximos"]),
                             "expl": [v[k].get("explicacao", "") for k in v if k != "verificacao_manual"]})

K = sorted(preds[0])
N = len(gold)
PROMPTS = sorted({k.split("_")[1] for k in K})
MODELS = sorted({k.split("_", 2)[2] for k in K})


def kappa(a, b):
    """Cohen's kappa between two boolean label vectors."""
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return (po - pe) / (1 - pe) if pe < 1 else 0.0


def scores(vec):
    tp = sum(p and g for p, g in zip(vec, gold))
    fp = sum(p and not g for p, g in zip(vec, gold))
    fn = sum((not p) and g for p, g in zip(vec, gold))
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return prec, rec, f1, sum(vec) / len(vec)


cols = {k: [p[k] for p in preds] for k in K}

print(f"n = {N}, human hallucination rate = {sum(gold)/N:.4f}\n")

print("=" * 70)
print("A3. Do the judges agree with each other more than with the humans?")
print("=" * 70)
inter = [kappa(cols[a], cols[b]) for a, b in itertools.combinations(K, 2)]
human = [kappa(cols[k], gold) for k in K]
print(f"  judge vs judge   mean kappa = {statistics.mean(inter):.3f}  (n={len(inter)} pairs)")
print(f"  judge vs human   mean kappa = {statistics.mean(human):.3f}  (n={len(human)})")
same_prompt = [kappa(cols[a], cols[b]) for a, b in itertools.combinations(K, 2)
               if a.split("_")[1] == b.split("_")[1]]
same_model = [kappa(cols[a], cols[b]) for a, b in itertools.combinations(K, 2)
              if a.split("_", 2)[2] == b.split("_", 2)[2]]
print(f"  same prompt, different model: mean kappa = {statistics.mean(same_prompt):.3f}")
print(f"  same model, different prompt: mean kappa = {statistics.mean(same_model):.3f}")

print()
print("=" * 70)
print("A4. Does voting rescue it?")
print("=" * 70)
best = max(K, key=lambda k: scores(cols[k])[2])
print(f"  best single condition ({best}):")
print("      prec {:.3f}  rec {:.3f}  F1 {:.3f}  flag {:.1%}".format(*scores(cols[best])))
maj12 = [sum(p[k] for k in K) >= 7 for p in preds]
print("  majority of all 12:  prec {:.3f}  rec {:.3f}  F1 {:.3f}  flag {:.1%}".format(*scores(maj12)))
unan = [all(p[k] for k in K) for p in preds]
print("  unanimous 12:        prec {:.3f}  rec {:.3f}  F1 {:.3f}  flag {:.1%}".format(*scores(unan)))
for pr in PROMPTS:
    sub = [k for k in K if k.split("_")[1] == pr]
    mv = [sum(p[k] for k in sub) >= 3 for p in preds]
    print(f"  majority of 4 models, prompt {pr}:  "
          "prec {:.3f}  rec {:.3f}  F1 {:.3f}  flag {:.1%}".format(*scores(mv)))

print()
print("=" * 70)
print("A1. Two-way decomposition of the reported rate (3 prompts x 4 models)")
print("=" * 70)
for outcome, idx in (("flag rate", 3), ("F1", 2)):
    cell = {(pr, mo): scores(cols[f"prompt_{pr}_{mo}"])[idx] for pr in PROMPTS for mo in MODELS}
    grand = statistics.mean(cell.values())
    pm = {pr: statistics.mean(cell[(pr, mo)] for mo in MODELS) for pr in PROMPTS}
    mm = {mo: statistics.mean(cell[(pr, mo)] for pr in PROMPTS) for mo in MODELS}
    ss_p = len(MODELS) * sum((v - grand) ** 2 for v in pm.values())
    ss_m = len(PROMPTS) * sum((v - grand) ** 2 for v in mm.values())
    ss_t = sum((v - grand) ** 2 for v in cell.values())
    print(f"  {outcome}: grand mean {grand:.3f}, range {min(cell.values()):.3f} to {max(cell.values()):.3f}")
    print(f"      prompt {ss_p/ss_t:6.1%} of variance | model {ss_m/ss_t:6.1%} | interaction {(ss_t-ss_p-ss_m)/ss_t:6.1%}")

print()
print("=" * 70)
print("A6. Items every condition gets wrong")
print("=" * 70)
allwrong = [i for i in range(N) if all(preds[i][k] != gold[i] for k in K)]
missed = [i for i in allwrong if gold[i]]
falsed = [i for i in allwrong if not gold[i]]
print(f"  all 12 wrong: {len(allwrong)} items ({len(allwrong)/N:.1%})")
print(f"      {len(missed)} hallucinations nobody flagged ({len(missed)/sum(gold):.1%} of all hallucinations)")
print(f"      {len(falsed)} clean opinions everybody flagged")
allright = sum(1 for i in range(N) if all(preds[i][k] == gold[i] for k in K))
print(f"  all 12 right: {allright} items ({allright/N:.1%})")
if missed:
    mlen = statistics.mean(meta[i]["chunk_len"] for i in missed)
    alen = statistics.mean(m["chunk_len"] for m in meta)
    print(f"  mean chunk length: missed-by-all {mlen:.0f} chars vs corpus {alen:.0f}")
