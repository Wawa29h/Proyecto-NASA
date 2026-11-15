"""Quemas (puntos de fuego) alrededor del manglar de Barra de Santiago con NASA FIRMS (satélites VIIRS y MODIS).

Necesita una llave gratuita de FIRMS (MAP_KEY): https://firms.modaps.eosdis.nasa.gov/api/map_key/
Guárdala en la variable de entorno FIRMS_MAP_KEY o en el archivo ~/.firms_key (una sola línea).
La llave no se imprime ni se guarda en el proyecto.

Para la zafra (nov–may) usa los productos "SP" (procesamiento estándar, archivo histórico) y, si no hay,
los "NRT" (casi en tiempo real). La API da máximo 10 días por consulta, así que se piden tramos de 10 días.
Salida: web/data/ref/fires.json (puntos + resumen por mes y por distancia al manglar)
Uso: python scripts/fetch_firms.py [--start 2025-11-01 --end 2026-05-31]
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "web", "data")
AREA = (-90.20, 13.62, -89.85, 13.92)          # zona amplia: cañales al norte del manglar
GRID_BBOX = (-90.13, 13.66, -89.95, 13.79)      # malla de la app
STEP = 0.00018
SOURCES = [("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"), ("VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"), ("MODIS_SP", "MODIS_NRT")]
API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{area}/{days}/{date}"


def get_key():
    k = os.environ.get("FIRMS_MAP_KEY")
    p = os.path.expanduser("~/.firms_key")
    if not k and os.path.exists(p):
        k = open(p).read().strip()
    if not k:
        raise SystemExit("Falta la llave de FIRMS: https://firms.modaps.eosdis.nasa.gov/api/map_key/ "
                         "(guárdala en FIRMS_MAP_KEY o en ~/.firms_key)")
    return k


def query(key, src, start, days):
    area = ",".join(str(v) for v in AREA)
    u = API.format(key=key, src=src, area=area, days=days, date=start.isoformat())
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "nisar-space-apps"}), timeout=90) as r:
        txt = r.read().decode("utf-8", "replace")
    if not txt.strip() or txt.lower().startswith(("invalid", "error")):
        return None
    return list(csv.DictReader(io.StringIO(txt)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2025-11-01")
    ap.add_argument("--end", default="2026-05-31")
    a = ap.parse_args()
    key = get_key()
    start, end = dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)
    pts, seen = [], set()
    for sp, nrt in SOURCES:
        d = start
        while d <= end:
            days = min(10, (end - d).days + 1)
            rows = query(key, sp, d, days)
            src = sp
            if rows is None:
                rows, src = query(key, nrt, d, days) or [], nrt
            for r in rows:
                k = (round(float(r["latitude"]), 3), round(float(r["longitude"]), 3), r["acq_date"])
                if k in seen:
                    continue
                seen.add(k)
                pts.append({"lat": float(r["latitude"]), "lon": float(r["longitude"]), "date": r["acq_date"],
                            "source": src, "frp": float(r.get("frp") or 0), "confidence": r.get("confidence")})
            d += dt.timedelta(days=days)
        print(sp, "->", len(pts), "puntos acumulados", flush=True)

    # distancia al manglar (mapa ESA en la malla de la app)
    codes = np.array(Image.open(os.path.join(BASE, "ref", "worldcover_codes.png")))
    mang = codes == 95
    dist_km = ndimage.distance_transform_edt(~mang) * STEP * 111.32
    W, S, E, N = GRID_BBOX
    for p in pts:
        c, r = int((p["lon"] - W) / STEP), int((N - p["lat"]) / STEP)
        if 0 <= r < mang.shape[0] and 0 <= c < mang.shape[1]:
            p["km_to_mangrove"] = round(float(dist_km[r, c]), 2)
        else:  # fuera de la malla: distancia aproximada al borde de la malla + lo que falta
            cc, rr = min(max(c, 0), mang.shape[1] - 1), min(max(r, 0), mang.shape[0] - 1)
            extra = math.hypot((c - cc) * STEP * 111.32, (r - rr) * STEP * 111.32)
            p["km_to_mangrove"] = round(float(dist_km[rr, cc] + extra), 2)
    by_month = {}
    for p in pts:
        by_month[p["date"][:7]] = by_month.get(p["date"][:7], 0) + 1
    near = {f"<{k} km": sum(p["km_to_mangrove"] < k for p in pts) for k in (1, 3, 5)}
    out = {"source": "NASA FIRMS (VIIRS 375 m y MODIS 1 km)", "area": AREA, "from": a.start, "to": a.end,
           "count": len(pts), "by_month": dict(sorted(by_month.items())), "near_mangrove": near, "points": pts}
    json.dump(out, open(os.path.join(BASE, "ref", "fires.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print({k: v for k, v in out.items() if k != "points"})


if __name__ == "__main__":
    main()
