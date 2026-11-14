"""Compara manglares con NISAR usando las mismas medidas.

Por sitio y por fecha, dentro del manglar del mapa ESA WorldCover (clase 95):
- HV mediana (estructura del bosque; estable = manglar sano)
- % del manglar con doble rebote (HH > -3 dB) = manglar con agua debajo
- agua del estero/bahia (km2)
Y en el ano:
- % del manglar con perdida persistente de senal (HV baja > 3 dB en las 3 ultimas fechas vs las 3 primeras)
Uso: python scripts/compare_mangroves.py
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"Barra de Santiago": "web/data", "Bahia de Jiquilisco": "web/data-jiquilisco"}


def load(base, d, rng):
    lo, hi = rng
    e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
    hh = np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan)
    rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
    hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
    return hh, hv


def main():
    out = {}
    for name, rel in SITES.items():
        base = os.path.join(ROOT, rel)
        S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
        codes = np.array(Image.open(os.path.join(base, "ref", "worldcover_codes.png")))
        mang = codes == 95
        px = S["step"] * 111.32 * S["step"] * 111.32 * np.cos(np.radians((S["bbox"][1] + S["bbox"][3]) / 2))
        dates = [d for d in S["dates"] if d.get("qc", True) and (d.get("coverage_pct") or 100) >= 70]
        rows, hvs = [], []
        for d in dates:
            hh, hv = load(base, d, S["hh_range"])
            m = mang & np.isfinite(hh)
            rows.append({"date": d["date"], "hv_mangrove": round(float(np.median(hv[m])), 2),
                         "flooded_mangrove_pct": round(100 * float((hh[m] > -3).mean()), 1),
                         "water_km2": d["water_km2"]})
            hvs.append(np.where(mang, hv, np.nan))
        hvs = np.array(hvs)
        first = np.nanmean(hvs[:3], 0)
        last = np.nanmean(hvs[-3:], 0)
        loss = mang & np.isfinite(first) & np.isfinite(last) & (last - first < -3)
        gain = mang & np.isfinite(first) & np.isfinite(last) & (last - first > 3)
        hv_m = [r["hv_mangrove"] for r in rows]
        fl = [r["flooded_mangrove_pct"] for r in rows]
        wa = [r["water_km2"] for r in rows]
        covered = mang & np.isfinite(hvs).all(0)
        out[name] = {"mangrove_km2": round(float(mang.sum() * px), 1), "mangrove_seen_km2": round(float(covered.sum() * px), 1), "dates": rows,
                     "hv_range_db": round(max(hv_m) - min(hv_m), 2),
                     "flooded_range_pct": [min(fl), max(fl)],
                     "water_range_km2": [min(wa), max(wa)],
                     "loss_km2": round(float(loss.sum() * px), 2), "loss_pct": round(100 * float(loss.sum() / max(1, covered.sum())), 2),
                     "gain_km2": round(float(gain.sum() * px), 2)}
        o = out[name]
        print(f"\n== {name}: manglar {o['mangrove_km2']} km2 (ESA) | {len(rows)} fechas")
        print(f"  HV del manglar: {min(hv_m)} a {max(hv_m)} dB (variacion {o['hv_range_db']} dB)")
        print(f"  manglar con agua debajo (doble rebote): {min(fl)}% a {max(fl)}%")
        print(f"  agua del estero/bahia: {min(wa)} a {max(wa)} km2")
        print(f"  perdida persistente de senal (>3 dB): {o['loss_km2']} km2 ({o['loss_pct']}% del manglar) | ganancia {o['gain_km2']} km2")
        for r in rows:
            print(f"   {r['date']}  HV {r['hv_mangrove']:6}  inundado {r['flooded_mangrove_pct']:5}%  agua {r['water_km2']}")
    json.dump(out, open(os.path.join(ROOT, "web", "mangrove_comparison.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
