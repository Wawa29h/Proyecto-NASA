"""Capas de referencia para comprobar lo que ve NISAR (sin login):

1. ESA WorldCover 2021 (10 m): mapa oficial de cobertura (incluye "Manglar" y "Agua").
2. Sentinel-2 L2A (catalogo publico Earth Search, AWS): la escena con menos nubes de cada mes.
   - foto a color
   - indices dentro del cuerpo de agua (mascara de agua de WorldCover):
       NDVI  = (NIR-Rojo)/(NIR+Rojo)          -> vegetacion flotante (lirio) si > 0.3
       NDCI  = (RedEdge1-Rojo)/(RedEdge1+Rojo) -> clorofila / algas (mas alto = mas algas)
       NDTI  = (Rojo-Verde)/(Rojo+Verde)      -> turbidez / sedimento (mas alto = mas turbia)
   - nubes con la capa SCL de Sentinel-2

Uso:
  python scripts/fetch_reference.py                                   # Barra de Santiago
  python scripts/fetch_reference.py --bbox -89.27 13.93 -88.93 14.13 --out web/data-cerron --lake
"""
import argparse
import json
import math
import os
import urllib.request

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP = 0.00018
STAC = "https://earth-search.aws.element84.com/v1/search"
WC_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
WC = {
    10: ("Bosque", (0, 100, 0)), 20: ("Matorral", (255, 187, 34)), 30: ("Pasto", (255, 255, 76)),
    40: ("Cultivo", (240, 150, 255)), 50: ("Construido", (250, 0, 0)), 60: ("Suelo desnudo", (180, 180, 180)),
    70: ("Nieve", (240, 240, 240)), 80: ("Agua", (0, 100, 200)), 90: ("Humedal herbaceo", (0, 150, 160)),
    95: ("Manglar", (0, 207, 117)), 100: ("Musgo", (250, 230, 160)),
}
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")

BBOX = (-90.13, 13.66, -89.95, 13.79)
OUT = os.path.join(ROOT, "web", "data", "ref")


def grid():
    W, S, E, N = BBOX
    nx, ny = int(round((E - W) / STEP)), int(round((N - S) / STEP))
    return from_origin(W, N, STEP, STEP), nx, ny


def warp(url, band=1, resampling=Resampling.bilinear, dtype=np.float32, nodata=0):
    tr, nx, ny = grid()
    dst = np.zeros((ny, nx), dtype)
    with rasterio.open(url) as src:
        reproject(rasterio.band(src, band), dst, dst_transform=tr, dst_crs="EPSG:4326",
                  resampling=resampling, src_nodata=nodata, dst_nodata=nodata)
    return dst


def box_any(a, r):
    from scipy import ndimage
    return ndimage.maximum_filter(a.astype(np.uint8), size=2 * r + 1) > 0


# ---------- WorldCover ----------
def wc_tiles():
    W, S, E, N = BBOX
    tiles = set()
    for lat in (S, N):
        for lon in (W, E):
            la = int(math.floor(lat / 3) * 3)
            lo = int(math.floor(lon / 3) * 3)
            tiles.add(f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}")
    return sorted(tiles)


def fetch_worldcover():
    _, nx, ny = grid()
    cls = np.zeros((ny, nx), np.uint8)
    for tile in wc_tiles():
        part = warp(WC_URL.format(tile=tile), resampling=Resampling.mode, dtype=np.uint8)
        cls = np.where(part > 0, part, cls)
    Image.fromarray(cls, "L").save(os.path.join(OUT, "worldcover_codes.png"))
    rgba = np.zeros((ny, nx, 4), np.uint8)
    for code, (_, col) in WC.items():
        rgba[cls == code] = (*col, 230)
    Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "worldcover.png"), optimize=True)
    px = STEP * 111.32 * STEP * 111.32 * np.cos(np.radians((BBOX[1] + BBOX[3]) / 2))
    areas = {WC[c][0]: round(float((cls == c).sum() * px), 2) for c in WC if (cls == c).any()}
    print("  WorldCover km2:", areas)
    return cls, {"img": "ref/worldcover.png", "codes": "ref/worldcover_codes.png",
                 "legend": {str(c): {"name": n, "color": "#%02x%02x%02x" % col} for c, (n, col) in WC.items() if n in areas},
                 "areas_km2": areas}


def water_mask(cls, lake):
    """Cuerpo de agua a analizar. Embalse: el agua permanente del mapa ESA (sin franja de orilla,
    para no contar vegetacion de tierra). Costa: el agua que NO es mar (mancha grande pegada al borde)."""
    from scipy import ndimage
    water = cls == 80
    if lake:
        return water
    core = ndimage.binary_erosion(water, iterations=12, border_value=1)  # el mar sigue tocando el borde
    lab, _ = ndimage.label(core)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    sea = box_any(np.isin(lab, edge[edge > 0]), 15) & box_any(water, 3)
    return water & ~sea


# ---------- Sentinel-2 ----------
def stac_search(month):
    y, m = map(int, month.split("-"))
    end = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01"
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX),
            "datetime": f"{month}-01T00:00:00Z/{end}T00:00:00Z",
            "query": {"eo:cloud_cover": {"lt": 70}}, "limit": 50}
    req = urllib.request.Request(STAC, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "nisar-space-apps"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["features"]


def nd(a, b):
    with np.errstate(divide="ignore", invalid="ignore"):
        return (a - b) / (a + b)


def fetch_s2(months, wmask):
    out = []
    px = STEP * 111.32 * STEP * 111.32 * np.cos(np.radians((BBOX[1] + BBOX[3]) / 2))
    for month in months:
        feats = stac_search(month)
        if not feats:
            print(f"  {month}: sin escenas")
            continue
        best = None
        for f in sorted(feats, key=lambda f: f["properties"]["eo:cloud_cover"])[:4]:
            scl = warp(f["assets"]["scl"]["href"], resampling=Resampling.nearest, dtype=np.uint8)
            valid = scl > 0
            cloud = np.isin(scl, [3, 8, 9, 10])
            cov = valid.mean()
            cw = (cloud & wmask).sum() / max(1, (valid & wmask).sum())
            score = cov - 2 * cloud.mean() - cw
            if best is None or score > best[0]:
                best = (score, f, scl)
        _, f, scl = best
        a = f["assets"]
        d = f["properties"]["datetime"][:10]
        vis = np.dstack([warp(a["visual"]["href"], b, dtype=np.uint8) for b in (1, 2, 3)])
        Image.fromarray(vis).save(os.path.join(OUT, f"s2_{d}.jpg"), quality=88)

        green, red, re1, nir = (warp(a[k]["href"]) for k in ("green", "red", "rededge1", "nir"))
        clear = (scl > 0) & ~np.isin(scl, [3, 8, 9, 10]) & wmask
        ndvi = nd(nir, red)
        veg = clear & (ndvi > 0.3)                 # plantas sobre el agua
        openw = clear & (ndvi < 0.0)              # agua abierta
        entry = {"date": d, "img": f"ref/s2_{d}.jpg", "scene": f["id"],
                 "cloud_water_pct": round(100 * float(1 - clear.sum() / max(1, wmask.sum())), 1),
                 "floatveg_km2": round(float(veg.sum() * px), 3),
                 "floatveg_pct": round(100 * float(veg.sum() / max(1, clear.sum())), 1),
                 "ndci": round(float(np.nanmedian(nd(re1, red)[openw])), 3) if openw.sum() > 100 else None,
                 "ndti": round(float(np.nanmedian(nd(red, green)[openw])), 3) if openw.sum() > 100 else None}
        # capa de plantas flotantes para la app (verde sobre transparente)
        rgba = np.zeros(veg.shape + (4,), np.uint8)
        rgba[veg] = (60, 220, 90, 230)
        Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"s2veg_{d}.png"), optimize=True)
        entry["veg_img"] = f"ref/s2veg_{d}.png"
        out.append(entry)
        print(f"  {month}: {d} | agua tapada por nubes {entry['cloud_water_pct']}% | plantas sobre el agua "
              f"{entry['floatveg_km2']} km2 ({entry['floatveg_pct']}%) | NDCI {entry['ndci']} | NDTI {entry['ndti']}")
    return out


def main():
    global BBOX, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", nargs=4, type=float)
    ap.add_argument("--out", help="carpeta del sitio (p. ej. web/data-cerron); las capas van a <out>/ref")
    ap.add_argument("--lake", action="store_true", help="cuerpo de agua interior (embalse/lago)")
    ap.add_argument("--months", nargs="*", default=["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
                                                      "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"])
    a = ap.parse_args()
    if a.bbox:
        BBOX = tuple(a.bbox)
    if a.out:
        OUT = os.path.join(os.path.abspath(a.out), "ref")
    os.makedirs(OUT, exist_ok=True)
    print("ESA WorldCover 2021...", wc_tiles())
    cls, wc = fetch_worldcover()
    wmask = water_mask(cls, a.lake)
    Image.fromarray((wmask * 255).astype(np.uint8), "L").save(os.path.join(OUT, "water_mask.png"))
    print("Sentinel-2...")
    s2 = fetch_s2(a.months, wmask)
    with open(os.path.join(OUT, "reference.json"), "w", encoding="utf-8") as fh:
        json.dump({"bbox": BBOX, "worldcover": wc, "sentinel2": s2, "lake": a.lake}, fh, indent=1, ensure_ascii=False)
    print("listo ->", os.path.join(OUT, "reference.json"))


if __name__ == "__main__":
    main()
