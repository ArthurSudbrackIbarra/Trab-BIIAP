"""Feasibility probe: can a motor-imagery decoding experiment run on this machine?

Measured on the i7-4790, CPU only, 2026-10-30:
  install (mne + moabb + braindecode + torch, Python 3.12)  ok
  download, subject 1                       83 MB in 30 s
  epoching                                  4.8 s
  EEGNet, 2,484 parameters, 60 epochs       19.8 s  (0.33 s/epoch)
  cross-session accuracy, subject 1         0.712   (chance 0.25)
  extrapolated 9-subject sweep              ~3 min per condition

Conclusion: a full factorial over evaluation protocols, models and subjects costs
minutes, not hours. No GPU, no API, no budget.

Run with the scratch venv:  ./eegtest/bin/python probe_eeg_feasibility.py
"""
import os, time, warnings
warnings.filterwarnings("ignore")
os.environ["MNE_DATA"] = os.path.abspath("mne_data")
import numpy as np, torch, mne
mne.set_log_level("ERROR")
from moabb.datasets import BNCI2014_001
from moabb.paradigms import MotorImagery

t0 = time.time()
paradigm = MotorImagery(n_classes=4, fmin=4, fmax=38, resample=128)
X, y, meta = paradigm.get_data(BNCI2014_001(), subjects=[1])
print(f"epoching: {time.time()-t0:.1f}s   X={X.shape}  classes={sorted(set(y))}")
print(f"sessions={sorted(set(meta.session))}  trials/session={len(X)//len(set(meta.session))}")

from braindecode.models import EEGNet
torch.manual_seed(0)
classes = sorted(set(y))
yi = np.array([classes.index(v) for v in y])
tr = (meta.session == sorted(set(meta.session))[0]).values
Xtr = torch.tensor(X[tr], dtype=torch.float32); ytr = torch.tensor(yi[tr])
Xte = torch.tensor(X[~tr], dtype=torch.float32); yte = torch.tensor(yi[~tr])
mu, sd = Xtr.mean(), Xtr.std()
Xtr, Xte = (Xtr - mu) / sd, (Xte - mu) / sd

net = EEGNet(n_chans=X.shape[1], n_outputs=4, n_times=X.shape[2])
print("params:", sum(p.numel() for p in net.parameters()))
opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
lossf = torch.nn.CrossEntropyLoss()
t0 = time.time()
EPOCHS = 60
for ep in range(EPOCHS):
    net.train()
    perm = torch.randperm(len(Xtr))
    for i in range(0, len(perm), 32):
        b = perm[i:i+32]
        opt.zero_grad(); loss = lossf(net(Xtr[b]), ytr[b]); loss.backward(); opt.step()
el = time.time() - t0
net.eval()
with torch.no_grad():
    acc = (net(Xte).argmax(1) == yte).float().mean().item()
print(f"{EPOCHS} epochs on CPU: {el:.1f}s  ({el/EPOCHS:.2f}s/epoch)")
print(f"cross-session accuracy (train session 0 -> test session 1): {acc:.3f}  chance=0.25")
print(f"=> full 9-subject sweep, one condition: ~{el*9/60:.1f} min")
