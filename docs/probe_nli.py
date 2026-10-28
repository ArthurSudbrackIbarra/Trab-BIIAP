"""Exploratory: how well do the 12 published verdicts match the human gold label?"""
import json, collections

PATH = "/home/ibarra/Documents/Projetos/ideias-em-rede-kunumi-entrega/data/publichearingbr/PublicHearingBR_NLI.jsonl"
rows = []
with open(PATH) as f:
    for line in f:
        d = json.loads(line)
        for e in d["metadados_extraidos"]["envolvidos"]:
            for op in e["opinioes"]:
                v = op["verificacao_alucinacao"]
                gold = bool(v["verificacao_manual"])
                preds = {k: v[k]["alucinacao"] for k in v if k != "verificacao_manual"}
                rows.append((gold, preds))

keys = sorted(rows[0][1])
print(f"n = {len(rows)}   gold hallucinations = {sum(g for g, _ in rows)}\n")
print(f"{'condition':<34} {'prec':>6} {'rec':>6} {'F1':>6} {'flag%':>7}")
print("-" * 64)
stats = {}
for k in keys:
    tp = fp = fn = flag = 0
    for gold, preds in rows:
        p = bool(preds[k])
        flag += p
        if p and gold: tp += 1
        elif p and not gold: fp += 1
        elif not p and gold: fn += 1
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    stats[k] = (prec, rec, f1, flag / len(rows))
    print(f"{k:<34} {prec:6.3f} {rec:6.3f} {f1:6.3f} {flag/len(rows):7.1%}")

print("\nBy model family (mean over the 3 prompts):")
fam = collections.defaultdict(list)
for k, s in stats.items():
    fam[k.split("_", 2)[2]].append(s)
for name, vals in sorted(fam.items()):
    n = len(vals)
    print(f"  {name:<28} prec {sum(v[0] for v in vals)/n:.3f}  "
          f"rec {sum(v[1] for v in vals)/n:.3f}  F1 {sum(v[2] for v in vals)/n:.3f}  "
          f"flag {sum(v[3] for v in vals)/n:.1%}")
