"""Rellena los huecos sin escaneo de cada fecha con una APROXIMACIÓN tomada de otras fechas del mismo lugar.

Para cada fecha (con >= MIN_REAL % escaneado de verdad) y cada píxel sin dato:
  1. se toma la fecha más cercana en el tiempo que sí tenga dato en ese píxel;
  2. se corrige la diferencia de brillo entre las dos fechas POR TIPO DE COBERTURA (mapa ESA WorldCover):
     mediana de (fecha destino - fecha fuente) en dB sobre los píxeles que ambas tienen, por clase.
     Así, rellenar un día de verano con datos de lluvias no deja el manglar "demasiado brillante";
  3. el píxel queda marcado como aproximado (rayas moradas en <fecha>_src.png).
Después hay que reclasificar:  python scripts/fetch_gcov.py --out <carpeta> [--bbox ...] --reclassify
Uso: python scripts/fill_gaps.py --site jiquilisco|barra|cerron
"""
import argparse
import datetime as dt
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"barra": "web/data", "jiquilisco": "web/data-jiquilisco", "cerron": "web/data-cerron"}
MIN_REAL = 50          # % mínimo escaneado de verdad para rellenar una fecha
MAX_GAP_DAYS = 120     # no usar fechas fuente más lejanas que esto
CLASS_GROUPS = {"manglar": [95], "agua": [80], "cultivo": [40], "arbol": [10], "pasto": [20, 30, 90], "otro": [50, 60, 70, 100, 0]}


def load(base, d, lo, hi):
    e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
    hh = np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan)
    rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
    hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
    return hh, hv


def save(base, d, hh, hv, lo, hi):
    scale = lambda a, a0, a1: np.clip((a - a0) / (a1 - a0) * 255, 0, 255)
    valid = np.isfinite(hh)
    rgb = np.zeros(hh.shape + (4,), np.uint8)
    rgb[..., 0] = scale(np.nan_to_num(hh, nan=-99), -25, 0)
    rgb[..., 1] = scale(np.nan_to_num(hv, nan=-99), -32, -8)
    rgb[..., 2] = scale(np.nan_to_num(hh - hv, nan=0), 0, 15)
    rgb[..., 3] = np.where(valid, 255, 0)
    Image.fromarray(rgb, "RGBA").save(os.path.join(base, os.path.basename(d["rgb"])), optimize=True)
    enc = np.where(valid, 1 + scale(np.nan_to_num(hh, nan=lo), lo, hi) * 254 / 255, 0)
    Image.fromarray(enc.astype(np.uint8), "L").save(os.path.join(base, os.path.basename(d["hh"])), optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", choices=SITES, required=True)
    a = ap.parse_args()
    base = os.path.join(ROOT, SITES[a.site])
    S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
    lo, hi = S["hh_range"]
    codes = np.array(Image.open(os.path.join(base, "ref", "worldcover_codes.png")))
    groups = {k: np.isin(codes, v) for k, v in CLASS_GROUPS.items()}
    dates = [d for d in S["dates"] if d.get("qc", True)]
    data = {d["id"]: load(base, d, lo, hi) for d in dates}
    real = {k: np.isfinite(v[0]) for k, v in data.items()}       # lo escaneado de verdad (antes de rellenar)
    D = lambda d: dt.date.fromisoformat(d["date"])
    for d in dates:
        hh, hv = data[d["id"]]
        cov = 100 * float(real[d["id"]].mean())
        hole = ~real[d["id"]]
        if not hole.any() or cov < MIN_REAL:
            continue
        hh, hv = hh.copy(), hv.copy()
        filled = np.zeros(hole.shape, bool)
        used = []
        for s in sorted((x for x in dates if x["id"] != d["id"]), key=lambda x: abs((D(x) - D(d)).days)):
            gap = abs((D(s) - D(d)).days)
            if gap > MAX_GAP_DAYS or not (hole & ~filled).any():
                break
            shh, shv = data[s["id"]]
            take = hole & ~filled & real[s["id"]]
            if not take.any():
                continue
            both = real[d["id"]] & real[s["id"]]
            for name, g in groups.items():               # corrección de brillo por tipo de cobertura
                t = take & g
                if not t.any():
                    continue
                ov = both & g
                if ov.sum() > 300:
                    o_hh, o_hv = float(np.median(hh[ov] - shh[ov])), float(np.median(hv[ov] - shv[ov]))
                else:
                    o_hh, o_hv = float(np.nanmedian(hh[both] - shh[both])), float(np.nanmedian(hv[both] - shv[both]))
                hh[t], hv[t] = shh[t] + o_hh, shv[t] + o_hv
            filled |= take
            used.append({"date": s["date"], "gap_days": gap, "pct": round(100 * float(take.mean()), 1)})
        save(base, d, hh, hv, lo, hi)
        # capa de procedencia: gris = sin dato, celeste = otra órbita (si ya existía), morado = otra fecha
        src_p = os.path.join(base, f"{d['id']}_src.png")
        prev = np.array(Image.open(src_p).convert("RGBA")) if os.path.exists(src_p) else None
        ny, nx = hh.shape
        yy, xx = np.mgrid[0:ny, 0:nx]
        stripe = ((xx + yy) % 14) < 3
        out = np.zeros((ny, nx, 4), np.uint8)
        if prev is not None:
            cyan = (prev[..., 2] > 200) & (prev[..., 0] < 120) & (prev[..., 3] > 0)
            out[cyan] = prev[cyan]
        still = ~np.isfinite(hh)
        out[still & stripe] = (150, 160, 165, 170)
        out[still & ~stripe] = (40, 48, 52, 70)
        out[filled & stripe] = (190, 120, 255, 210)
        Image.fromarray(out, "RGBA").save(src_p, optimize=True)
        d["src"] = f"data/{d['id']}_src.png"
        d["time_filled_pct"] = round(100 * float(filled.mean()), 1)
        d["time_fill_from"] = used
        d["coverage_real_pct"] = round(cov, 1)
        print(f"{d['date']}: real {cov:.1f}% + aproximado {d['time_filled_pct']}% de {[u['date'] for u in used][:4]}")
    json.dump(S, open(os.path.join(base, "series.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
