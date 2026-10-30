"""From real decoder outputs to what a user would experience. No users involved.

Speller model: 4 decoded classes = 3 selection classes + 1 undo. 27 symbols (26 letters + space) = 3^3,
so a character takes exactly 3 correct selections. With one-step undo, each trial yields an expected
net progress of (2p - 1) selections when p > 0.5, and zero or negative progress otherwise (the utility
metric of Dal Seno et al. 2010). Decision time T = 4 s, the length of the decoding window, which
ignores rest periods and so is the optimistic case.
"""
import math
import numpy as np

T = 4.0
TRIALS_PER_MIN = 60 / T
SEL_PER_CHAR = 3
rows = np.load("sweep.npy", allow_pickle=True)


def wolpaw(p, n=4):
    if p <= 1 / n:
        return 0.0
    bits = math.log2(n) + p * math.log2(p) + (1 - p) * math.log2((1 - p) / (n - 1)) if p < 1 else math.log2(n)
    return bits * TRIALS_PER_MIN


def chars_per_min(p, accept=1.0):
    return max(0.0, (2 * p - 1)) * TRIALS_PER_MIN * accept / SEL_PER_CHAR


print(f"{'subj':>4} {'acc':>6} {'ITR b/min':>10} {'chars/min':>10} {'5-letter word':>15}"
      f" | {'best thresh':>11} {'kept':>5} {'acc kept':>9} {'chars/min':>10}")
print("-" * 98)
accs = []
for s, p, t in rows:
    pred, conf = p.argmax(1), p.max(1)
    acc = (pred == t).mean(); accs.append(acc)
    cpm = chars_per_min(acc)
    word = f"{5/cpm:.1f} min" if cpm > 0 else "never"
    best = (0.0, 1.0, acc, cpm)
    for tau in np.arange(0.25, 0.96, 0.05):
        keep = conf >= tau
        if keep.sum() < 20:
            continue
        a = keep.mean(); pa = (pred[keep] == t[keep]).mean()
        c = chars_per_min(pa, a)
        if c > best[3]:
            best = (tau, a, pa, c)
    tau, a, pa, c = best
    print(f"{s:>4} {acc:6.3f} {wolpaw(acc):10.2f} {cpm:10.2f} {word:>15}"
          f" | {tau:11.2f} {a:5.0%} {pa:9.3f} {c:10.2f}")
accs = np.array(accs)
print("-" * 98)
print(f"mean accuracy {accs.mean():.3f} (sd {accs.std():.3f}), every subject above chance 0.25: {bool((accs > 0.25).all())}")
print(f"subjects at or below 0.5 (cannot make net progress without a threshold): {int((accs <= 0.5).sum())} of {len(accs)}")
