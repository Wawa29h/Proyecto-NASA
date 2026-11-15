"""Radar -> "foto sin nubes": red neuronal que convierte una pasada NISAR en una imagen parecida a Sentinel-2.

Para qué: en época de lluvias la foto óptica sale tapada por nubes durante semanas; el radar NISAR ve igual.
Con esto MANGLO puede mostrar una "foto aproximada" del manglar el día de cada pasada, aunque esté nublado.
OJO (honestidad): es una RECONSTRUCCIÓN aprendida, no una foto real. Se muestra siempre marcada como aproximada.

Pares de entrenamiento: cada pasada NISAR con la foto Sentinel-2 más cercana (máx. 15 días) en Barra y Cerrón.
Entradas (14 canales): HH, HV, HH-HV de ESA pasada + media/desviación temporal de HH y HV + percentiles,
                       fracción de pasadas con dato y la época del año (seno/coseno).
Red: U-Net (generador) + PatchGAN (discriminador) al estilo pix2pix; pérdida L1 + un poco de adversaria
     para que la imagen no salga borrosa.
Validación: el 20 % ESTE de cada sitio nunca se usa para entrenar; ahí se mide el error. Jiquilisco no tiene fotos:
     la red lo "imagina" desde cero (prueba de que generaliza).

Uso:
  python scripts/train_radar2photo.py --minutes 2        # prueba corta
  python scripts/train_radar2photo.py --minutes 120      # dejarlo entrenando
  python scripts/train_radar2photo.py --predict-only     # solo regenerar imágenes con el mejor modelo
Salida: models/radar2photo.pt, models/radar2photo_log.csv, web/<sitio>/ref/radarfoto_<fecha>.jpg y radarfoto.json
"""
import argparse
import datetime as dt
import json
import os
import time
import warnings

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"barra": "web/data", "jiquilisco": "web/data-jiquilisco", "cerron": "web/data-cerron"}
TRAIN = ["barra", "cerron"]           # sitios con fotos Sentinel-2
MAX_DAYS = 15
VAL_FRAC = 0.2                        # franja este reservada para validar
CIN = 14


def pct(A, q):
    n = np.isfinite(A).sum(0)
    idx = np.clip(np.floor(q * (n - 1)).astype(int), 0, A.shape[0] - 1)
    return np.where(n > 0, np.take_along_axis(np.sort(A, 0), idx[None], 0)[0], np.nan)


def load_site(name):
    base = os.path.join(ROOT, SITES[name])
    S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
    lo, hi = S["hh_range"]
    dates, HH, HV = [], [], []
    for d in S["dates"]:
        if not d.get("qc", True):
            continue
        e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
        rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
        HH.append(np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan))
        HV.append(np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan))
        dates.append(d["date"])
    HH, HV = np.stack(HH), np.stack(HV)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        ctx = np.stack([(np.nan_to_num(np.nanmean(HH, 0), nan=-15) + 15) / 6, (np.nan_to_num(np.nanmean(HV, 0), nan=-22) + 22) / 6,
                        np.nan_to_num(np.nanstd(HH, 0)) / 3, np.nan_to_num(np.nanstd(HV, 0)) / 3,
                        (np.nan_to_num(pct(HH, .1), nan=-15) + 15) / 6, (np.nan_to_num(pct(HH, .9), nan=-15) + 15) / 6,
                        (np.nan_to_num(pct(HV, .1), nan=-22) + 22) / 6, (np.nan_to_num(pct(HV, .9), nan=-22) + 22) / 6,
                        np.isfinite(HH).mean(0)]).astype(np.float32)
    ref = json.load(open(os.path.join(base, "ref", "reference.json"), encoding="utf-8"))
    photos = {p["date"]: os.path.join(base, p["img"]) for p in ref.get("sentinel2") or []}
    return {"name": name, "base": base, "dates": dates, "HH": HH, "HV": HV, "ctx": ctx, "photos": photos}


def inputs(site, i):
    hh, hv = site["HH"][i], site["HV"][i]
    valid = np.isfinite(hh)
    doy = dt.date.fromisoformat(site["dates"][i]).timetuple().tm_yday / 365.25 * 2 * np.pi
    ny, nx = hh.shape
    own = np.stack([(np.nan_to_num(hh, nan=-15) + 15) / 6, (np.nan_to_num(hv, nan=-22) + 22) / 6,
                    (np.nan_to_num(hh - hv, nan=7) - 7) / 4]).astype(np.float32)
    season = np.stack([np.full((ny, nx), np.sin(doy)), np.full((ny, nx), np.cos(doy))]).astype(np.float32)
    return np.concatenate([own, site["ctx"], season]), valid


def pairs(site):
    out = []
    for i, d in enumerate(site["dates"]):
        best = min(site["photos"], key=lambda p: abs((dt.date.fromisoformat(p) - dt.date.fromisoformat(d)).days), default=None)
        if best is None or abs((dt.date.fromisoformat(best) - dt.date.fromisoformat(d)).days) > MAX_DAYS:
            continue
        img = np.array(Image.open(site["photos"][best]).convert("RGB")).astype(np.float32)
        br, sat = img.mean(2), img.max(2) - img.min(2)
        ok = (br > 3) & ~((br > 200) & (sat < 30))          # fuera: sin dato (negro) y nubes (blanco)
        X, valid = inputs(site, i)
        out.append({"X": X, "Y": (img / 127.5 - 1).transpose(2, 0, 1), "M": (ok & valid).astype(np.float32),
                    "radar": d, "photo": best})
    return out


def block(i, o):
    return nn.Sequential(nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.LeakyReLU(0.2, True),
                         nn.Conv2d(o, o, 3, padding=1), nn.BatchNorm2d(o), nn.LeakyReLU(0.2, True))


class Gen(nn.Module):
    def __init__(self, w=48):
        super().__init__()
        ch = [w, 2 * w, 4 * w, 8 * w, 8 * w]
        self.enc = nn.ModuleList([block(CIN, ch[0])] + [block(ch[k], ch[k + 1]) for k in range(4)])
        self.up = nn.ModuleList([nn.ConvTranspose2d(ch[k + 1], ch[k], 2, 2) for k in reversed(range(4))])
        self.dec = nn.ModuleList([block(2 * ch[k], ch[k]) for k in reversed(range(4))])
        self.out, self.drop = nn.Conv2d(w, 3, 1), nn.Dropout2d(0.2)

    def forward(self, x):
        skips = []
        for k, e in enumerate(self.enc):
            x = e(x if k == 0 else F.max_pool2d(x, 2))
            skips.append(x)
        x = self.drop(skips.pop())
        for up, dec in zip(self.up, self.dec):
            x = dec(torch.cat([up(x), skips.pop()], 1))
        return torch.tanh(self.out(x))


class Disc(nn.Module):                                   # PatchGAN: juzga parches de ~70 px
    def __init__(self, w=64):
        super().__init__()
        L = lambda i, o, s, bn=True: [nn.Conv2d(i, o, 4, s, 1)] + ([nn.BatchNorm2d(o)] if bn else []) + [nn.LeakyReLU(0.2, True)]
        self.net = nn.Sequential(*L(CIN + 3, w, 2, False), *L(w, 2 * w, 2), *L(2 * w, 4 * w, 2), *L(4 * w, 8 * w, 1),
                                 nn.Conv2d(8 * w, 1, 4, 1, 1))

    def forward(self, x, y):
        return self.net(torch.cat([x, y], 1))


@torch.no_grad()
def predict(G, X, dev, tile=256, pad=32):
    G.eval()
    C, H, W = X.shape
    Hp, Wp = -(-H // 16) * 16 + 2 * pad, -(-W // 16) * 16 + 2 * pad
    Xp = np.zeros((C, Hp, Wp), np.float32)
    Xp[:, pad:pad + H, pad:pad + W] = X
    out = np.zeros((3, Hp, Wp), np.float32)
    step = tile - 2 * pad
    for y in range(0, Hp - 2 * pad, step):
        for x in range(0, Wp - 2 * pad, step):
            y0, x0 = min(y, Hp - tile), min(x, Wp - tile)
            p = G(torch.from_numpy(Xp[None, :, y0:y0 + tile, x0:x0 + tile]).to(dev))[0].float().cpu().numpy()
            out[:, y0 + pad:y0 + tile - pad, x0 + pad:x0 + tile - pad] = p[:, pad:tile - pad, pad:tile - pad]
    return out[:, pad:pad + H, pad:pad + W]


def val_score(G, P, dev):
    """Error en la franja este (nunca entrenada): L1 en escala 0-255 y PSNR; baseline = color medio."""
    l1s, base, psnr = [], [], []
    for p in P:
        W = p["X"].shape[2]
        c0 = int(W * (1 - VAL_FRAC))
        pred = predict(G, p["X"], dev)[:, :, c0:]
        Y, M = p["Y"][:, :, c0:], p["M"][:, c0:] > 0
        if M.sum() < 1000:
            continue
        d = np.abs(pred - Y)[:, M] * 127.5
        l1s.append(d.mean())
        mean_col = p["Y"][:, :, :c0][:, p["M"][:, :c0] > 0].mean(1, keepdims=True)
        base.append((np.abs(mean_col - Y[:, M]) * 127.5).mean())
        mse = ((pred - Y)[:, M] ** 2).mean() / 4
        psnr.append(10 * np.log10(1 / max(mse, 1e-8)))
    return float(np.mean(l1s)), float(np.mean(base)), float(np.mean(psnr))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=120)
    ap.add_argument("--patch", type=int, default=192)
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--eval-every", type=int, default=300)
    ap.add_argument("--gan-weight", type=float, default=0.02, help="0 = solo L1 (más suave, más fiel)")
    ap.add_argument("--predict-only", action="store_true")
    a = ap.parse_args()
    torch.manual_seed(0)
    rng = np.random.default_rng(0)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print("dispositivo:", torch.cuda.get_device_name(0) if dev == "cuda" else "CPU", flush=True)
    sites = {s: load_site(s) for s in SITES}
    P = {s: pairs(sites[s]) for s in TRAIN}
    for s in TRAIN:
        print(f"  {s}: {len(P[s])} pares radar-foto: " + ", ".join(f"{p['radar']}~{p['photo']}" for p in P[s]), flush=True)
    allP = [p for s in TRAIN for p in P[s]]
    G, D = Gen().to(dev), Disc().to(dev)
    oG = torch.optim.Adam(G.parameters(), 2e-4, betas=(0.5, 0.999))
    oD = torch.optim.Adam(D.parameters(), 2e-4, betas=(0.5, 0.999))
    mp = os.path.join(ROOT, "models", "radar2photo.pt")
    os.makedirs(os.path.dirname(mp), exist_ok=True)
    t0, step, best, hist = time.time(), 0, 1e9, []
    log_p = os.path.join(ROOT, "models", "radar2photo_log.csv")
    if not a.predict_only:
        log = open(log_p, "w", encoding="utf-8")
        log.write("paso,minuto,l1_train,val_error_0_255,baseline_color_medio,val_psnr_db\n")
        Ps = a.patch

        def sample():
            xs, ys, ms = [], [], []
            for _ in range(a.batch):
                p = allP[rng.integers(len(allP))]
                H, W = p["M"].shape
                wmax = int(W * (1 - VAL_FRAC)) - Ps
                for _t in range(10):
                    y0, x0 = rng.integers(0, H - Ps), rng.integers(0, wmax)
                    if p["M"][y0:y0 + Ps, x0:x0 + Ps].mean() > 0.6:
                        break
                sl = (slice(None), slice(y0, y0 + Ps), slice(x0, x0 + Ps))
                x, y, m = p["X"][sl], p["Y"][sl], p["M"][y0:y0 + Ps, x0:x0 + Ps]
                if rng.random() < 0.5:                       # solo espejo horizontal: la luz del sol viene de un lado
                    x, y, m = x[:, :, ::-1], y[:, :, ::-1], m[:, ::-1]
                x = x + np.concatenate([rng.normal(0, 0.08, (3,) + m.shape), np.zeros((CIN - 3,) + m.shape)]).astype(np.float32)
                xs.append(np.ascontiguousarray(x)); ys.append(np.ascontiguousarray(y)); ms.append(np.ascontiguousarray(m))
            T = lambda L: torch.from_numpy(np.stack(L)).to(dev)
            return T(xs), T(ys), T(ms)[:, None]

        total = a.minutes * 60
        while time.time() - t0 < total:
            G.train(); D.train()
            frac = (time.time() - t0) / total
            lr = 2e-4 * (1 if frac < 0.5 else 2 * (1 - frac) + 0.02)
            for o in (oG, oD):
                for g in o.param_groups:
                    g["lr"] = lr
            gan_on = a.gan_weight > 0 and frac > 0.15        # primero aprende colores con L1, después afina con GAN
            x, y, m = sample()
            fake = G(x)
            if gan_on:
                dr, df = D(x, y), D(x, fake.detach())
                lD = 0.5 * (F.binary_cross_entropy_with_logits(dr, torch.ones_like(dr)) + F.binary_cross_entropy_with_logits(df, torch.zeros_like(df)))
                oD.zero_grad(); lD.backward(); oD.step()
            l1 = (torch.abs(fake - y) * m).sum() / (m.sum() * 3 + 1)
            lG = l1
            if gan_on:
                dg = D(x, fake)
                lG = l1 + a.gan_weight * F.binary_cross_entropy_with_logits(dg, torch.ones_like(dg))
            oG.zero_grad(); lG.backward(); oG.step()
            hist.append(l1.item()); step += 1
            if step % a.eval_every == 0:
                v, b, ps = val_score(G, allP, dev)
                mins = (time.time() - t0) / 60
                log.write(f"{step},{mins:.1f},{np.mean(hist) * 127.5:.2f},{v:.2f},{b:.2f},{ps:.2f}\n"); log.flush()
                tag = ""
                if v < best:
                    best = v
                    torch.save(G.state_dict(), mp)
                    tag = "  <- mejor, guardado"
                print(f"paso {step:6d} | {mins:5.1f} min | error entrenando {np.mean(hist) * 127.5:5.1f} | franja nunca vista: "
                      f"error {v:5.1f}/255 (adivinar color medio: {b:5.1f}) PSNR {ps:4.1f} dB{'  [GAN]' if gan_on else ''}{tag}", flush=True)
                hist = []
        log.close()
        if best == 1e9:
            torch.save(G.state_dict(), mp)
    G.load_state_dict(torch.load(mp, map_location=dev))
    v, b, ps = val_score(G, allP, dev)
    print(f"mejor modelo: error {v:.1f}/255 en la franja nunca vista (color medio: {b:.1f}), PSNR {ps:.1f} dB", flush=True)
    for s, site in sites.items():
        items = []
        pair_of = {p["radar"]: p["photo"] for p in P.get(s, [])}
        for i, d in enumerate(site["dates"]):
            X, valid = inputs(site, i)
            img = ((predict(G, X, dev).transpose(1, 2, 0) + 1) * 127.5).clip(0, 255).astype(np.uint8)
            img[~valid] = 0
            fn = f"radarfoto_{d}.jpg"
            Image.fromarray(img).save(os.path.join(site["base"], "ref", fn), quality=85)
            items.append({"date": d, "img": f"ref/{fn}", "photo_used_for_training": pair_of.get(d)})
        info = {"model": "Radar→foto (U-Net + PatchGAN, estilo pix2pix)", "approximate": True,
                "note": "Reconstrucción aprendida desde el radar NISAR; no es una foto real.",
                "trained_on": TRAIN, "site_has_photos": s in TRAIN, "val": "20 % este de Barra y Cerrón, nunca usado al entrenar",
                "val_error_0_255": round(v, 1), "baseline_mean_color_error": round(b, 1), "val_psnr_db": round(ps, 1),
                "dates": items}
        json.dump(info, open(os.path.join(site["base"], "ref", "radarfoto.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"  {s}: {len(items)} imágenes", flush=True)


if __name__ == "__main__":
    main()
