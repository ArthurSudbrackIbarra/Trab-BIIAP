"""Third probe: the explanations, and where disagreement concentrates. No API calls."""
import json, statistics, collections

PATH = "/home/ibarra/Documents/Projetos/ideias-em-rede-kunumi-entrega/data/publichearingbr/PublicHearingBR_NLI.jsonl"
rows = []
with open(PATH) as f:
    for line in f:
        d = json.loads(line)
        for e in d["metadados_extraidos"]["envolvidos"]:
            for op in e["opinioes"]:
                v = op["verificacao_alucinacao"]
                rows.append((bool(v["verificacao_manual"]),
                             {k: v[k] for k in v if k != "verificacao_manual"}))
K = sorted(rows[0][1])
N = len(rows)

print("How many of the 12 conditions flag each item, against the human label")
print(f"{'flags':>6} {'items':>7} {'% of items':>11} {'% truly hallucination':>23}")
by_n = collections.defaultdict(lambda: [0, 0])
for gold, preds in rows:
    n = sum(bool(preds[k]["alucinacao"]) for k in K)
    by_n[n][0] += 1
    by_n[n][1] += gold
for n in sorted(by_n):
    tot, pos = by_n[n]
    print(f"{n:>6} {tot:>7} {tot/N:>10.1%} {pos/tot:>22.1%}")

print("\nExplanation length (characters), by whether the verdict was right")
for k in K:
    right = [len(preds[k].get("explicacao", "") or "") for gold, preds in rows
             if bool(preds[k]["alucinacao"]) == gold]
    wrong = [len(preds[k].get("explicacao", "") or "") for gold, preds in rows
             if bool(preds[k]["alucinacao"]) != gold]
    if right and wrong and statistics.mean(right) > 0:
        print(f"  {k:<34} right {statistics.mean(right):6.0f}  wrong {statistics.mean(wrong):6.0f}")

print("\nDoes prompt 2 return the excerpts it was asked for?")
p2 = [k for k in K if k.startswith("prompt_2")]
for k in p2:
    has = sum(1 for _, preds in rows if preds[k].get("trechos_para_basear_analise"))
    nt = [len(preds[k].get("trechos_para_basear_analise") or []) for _, preds in rows]
    print(f"  {k:<34} {has}/{N} carry excerpts, mean {statistics.mean(nt):.2f} per item")
