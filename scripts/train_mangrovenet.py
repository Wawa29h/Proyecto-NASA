"""MangroveNet: red neuronal (U-Net) que aprende a reconocer manglar, agua, árboles, cultivos... SOLO con radar NISAR.

Por qué: la foto óptica (Sentinel-2) falla con nubes; el radar NISAR ve cada 12 días con lluvia o de noche.
Si la red aprende a sacar el mapa de cobertura desde el radar, MANGLO puede vigilar el manglar sin esperar días despejados.

Entradas por píxel (de todas las pasadas NISAR del sitio): media, desviación, percentil 10 y 90 de HH y HV,
media de HH-HV y % de pasadas con dato  -> 10 canales.
Etiquetas: ESA WorldCover 2021 (10 m) agrupado en 6 clases.
Entrena en Jiquilisco + Cerrón Grande y se VALIDA en Barra de Santiago (un sitio que nunca vio): así medimos si generaliza.

Uso:
  python scripts/train_mangrovenet.py --minutes 2      # prueba corta
  python scripts/train_mangrovenet.py --minutes 90     # dejarlo entrenando
Salida: models/mangrovenet.pt, models/mangrovenet_log.csv, web/<sitio>/ref/mangrovenet.png y mangrovenet.json
"""
import argparse
import json
import os
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"barra": "web/data", "jiquilisco": "web/data-jiquilisco", "cerron": "web/data-cerron"}
TRAIN, VAL = ["jiquilisco", "cerron"], "barra"
CLASSES = ["agua", "manglar", "árboles", "cultivo", "pasto/arbusto", "suelo/urbano"]
COLORS = [(30, 136, 229), (0, 150, 90), (120, 200, 80), (240, 200, 60), (190, 170, 120), (200, 80, 70)]
WC2CLS = {80: 0, 95: 1, 10: 2, 40: 3, 20: 4, 30: 4, 90: 4, 50: 5, 60: 5}
IGNORE = 255


def load_site(name):
    base = os.path.join(ROOT, SITES[name])
    S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
    lo, hi = S["hh_range"]
    HH, HV = [], []
    for d in S["dates"]:
        if not d.get("qc", True):
            continue
        e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
        rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
        HH.append(np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan))
        HV.append(np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan))
    HH, HV = np.stack(HH), np.stack(HV)

    def pct(A, q):                       # percentil ignorando NaN (rápido: ordenar, los NaN quedan al final)
        n = np.isfinite(A).sum(0)
        idx = np.clip(np.floor(q * (n - 1)).astype(int), 0, A.shape[0] - 1)
        return np.where(n > 0, np.take_along_axis(np.sort(A, 0), idx[None], 0)[0], np.nan)

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        feats = [np.nanmean(HH, 0), np.nanmean(HV, 0), np.nanstd(HH, 0), np.nanstd(HV, 0),
                 pct(HH, .1), pct(HH, .9), pct(HV, .1), pct(HV, .9), np.nanmean(HH - HV, 0)]
    valid_frac = np.isfinite(HH).mean(0)
    # normalización fija en dB (igual para todos los sitios)
    norm = [(-15, 6), (-22, 6), (0, 3), (0, 3), (-15, 6), (-15, 6), (-22, 6), (-22, 6), (7, 4)]
    X = np.stack([(np.nan_to_num(f, nan=m) - m) / s for f, (m, s) in zip(feats, norm)] + [valid_frac]).astype(np.float32)
    codes = np.array(Image.open(os.path.join(base, "ref", "worldcover_codes.png")))
    Y = np.full(codes.shape, IGNORE, np.uint8)
    for k, v in WC2CLS.items():
        Y[codes == k] = v
    Y[valid_frac == 0] = IGNORE
    return X, Y, base


def block(i, o):
    return nn.Sequential(nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
                         nn.Conv2d(o, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True))


class UNet(nn.Module):
    def __init__(self, cin=10, n=len(CLASSES), w=32):
        super().__init__()
        self.e1, self.e2, self.e3, self.e4 = block(cin, w), block(w, 2 * w), block(2 * w, 4 * w), block(4 * w, 8 * w)
        self.u3, self.d3 = nn.ConvTranspose2d(8 * w, 4 * w, 2, 2), block(8 * w, 4 * w)
        self.u2, self.d2 = nn.ConvTranspose2d(4 * w, 2 * w, 2, 2), block(4 * w, 2 * w)
        self.u1, self.d1 = nn.ConvTranspose2d(2 * w, w, 2, 2), block(2 * w, w)
        self.out, self.drop = nn.Conv2d(w, n, 1), nn.Dropout2d(0.1)

    def forward(self, x):
        e1 = self.e1(x)
        e2 = self.e2(F.max_pool2d(e1, 2))
        e3 = self.e3(F.max_pool2d(e2, 2))
        e4 = self.drop(self.e4(F.max_pool2d(e3, 2)))
        d3 = self.d3(torch.cat([self.u3(e4), e3], 1))
        d2 = self.d2(torch.cat([self.u2(d3), e2], 1))
        d1 = self.d1(torch.cat([self.u1(d2), e1], 1))
        return self.out(d1)


@torch.no_grad()
def predict(model, X, dev, tile=256, pad=32):
    model.eval()
    C, H, W = X.shape
    Hp, Wp = -(-H // 8) * 8 + 2 * pad, -(-W // 8) * 8 + 2 * pad
    Xp = np.zeros((C, Hp, Wp), np.float32)
    Xp[:, pad:pad + H, pad:pad + W] = X
    prob = np.zeros((len(CLASSES), Hp, Wp), np.float32)
    step = tile - 2 * pad
    for y in range(0, Hp - 2 * pad, step):
        for x in range(0, Wp - 2 * pad, step):
            y0, x0 = min(y, Hp - tile), min(x, Wp - tile)
            t = torch.from_numpy(Xp[None, :, y0:y0 + tile, x0:x0 + tile]).to(dev)
            p = torch.softmax(model(t), 1)[0].float().cpu().numpy()
            prob[:, y0 + pad:y0 + tile - pad, x0 + pad:x0 + tile - pad] = p[:, pad:tile - pad, pad:tile - pad]
    return prob[:, pad:pad + H, pad:pad + W]


def metrics(pred, Y):
    m = Y != IGNORE
    p, y = pred[m], Y[m]
    out = {"accuracy": round(float((p == y).mean()), 4), "per_class": {}}
    f1s = []
    for i, c in enumerate(CLASSES):
        tp, fp, fn = int(((p == i) & (y == i)).sum()), int(((p == i) & (y != i)).sum()), int(((p != i) & (y == i)).sum())
        if tp + fn == 0:
            continue
        f1 = 2 * tp / max(2 * tp + fp + fn, 1)
        f1s.append(f1)
        out["per_class"][c] = {"f1": round(f1, 3), "iou": round(tp / max(tp + fp + fn, 1), 3),
                               "precision": round(tp / max(tp + fp, 1), 3), "recall": round(tp / max(tp + fn, 1), 3)}
    out["macro_f1"] = round(float(np.mean(f1s)), 4)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=90)
    ap.add_argument("--patch", type=int, default=128)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--eval-every", type=int, default=100, help="pasos entre validaciones")
    ap.add_argument("--predict-only", action="store_true", help="no entrenar: solo hacer los mapas con models/mangrovenet.pt")
    a = ap.parse_args()
    torch.manual_seed(0)
    rng = np.random.default_rng(0)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print("dispositivo:", torch.cuda.get_device_name(0) if dev == "cuda" else "CPU", flush=True)
    data = {s: load_site(s) for s in SITES}
    for s, (X, Y, _) in data.items():
        print(f"  {s}: {X.shape[1]}x{X.shape[2]} px, etiquetados {100 * (Y != IGNORE).mean():.0f}%", flush=True)
    # pesos por clase (las clases raras pesan más)
    counts = np.bincount(np.concatenate([data[s][1][data[s][1] != IGNORE] for s in TRAIN]), minlength=len(CLASSES))
    wts = torch.tensor((counts.sum() / np.maximum(counts, 1)) ** 0.5, dtype=torch.float32)
    wts = (wts / wts.mean()).to(dev)
    model = UNet().to(dev)
    opt = torch.optim.AdamW(model.parameters(), 2e-3, weight_decay=1e-4)
    total_s = a.minutes * 60
    os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
    log_p = os.path.join(ROOT, "models", "mangrovenet_log.csv")
    log = open(os.devnull if a.predict_only else log_p, "w", encoding="utf-8")
    log.write("paso,minuto,loss,val_accuracy,val_macro_f1,val_manglar_f1,val_agua_f1\n")
    best, t0, step, run_loss = -1, time.time(), 0, []
    P = a.patch

    def sample():
        xs, ys = [], []
        for _ in range(a.batch):
            X, Y, _ = data[TRAIN[rng.integers(len(TRAIN))]]
            for _try in range(10):
                y0, x0 = rng.integers(0, Y.shape[0] - P), rng.integers(0, Y.shape[1] - P)
                yy = Y[y0:y0 + P, x0:x0 + P]
                if (yy != IGNORE).mean() > 0.5:
                    break
            xx = X[:, y0:y0 + P, x0:x0 + P]
            k = rng.integers(4)
            xx, yy = np.rot90(xx, k, (1, 2)), np.rot90(yy, k)
            if rng.random() < 0.5:
                xx, yy = xx[:, :, ::-1], yy[:, ::-1]
            xx = xx + rng.normal(0, 0.05, xx.shape).astype(np.float32)       # ruido tipo speckle
            xs.append(np.ascontiguousarray(xx))
            ys.append(np.ascontiguousarray(yy))
        return torch.from_numpy(np.stack(xs)).to(dev), torch.from_numpy(np.stack(ys)).long().to(dev)

    Xv, Yv, _ = data[VAL]
    while not a.predict_only and time.time() - t0 < total_s:
        model.train()
        frac = (time.time() - t0) / total_s
        for g in opt.param_groups:                                           # coseno: baja el ritmo al final
            g["lr"] = 2e-3 * (0.02 + 0.98 * 0.5 * (1 + np.cos(np.pi * frac)))
        xb, yb = sample()
        with torch.autocast(dev, dtype=torch.bfloat16, enabled=dev == "cuda"):
            loss = F.cross_entropy(model(xb).float(), yb, weight=wts, ignore_index=IGNORE)
        opt.zero_grad()
        loss.backward()
        opt.step()
        run_loss.append(loss.item())
        step += 1
        if step % a.eval_every == 0:
            m = metrics(predict(model, Xv, dev).argmax(0), Yv)
            pc = m["per_class"]
            mins = (time.time() - t0) / 60
            log.write(f"{step},{mins:.1f},{np.mean(run_loss):.4f},{m['accuracy']},{m['macro_f1']},"
                      f"{pc['manglar']['f1']},{pc['agua']['f1']}\n")
            log.flush()
            tag = ""
            if m["macro_f1"] > best:
                best = m["macro_f1"]
                torch.save(model.state_dict(), os.path.join(ROOT, "models", "mangrovenet.pt"))
                tag = "  <- mejor, guardado"
            print(f"paso {step:6d} | {mins:5.1f} min | loss {np.mean(run_loss):.3f} | Barra (nunca vista): "
                  f"exactitud {m['accuracy']:.3f}  F1 manglar {pc['manglar']['f1']:.3f}  F1 medio {m['macro_f1']:.3f}{tag}", flush=True)
            run_loss = []
    log.close()
    if best < 0 and not a.predict_only:
        torch.save(model.state_dict(), os.path.join(ROOT, "models", "mangrovenet.pt"))
    model.load_state_dict(torch.load(os.path.join(ROOT, "models", "mangrovenet.pt"), map_location=dev))
    summary = {}
    for s, (X, Y, base) in data.items():
        prob = predict(model, X, dev)
        pred = prob.argmax(0)
        m = metrics(pred, Y)
        valid = X[-1] > 0
        img = np.zeros(pred.shape + (4,), np.uint8)
        for i, c in enumerate(COLORS):
            img[pred == i] = (*c, 220)
        img[~valid] = 0
        Image.fromarray(img, "RGBA").save(os.path.join(base, "ref", "mangrovenet.png"), optimize=True)
        px_km2 = None
        ref = os.path.join(base, "ref", "reference.json")
        bbox = json.load(open(ref, encoding="utf-8")).get("bbox") if os.path.exists(ref) else None
        if bbox:
            lat = np.radians((bbox[1] + bbox[3]) / 2)
            px_km2 = (bbox[2] - bbox[0]) * 111.32 * np.cos(lat) * (bbox[3] - bbox[1]) * 110.57 / pred.size
        info = {"model": "MangroveNet (U-Net, 10 canales NISAR HH/HV temporales)", "role": "validación" if s == VAL else "entrenamiento",
                "train_sites": TRAIN, "val_site": VAL, "labels": "ESA WorldCover 2021", "classes": CLASSES,
                "colors": ["#%02x%02x%02x" % c for c in COLORS], "metrics_vs_worldcover": m,
                "mangrove_km2_pred": round(float(((pred == 1) & valid).sum() * px_km2), 2) if px_km2 else None,
                "mangrove_km2_worldcover": round(float((Y == 1).sum() * px_km2), 2) if px_km2 else None,
                "minutes_trained": round((time.time() - t0) / 60, 1), "steps": step}
        json.dump(info, open(os.path.join(base, "ref", "mangrovenet.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        summary[s] = info
        print(f"{s} ({info['role']}): exactitud {m['accuracy']:.3f} | F1 manglar {m['per_class'].get('manglar', {}).get('f1', '-')} | "
              f"manglar {info['mangrove_km2_pred']} km2 (WorldCover {info['mangrove_km2_worldcover']})", flush=True)
    print("listo:", log_p)


if __name__ == "__main__":
    main()
