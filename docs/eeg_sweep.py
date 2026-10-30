"""Train EEGNet per subject on BCI Competition IV 2a, session 1, and score session 2.

Saves the per-trial class probabilities to sweep.npy for eeg_usability.py. CPU only.
Measured 2026-10-30 on the i7-4790: 404 s for all 9 subjects, downloads included.

Cross-session accuracy, 4 classes, chance 0.25:
  S1 0.712  S2 0.472  S3 0.837  S4 0.549  S5 0.333  S6 0.403  S7 0.677  S8 0.674  S9 0.816
"""
import os, time, warnings
warnings.filterwarnings("ignore")
os.environ["MNE_DATA"] = os.path.abspath("mne_data")
import numpy as np, torch, mne
mne.set_log_level("ERROR")
from moabb.datasets import BNCI2014_001
from moabb.paradigms import MotorImagery
from braindecode.models import EEGNet

paradigm = MotorImagery(n_classes=4, fmin=4, fmax=38, resample=128)
ds = BNCI2014_001()
rows = []
t_all = time.time()
for s in range(1, 10):
    X, y, meta = paradigm.get_data(ds, subjects=[s])
    classes = sorted(set(y)); yi = np.array([classes.index(v) for v in y])
    sess = sorted(set(meta.session)); tr = (meta.session == sess[0]).values
    Xtr = torch.tensor(X[tr], dtype=torch.float32); ytr = torch.tensor(yi[tr])
    Xte = torch.tensor(X[~tr], dtype=torch.float32); yte = torch.tensor(yi[~tr])
    mu, sd = Xtr.mean(), Xtr.std(); Xtr, Xte = (Xtr-mu)/sd, (Xte-mu)/sd
    torch.manual_seed(0)
    net = EEGNet(n_chans=X.shape[1], n_outputs=4, n_times=X.shape[2])
    opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
    lf = torch.nn.CrossEntropyLoss()
    for ep in range(60):
        net.train(); perm = torch.randperm(len(Xtr))
        for i in range(0, len(perm), 32):
            b = perm[i:i+32]
            opt.zero_grad(); lf(net(Xtr[b]), ytr[b]).backward(); opt.step()
    net.eval()
    with torch.no_grad():
        p = torch.softmax(net(Xte), 1).numpy()
    rows.append((s, p, yte.numpy()))
    print(f"  subject {s}: acc {(p.argmax(1)==yte.numpy()).mean():.3f}", flush=True)
print(f"total {time.time()-t_all:.0f}s")
np.save("sweep.npy", np.array([(s, p, t) for s, p, t in rows], dtype=object), allow_pickle=True)
