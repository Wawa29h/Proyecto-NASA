"""Temperatura de la superficie del agua con NASA ECOSTRESS (ECO_L2T_LSTE v002, 70 m).

Para cada pasada lee solo el recuadro del sitio (lectura remota por ventana) y calcula la mediana de
temperatura sobre pixeles de agua (capa 'water' del producto) sin nubes (capa 'cloud').
Separa pasadas de dia (9-16 h locales) y de noche.

Uso: python scripts/fetch_ecostress.py --site cerron
"""
import argparse
import datetime as dt
import json
import os
import re

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {
    "cerron": {"out": "web/data-cerron", "bbox": (-89.27, 13.93, -88.93, 14.13)},
    "barra": {"out": "web/data", "bbox": (-90.13, 13.66, -89.95, 13.79)},
}
UTC_OFFSET = -6  # El Salvador


def login():
    import earthaccess
    import netrc
    c = netrc.netrc(os.path.expanduser("~/.netrc")).authenticators("urs.earthdata.nasa.gov")
    os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"] = c[0], c[2]
    earthaccess.login(strategy="environment")
    return earthaccess


STEP = 0.00018  # misma malla lat/lon que NISAR y WorldCover


def grid(bbox):
    W, S, E, N = bbox
    return from_origin(W, N, STEP, STEP), int(round((E - W) / STEP)), int(round((N - S) / STEP))


def read_grid(fs, url, bbox, resampling, nodata):
    """Lee la ventana del recuadro y la reproyecta a la malla lat/lon del sitio."""
    tr, nx, ny = grid(bbox)
    dst = np.full((ny, nx), np.nan, np.float32)
    with fs.open(url, "rb", block_size=512 * 1024) as f, rasterio.open(f) as src:
        b = transform_bounds("EPSG:4326", src.crs, *bbox, densify_pts=21)
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        arr = src.read(1, window=win, boundless=True, fill_value=nodata).astype(np.float32)
        reproject(arr, dst, src_transform=src.window_transform(win), src_crs=src.crs, src_nodata=nodata,
                  dst_transform=tr, dst_crs="EPSG:4326", dst_nodata=np.nan, resampling=resampling)
    return dst


def lake_mask(site):
    """Agua permanente segun ESA WorldCover, sin la orilla (los pixeles de 70 m mezclan agua y tierra)."""
    from PIL import Image
    from scipy import ndimage
    p = os.path.join(ROOT, site["out"], "ref", "worldcover_codes.png")
    codes = np.array(Image.open(p))
    water = ndimage.binary_erosion(codes == 80, iterations=4)   # ~80 m hacia adentro
    land = ndimage.binary_erosion(np.isin(codes, [10, 20, 30, 40]), iterations=4)
    return water, land


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", choices=SITES, default="cerron")
    ap.add_argument("--start", default="2025-12-01")
    ap.add_argument("--end", default="2026-11-10")
    a = ap.parse_args()
    site = SITES[a.site]
    out_path = os.path.join(ROOT, site["out"], "ecostress.json")
    prev = {}
    if os.path.exists(out_path):
        prev = {o["granule"]: o for o in json.load(open(out_path))["observations"]}
    ea = login()
    fs = ea.get_fsspec_https_session()
    grans = ea.search_data(short_name="ECO_L2T_LSTE", version="002", bounding_box=site["bbox"], temporal=(a.start, a.end))
    print(f"{len(grans)} pasadas ECOSTRESS", flush=True)
    wmask, lmask = lake_mask(site)
    obs = []
    for k, g in enumerate(grans):
        links = g.data_links()
        lst_u = next((l for l in links if l.endswith("_LST.tif")), None)
        if not lst_u:
            continue
        gid = lst_u.split("/")[-1].replace("_LST.tif", "")
        if gid in prev:
            obs.append(prev[gid])
            continue
        try:
            lst = read_grid(fs, lst_u, site["bbox"], Resampling.nearest, np.nan)
            if np.isfinite(lst[wmask]).mean() < 0.3:
                obs.append({"granule": gid, "skip": "sin cobertura sobre el agua"})
                continue
            cloud = read_grid(fs, lst_u.replace("_LST.tif", "_cloud.tif"), site["bbox"], Resampling.nearest, 255)
        except Exception as e:
            print("  omitida", gid, str(e)[:80], flush=True)
            continue
        ok = np.isfinite(lst) & (lst > 270) & (lst < 335) & (cloud == 0)
        w = ok & wmask
        land = ok & lmask
        water = wmask
        m = re.search(r"_(\d{8}T\d{6})_", gid)
        if not m:
            continue
        t = dt.datetime.strptime(m.group(1), "%Y%m%dT%H%M%S") + dt.timedelta(hours=UTC_OFFSET)
        o = {"granule": gid, "local_time": t.isoformat(timespec="minutes"), "date": t.date().isoformat(),
             "day": 9 <= t.hour < 16, "water_px": int(w.sum()), "water_total_px": int(water.sum()),
             "water_c": round(float(np.median(lst[w])) - 273.15, 2) if w.sum() > 200 else None,
             "land_c": round(float(np.median(lst[land])) - 273.15, 2) if land.sum() > 200 else None}
        obs.append(o)
        if k % 10 == 0:
            json.dump({"source": "NASA ECOSTRESS L2T LSTE v002 (70 m)", "bbox": site["bbox"], "observations": obs},
                      open(out_path, "w"), indent=1)  # guardar avance
            print(f"  {k + 1}/{len(grans)} {o['local_time']} agua {o['water_c']} C tierra {o['land_c']} C", flush=True)
    obs = [o for o in obs if "local_time" in o]
    obs.sort(key=lambda o: o["local_time"])
    json.dump({"source": "NASA ECOSTRESS L2T LSTE v002 (70 m)", "bbox": site["bbox"], "observations": obs},
              open(out_path, "w"), indent=1)
    good = [o for o in obs if o["water_c"] is not None]
    print(f"listo: {len(obs)} pasadas, {len(good)} con agua sin nubes -> {out_path}")


if __name__ == "__main__":
    main()
