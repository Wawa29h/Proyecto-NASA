"""Quemas de caña junto al manglar de Barra de Santiago, fechadas con pocos días de precisión (sin llave).

Con TODAS las fotos Sentinel-2 despejadas de la zafra (nov–may) se sigue, parcela por parcela:
  NDVI = (NIR - Rojo)/(NIR + Rojo)            verdor
  NBR  = (NIR - SWIR2)/(NIR + SWIR2)          índice de quema: cae fuerte sobre ceniza y suelo quemado
Para cada píxel de cultivo se busca el primer cambio brusco entre dos fotos despejadas seguidas (<= 20 días):
  QUEMA            dNBR >= 0.27 y el NBR queda <= 0.05 (ceniza)        -> fecha entre las dos fotos
  CORTE EN VERDE   el verdor cae >= 0.25 pero sin señal de ceniza     -> cosecha sin quemar
Luego se agrupan los píxeles vecinos con la misma fecha en EVENTOS (parcelas quemadas el mismo día),
con área, fecha, día de la semana y distancia al manglar.
Salida: web/data/ref/burns.json, burns_date.png (color por quincena), burns_type.png (quema vs verde)
Uso: python scripts/cane_burns.py
"""
import datetime as dt
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
START, END = "2025-11-01", "2026-05-31"
MAX_GAP = 20
DNBR, POST_NBR, DNDVI = 0.27, 0.05, 0.25
DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def scenes():
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX), "datetime": f"{START}T00:00:00Z/{END}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": 70}}, "limit": 300}
    req = urllib.request.Request(fr.STAC, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "nisar-space-apps"})
    by = {}
    for f in json.load(urllib.request.urlopen(req, timeout=90))["features"]:
        by.setdefault(f["properties"]["datetime"][:10], []).append(f)
    return dict(sorted(by.items()))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    fr.BBOX = BBOX
    codes = np.array(Image.open(os.path.join(BASE, "ref", "worldcover_codes.png")))
    crop = codes == 40
    mang = codes == 95
    step = 0.00018
    px_ha = step * 111.32 * step * 111.32 * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2)) * 100
    dist = ndimage.distance_transform_edt(~mang) * step * 111.32

    # serie de NDVI y NBR por fecha (une los tiles del mismo día)
    series = []
    for d, fs in scenes().items():
        ndvi = np.full(crop.shape, np.nan, np.float32)
        nbr = np.full(crop.shape, np.nan, np.float32)
        for f in fs:
            a = f["assets"]
            scl = fr.warp(a["scl"]["href"], resampling=fr.Resampling.nearest, dtype=np.uint8)
            clear = (scl > 0) & ~np.isin(scl, [3, 8, 9, 10]) & crop
            if clear.sum() < 0.3 * crop.sum():
                continue
            red, nir, sw = fr.warp(a["red"]["href"]), fr.warp(a["nir"]["href"]), fr.warp(a["swir22"]["href"])
            with np.errstate(divide="ignore", invalid="ignore"):
                ndvi = np.where(clear & np.isnan(ndvi), (nir - red) / (nir + red), ndvi)
                nbr = np.where(clear & np.isnan(nbr), (nir - sw) / (nir + sw), nbr)
        if np.isfinite(ndvi[crop]).mean() >= 0.3:
            series.append((d, ndvi, nbr))
            print(d, f"despejado sobre cultivos {100 * np.isfinite(ndvi[crop]).mean():.0f}%", flush=True)
    print(len(series), "fotos útiles", flush=True)

    # primer cambio brusco por píxel
    burn_day = np.full(crop.shape, -1, np.int32)     # día desde START (punto medio entre las dos fotos)
    burn_a = np.full(crop.shape, -1, np.int32)       # última foto ANTES de la quema
    burn_b = np.full(crop.shape, -1, np.int32)       # primera foto DESPUÉS (ya quemada)
    green_day = np.full(crop.shape, -1, np.int32)
    last_ndvi = np.full(crop.shape, np.nan, np.float32)
    last_nbr = np.full(crop.shape, np.nan, np.float32)
    last_t = np.full(crop.shape, -999, np.int32)
    t0 = dt.date.fromisoformat(START)
    for d, ndvi, nbr in series:
        t = (dt.date.fromisoformat(d) - t0).days
        ok = np.isfinite(ndvi) & np.isfinite(last_ndvi) & (t - last_t <= MAX_GAP)
        undecided = (burn_day < 0) & (green_day < 0)
        dnbr, dndvi = last_nbr - nbr, last_ndvi - ndvi
        mid = ((t + last_t) // 2).astype(np.int32)
        burned = ok & undecided & (dnbr >= DNBR) & (nbr <= POST_NBR)
        green = ok & undecided & ~burned & (dndvi >= DNDVI) & (dnbr < 0.15)
        burn_day[burned] = mid[burned]
        burn_a[burned] = last_t[burned]
        burn_b[burned] = t
        green_day[green] = mid[green]
        upd = np.isfinite(ndvi)
        last_ndvi[upd], last_nbr[upd], last_t[upd] = ndvi[upd], nbr[upd], t
    burned = burn_day >= 0
    green = green_day >= 0

    # eventos: parcelas quemadas en la MISMA ventana (vistas quemadas por primera vez en la misma foto)
    events = []
    for tb in np.unique(burn_b[burned]):
        lab, _ = ndimage.label(burned & (burn_b == tb), structure=np.ones((3, 3)))
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            m = lab[sl] == i
            if m.sum() * px_ha < 1.0:  # menos de 1 ha: ruido
                continue
            ta = int(np.max(burn_a[sl][m]))           # la foto "antes" más reciente de la parcela
            da, db = t0 + dt.timedelta(days=ta), t0 + dt.timedelta(days=int(tb))
            mid = da + (db - da) / 2
            ys, xs = np.nonzero(m)
            cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
            events.append({"date": mid.isoformat(), "from": da.isoformat(), "to": db.isoformat(), "window_days": (db - da).days,
                           "ha": round(float(m.sum() * px_ha), 1), "km_to_mangrove": round(float(dist[sl][m].min()), 2),
                           "lat": round(float(BBOX[3] - (cy + 0.5) * step), 5), "lon": round(float(BBOX[0] + (cx + 0.5) * step), 5)})
    events.sort(key=lambda e: e["date"])

    # imágenes: color por quincena / tipo de cosecha
    span = (dt.date.fromisoformat(END) - t0).days
    def ramp(v):  # nov (amarillo) -> may (rojo oscuro)
        k = np.clip(v / span, 0, 1)
        return np.stack([255 - 40 * k, 220 - 200 * k, 60 - 40 * k], -1)
    rgba = np.zeros(crop.shape + (4,), np.uint8)
    col = ramp(burn_day.astype(float))
    rgba[burned, :3] = col[burned].astype(np.uint8)
    rgba[burned, 3] = 235
    Image.fromarray(rgba, "RGBA").save(os.path.join(BASE, "ref", "burns_date.png"), optimize=True)
    t2 = np.zeros(crop.shape + (4,), np.uint8)
    t2[burned] = (230, 57, 70, 235)
    t2[green] = (46, 204, 113, 220)
    t2[crop & ~burned & ~green] = (180, 180, 180, 70)
    Image.fromarray(t2, "RGBA").save(os.path.join(BASE, "ref", "burns_type.png"), optimize=True)

    # resúmenes
    weeks = {}
    for e in events:
        wk = dt.date.fromisoformat(e["date"])
        wk = (wk - dt.timedelta(days=wk.weekday())).isoformat()
        weeks[wk] = round(weeks.get(wk, 0) + e["ha"], 1)
    harvested = burned | green
    out = {"source": "Sentinel-2 L2A (ESA), NBR y NDVI con todas las fotos despejadas", "from": START, "to": END,
           "photos": len(series), "photo_dates": [s[0] for s in series],
           "burned_ha": round(float(burned.sum() * px_ha)), "green_ha": round(float(green.sum() * px_ha)),
           "burned_share_pct": round(100 * float(burned.sum() / max(1, harvested.sum())), 1),
           "burned_within_1km_ha": round(float((burned & (dist < 1)).sum() * px_ha)),
           "burned_within_500m_ha": round(float((burned & (dist < 0.5)).sum() * px_ha)),
           "events": events, "events_count": len(events),
           "events_within_1km": sum(e["km_to_mangrove"] < 1 for e in events),
           "by_week_ha": dict(sorted(weeks.items())),
           "median_window_days": int(np.median([e["window_days"] for e in events])) if events else None,
           "img_date": "ref/burns_date.png", "img_type": "ref/burns_type.png",
           "method": f"quema: dNBR>={DNBR} y NBR<={POST_NBR}; verde: dNDVI>={DNDVI} y dNBR<0.15; fotos seguidas <= {MAX_GAP} dias"}
    json.dump(out, open(os.path.join(BASE, "ref", "burns.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print({k: v for k, v in out.items() if k not in ("events", "photo_dates")})
    for e in events[:12]:
        print(" ", e)


if __name__ == "__main__":
    main()
