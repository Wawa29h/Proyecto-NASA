"""Caña de azúcar alrededor del manglar de Barra de Santiago: dónde está, a qué distancia y cuándo se cosecha.

1. Dónde: cultivos del mapa ESA WorldCover 2021 (clase 40) y su distancia al manglar (clase 95).
2. Cuándo (Sentinel-2): para cada mes de la zafra (nov–may) se toma la foto más despejada y se calcula NDVI
   (verdor). El mes en que el verdor cae de golpe (>= 0.25) es el mes de cosecha o quema de esa parcela.
3. Cuándo (NISAR, ve con nubes): caída de la señal HV >= 3 dB entre la primera y la última pasada de la época
   seca (dic–ene): la caña cortada pierde las hojas y tallos que hacían rebotar la señal.
Nota: WorldCover no distingue caña de otros cultivos; en la planicie costera de Ahuachapán la mayoría es caña.
Salida: web/data/ref/cane.json, cane_harvest.png (parcelas por mes de cosecha), cane_nisar.png
Uso: python scripts/cane.py
"""
import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_reference as fr

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "web", "data")
BBOX = (-90.13, 13.66, -89.95, 13.79)
MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]
MONTH_NAMES = {"2025-12": "diciembre", "2026-01": "enero", "2026-02": "febrero", "2026-03": "marzo", "2026-04": "abril", "2026-05": "mayo"}
COLORS = {"2025-12": (255, 99, 72), "2026-01": (255, 159, 67), "2026-02": (254, 202, 87),
          "2026-03": (29, 209, 161), "2026-04": (84, 160, 255), "2026-05": (165, 94, 234)}
DIST_BANDS = [(0, 1), (1, 3), (3, 5), (5, 99)]


def best_scene(month, crop):
    y, m = map(int, month.split("-"))
    end = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01"
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX), "datetime": f"{month}-01T00:00:00Z/{end}T00:00:00Z",
            "query": {"eo:cloud_cover": {"lt": 60}}, "limit": 40}
    req = urllib.request.Request(fr.STAC, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "nisar-space-apps"})
    feats = sorted(json.load(urllib.request.urlopen(req, timeout=90))["features"], key=lambda f: f["properties"]["eo:cloud_cover"])[:4]
    best = None
    for f in feats:  # la mas despejada SOBRE los cultivos
        scl = fr.warp(f["assets"]["scl"]["href"], resampling=fr.Resampling.nearest, dtype=np.uint8)
        clear = (scl > 0) & ~np.isin(scl, [3, 8, 9, 10])
        frac = (clear & crop).sum() / max(1, crop.sum())
        if best is None or frac > best[0]:
            best = (frac, f, clear)
    return best


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    fr.BBOX = BBOX
    codes = np.array(Image.open(os.path.join(BASE, "ref", "worldcover_codes.png")))
    crop = codes == 40
    mang = codes == 95
    step = 0.00018
    px_km2 = step * 111.32 * step * 111.32 * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2))
    dist = ndimage.distance_transform_edt(~mang) * step * 111.32  # km al manglar
    out = {"note": "Cultivos del mapa ESA WorldCover 2021; en la planicie costera de Ahuachapán son sobre todo caña.",
           "crop_km2": round(float(crop.sum() * px_km2), 2), "mangrove_km2": round(float(mang.sum() * px_km2), 2),
           "by_distance_km2": {f"{a}-{b if b < 99 else '+'} km": round(float((crop & (dist >= a) & (dist < b)).sum() * px_km2), 2) for a, b in DIST_BANDS}}
    print("cultivo:", out["crop_km2"], "km2 |", out["by_distance_km2"])

    # --- 2. cuándo: Sentinel-2 NDVI por mes ---
    nd, used = {}, {}
    for mo in MONTHS:
        frac, f, clear = best_scene(mo, crop)
        red, nir = fr.warp(f["assets"]["red"]["href"]), fr.warp(f["assets"]["nir"]["href"])
        with np.errstate(divide="ignore", invalid="ignore"):
            v = (nir - red) / (nir + red)
        nd[mo] = np.where(clear, v, np.nan)
        used[mo] = {"date": f["properties"]["datetime"][:10], "clear_over_crops_pct": round(100 * float(frac), 1)}
        print(mo, used[mo], flush=True)
    harvest = np.full(crop.shape, "", dtype=object)
    best_drop = np.zeros(crop.shape, np.float32)
    for a, b in zip(MONTHS[:-1], MONTHS[1:]):
        drop = nd[a] - nd[b]
        hit = crop & np.isfinite(drop) & (drop >= 0.25) & (drop > best_drop)
        harvest[hit] = b
        best_drop[hit] = drop[hit]
    rgba = np.zeros(crop.shape + (4,), np.uint8)
    by_month, near = {}, {}
    for mo, col in COLORS.items():
        m = harvest == mo
        rgba[m] = (*col, 225)
        by_month[MONTH_NAMES[mo]] = round(float(m.sum() * px_km2), 2)
        near[MONTH_NAMES[mo]] = round(float((m & (dist < 1)).sum() * px_km2), 2)
    nh = crop & (harvest == "")
    rgba[nh] = (200, 200, 200, 90)
    Image.fromarray(rgba, "RGBA").save(os.path.join(BASE, "ref", "cane_harvest.png"), optimize=True)
    harvested = harvest != ""
    out.update({"s2_scenes": used, "harvest_by_month_km2": by_month, "harvest_near_mangrove_km2": near,
                "harvested_pct": round(100 * float(harvested.sum() / max(1, crop.sum())), 1),
                "harvested_within_1km_km2": round(float((harvested & (dist < 1)).sum() * px_km2), 2),
                "harvest_img": "ref/cane_harvest.png", "colors": {MONTH_NAMES[k]: "#%02x%02x%02x" % v for k, v in COLORS.items()}})
    print("cosecha por mes (km2):", by_month)

    # --- 3. cuándo: NISAR (dic–ene, ve con nubes) ---
    S = json.load(open(os.path.join(BASE, "series.json"), encoding="utf-8"))
    dry = [d for d in S["dates"] if d.get("qc", True) and d["date"] < "2026-02-01"]
    if len(dry) >= 2:
        def hv(d):
            rgb = np.array(Image.open(os.path.join(BASE, os.path.basename(d["rgb"]))).convert("RGBA")).astype(float)
            return np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
        dhv = hv(dry[-1]) - hv(dry[0])
        cut = crop & np.isfinite(dhv) & (dhv <= -3)
        r2 = np.zeros(crop.shape + (4,), np.uint8)
        r2[cut] = (255, 99, 72, 230)
        Image.fromarray(r2, "RGBA").save(os.path.join(BASE, "ref", "cane_nisar.png"), optimize=True)
        s2_dec_jan = crop & np.isin(harvest, ["2025-12", "2026-01"])
        agree = (cut & s2_dec_jan).sum() / max(1, cut.sum())
        out["nisar"] = {"from": dry[0]["date"], "to": dry[-1]["date"], "cut_km2": round(float(cut.sum() * px_km2), 2),
                        "cut_within_1km_km2": round(float((cut & (dist < 1)).sum() * px_km2), 2),
                        "agree_with_s2_pct": round(100 * float(agree), 1), "img": "ref/cane_nisar.png"}
        print("NISAR cosecha dic-ene:", out["nisar"])
    json.dump(out, open(os.path.join(BASE, "ref", "cane.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
