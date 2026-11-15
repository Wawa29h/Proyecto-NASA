"""Historia del manglar 1996-2020 con Global Mangrove Watch v3 (radar banda L de JAXA: JERS-1, ALOS, ALOS-2),
el mismo tipo de radar que NISAR. Fuente: Bunting et al. 2022, doi:10.5281/zenodo.6894273 (CC BY 4.0).

De cada zip anual (~66 MB, todo el mundo) se leen SOLO los cuadros 1x1 grado que tocan el sitio
(lectura remota por rangos, sin descargar el zip completo). Se reproyecta a la misma malla de la app.

Salida por sitio (web/<sitio>/ref/):
  gmw_<ano>.png          manglar de ese ano (verde)
  gmw_change.png         1996 -> 2020: rojo = perdido, azul = ganado, verde = se mantuvo
  gmw.json               km2 por ano + perdida/ganancia
Uso: python scripts/fetch_mangrove_history.py
"""
import io
import json
import math
import os
import zipfile

import fsspec
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZEN = "https://zenodo.org/api/records/6894273/files/gmw_v3_{y}_gtiff.zip/content"
YEARS = [1996, 2007, 2008, 2009, 2010, 2015, 2016, 2017, 2018, 2019, 2020]
STEP = 0.00018
SITES = {
    "barra": {"base": "web/data", "bbox": (-90.13, 13.66, -89.95, 13.79)},
    "jiquilisco": {"base": "web/data-jiquilisco", "bbox": (-88.70, 13.17, -88.30, 13.33)},
}


def tiles_for(bbox):
    """Nombre de cuadro GMW = esquina superior izquierda (N<lat>W<lon>)."""
    W, S, E, N = bbox
    out = set()
    for lat in range(math.floor(S), math.floor(N) + 1):
        for lon in range(math.floor(W), math.floor(E) + 1):
            out.add(f"N{lat + 1:02d}W{abs(lon):03d}")
    return out


def grid(bbox):
    W, S, E, N = bbox
    return from_origin(W, N, STEP, STEP), int(round((E - W) / STEP)), int(round((N - S) / STEP))


def main():
    need = {}
    for name, s in SITES.items():
        need[name] = tiles_for(s["bbox"])
    all_tiles = set().union(*need.values())
    print("cuadros necesarios:", sorted(all_tiles))
    masks = {name: {} for name in SITES}
    for y in YEARS:
        with fsspec.open(ZEN.format(y=y), "rb", block_size=512 * 1024) as f:
            z = zipfile.ZipFile(f)
            members = {n.split("/")[-1].split("_")[1]: n for n in z.namelist() if n.endswith(".tif")}
            data = {t: z.read(members[t]) for t in all_tiles if t in members}
        for name, s in SITES.items():
            tr, nx, ny = grid(s["bbox"])
            acc = np.zeros((ny, nx), np.uint8)
            for t in need[name]:
                if t not in data:
                    continue
                with rasterio.MemoryFile(io.BytesIO(data[t])) as mf, mf.open() as src:
                    part = np.zeros((ny, nx), np.uint8)
                    reproject(rasterio.band(src, 1), part, dst_transform=tr, dst_crs="EPSG:4326",
                              resampling=Resampling.nearest, src_nodata=0, dst_nodata=0)
                    acc |= (part > 0).astype(np.uint8)
            masks[name][y] = acc.astype(bool)
        print(y, {n: int(masks[n][y].sum()) for n in SITES}, flush=True)

    for name, s in SITES.items():
        base = os.path.join(ROOT, s["base"], "ref")
        os.makedirs(base, exist_ok=True)
        W, S, E, N = s["bbox"]
        px = STEP * 111.32 * STEP * 111.32 * math.cos(math.radians((S + N) / 2))
        km2 = {}
        for y, m in masks[name].items():
            km2[str(y)] = round(float(m.sum() * px), 2)
            rgba = np.zeros(m.shape + (4,), np.uint8)
            rgba[m] = (0, 207, 117, 210)
            Image.fromarray(rgba, "RGBA").save(os.path.join(base, f"gmw_{y}.png"), optimize=True)
        a, b = masks[name][YEARS[0]], masks[name][YEARS[-1]]
        ch = np.zeros(a.shape + (4,), np.uint8)
        ch[a & b] = (0, 207, 117, 150)
        ch[a & ~b] = (255, 70, 70, 235)
        ch[~a & b] = (70, 150, 255, 235)
        Image.fromarray(ch, "RGBA").save(os.path.join(base, "gmw_change.png"), optimize=True)
        out = {"source": "Global Mangrove Watch v3.0 (Bunting et al. 2022), radar banda L de JAXA, CC BY 4.0",
               "years": km2, "loss_km2": round(float((a & ~b).sum() * px), 2), "gain_km2": round(float((~a & b).sum() * px), 2),
               "from": YEARS[0], "to": YEARS[-1], "change_img": "ref/gmw_change.png",
               "imgs": {str(y): f"ref/gmw_{y}.png" for y in YEARS}}
        json.dump(out, open(os.path.join(base, "gmw.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(name, out["years"], "perdido", out["loss_km2"], "ganado", out["gain_km2"])


if __name__ == "__main__":
    main()
