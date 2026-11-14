"""El problema de las nubes, medido: cuantas fotos Sentinel-2 salen tapadas por temporada, y el
"momento wow": una foto tapada por nubes el MISMO dia (o +-1) en que NISAR vio el embalse completo.

Salida en web/data-cerron/:
  clouds.json                    estadisticas por temporada + datos del dia elegido
  ref/s2cloud_<fecha>.jpg        la foto nublada (recorte del sitio)
  wow_radar_<fecha>.jpg          el radar de ese dia con las plantas que encontro la IA (amarillo)
Uso: python scripts/cloud_stats.py
"""
import datetime as dt
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_reference as fr  # reutiliza la malla y la lectura de Sentinel-2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "web", "data-cerron")
BBOX = (-89.27, 13.93, -88.93, 14.13)
SEASONS = {"lluvias": ("2026-05-15", "2026-10-31"), "seca": ("2025-12-01", "2026-04-30")}


def scenes(a, b):
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX), "datetime": f"{a}T00:00:00Z/{b}T00:00:00Z", "limit": 300}
    req = urllib.request.Request(fr.STAC, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "nisar-space-apps"})
    feats = json.load(urllib.request.urlopen(req, timeout=90))["features"]
    by = {}
    for f in feats:
        d = f["properties"]["datetime"][:10]
        if d not in by or f["properties"]["eo:cloud_cover"] > by[d]["properties"]["eo:cloud_cover"]:
            by[d] = f
    return by


def scenes_all(a, b):
    """todas las escenas por fecha (puede haber 2 tiles el mismo dia)"""
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX), "datetime": f"{a}T00:00:00Z/{b}T00:00:00Z", "limit": 400}
    req = urllib.request.Request(fr.STAC, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "nisar-space-apps"})
    by = {}
    for f in json.load(urllib.request.urlopen(req, timeout=90))["features"]:
        by.setdefault(f["properties"]["datetime"][:10], []).append(f)
    return by


def main():
    fr.BBOX = BBOX
    fr.OUT = os.path.join(BASE, "ref")
    out = {"bbox": BBOX, "seasons": {}, "method": "nubes medidas SOLO sobre el agua del embalse (capa SCL de Sentinel-2, pixel a pixel)"}
    lake = np.array(Image.open(os.path.join(BASE, "ref", "water_mask.png"))) > 0
    allsc = {}
    per_date = []
    for name, (a, b) in SEASONS.items():
        sc = scenes_all(a, b)
        allsc.update({d: max(fs, key=lambda f: f["properties"]["eo:cloud_cover"]) for d, fs in sc.items()})
        rows = []
        for d, fs in sorted(sc.items()):
            seen = np.zeros(lake.shape, bool)
            clear = np.zeros(lake.shape, bool)
            for f in fs:  # una fecha puede venir en 2 recortes (tiles): se unen
                scl = fr.warp(f["assets"]["scl"]["href"], resampling=fr.Resampling.nearest, dtype=np.uint8)
                seen |= scl > 0
                clear |= (scl > 0) & ~np.isin(scl, [3, 8, 9, 10])
            seen_l = (seen & lake).sum() / lake.sum()
            if seen_l < 0.5:
                continue  # la foto casi no cubre el embalse: no cuenta
            clear_l = (clear & lake).sum() / (seen & lake).sum()
            rows.append({"date": d, "clear_pct": round(100 * float(clear_l), 1)})
        n = len(rows)
        days = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days
        useful = [r for r in rows if r["clear_pct"] >= 80]
        covered = [r for r in rows if r["clear_pct"] < 50]
        out["seasons"][name] = {"from": a, "to": b, "photos": n,
                                "covered_pct": round(100 * len(covered) / max(1, n)),
                                "useful_pct": round(100 * len(useful) / max(1, n)), "useful_photos": len(useful),
                                "days_per_useful_photo": round(days / max(1, len(useful)))}
        # racha mas larga sin ninguna foto despejada (>= 80 % del embalse visible)
        pts = [dt.date.fromisoformat(a)] + sorted(dt.date.fromisoformat(r["date"]) for r in useful) + [dt.date.fromisoformat(b)]
        g = max(((pts[i + 1] - pts[i]).days, pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        out["seasons"][name]["longest_gap_days"] = g[0]
        out["seasons"][name]["longest_gap"] = [g[1].isoformat(), g[2].isoformat()]
        per_date += [{**r, "season": name} for r in rows]
        print(name, out["seasons"][name], flush=True)
    out["photos"] = per_date

    # momento wow: fecha NISAR valida con foto muy nublada a +-1 dia y deteccion de la IA
    S = json.load(open(os.path.join(BASE, "series.json"), encoding="utf-8"))["dates"]
    ml = {m["id"]: m for m in json.load(open(os.path.join(BASE, "ml.json"), encoding="utf-8"))["dates"]}
    clear_by = {r["date"]: r["clear_pct"] for r in per_date}
    best = None
    for d in S:
        if d.get("qc") is False or (d.get("coverage_pct") or 100) < 99 or d["id"] not in ml:
            continue
        nd = dt.date.fromisoformat(d["date"])
        for sd, f in allsc.items():
            gap = abs((dt.date.fromisoformat(sd) - nd).days)
            c = 100 - clear_by.get(sd, 100)  # nubes SOBRE el embalse
            if gap <= 1 and c >= 90:
                key = (gap, -c, -ml[d["id"]]["ml_veg_km2"])
                if best is None or key < best[0]:
                    best = (key, d, sd, f)
    if not best:
        raise SystemExit("no hay foto nublada el mismo dia que una pasada NISAR")
    _, d, sd, f = best
    vis = np.dstack([fr.warp(f["assets"]["visual"]["href"], b, dtype=np.uint8) for b in (1, 2, 3)])
    photo = f"s2cloud_{sd}.jpg"
    Image.fromarray(vis).save(os.path.join(BASE, "ref", photo), quality=85)
    rgb = Image.open(os.path.join(BASE, os.path.basename(d["rgb"]))).convert("RGBA")
    mlimg = Image.open(os.path.join(BASE, ml[d["id"]]["img"])).convert("RGBA")
    a = np.array(mlimg)
    a[a[..., 3] > 0] = (255, 214, 0, 240)
    comp = Image.alpha_composite(Image.alpha_composite(Image.new("RGBA", rgb.size, (20, 26, 28, 255)), rgb), Image.fromarray(a))
    radar = f"wow_radar_{d['date']}.jpg"
    comp.convert("RGB").save(os.path.join(BASE, radar), quality=85)
    out["wow"] = {"nisar_date": d["date"], "photo_date": sd, "cloud_pct": round(100 - clear_by.get(sd, 0)),
                  "photo": f"ref/{photo}", "radar": radar, "ml_km2": ml[d["id"]]["ml_veg_km2"], "scene": f["id"]}
    json.dump(out, open(os.path.join(BASE, "clouds.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("momento wow:", out["wow"])


if __name__ == "__main__":
    main()
