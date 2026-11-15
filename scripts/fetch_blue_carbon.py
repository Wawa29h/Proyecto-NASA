"""Carbono azul: cuanto carbono guardan los manglares, con el mapa de NASA de biomasa y altura de manglares
(Simard et al. 2019, "Global Mangrove Distribution, Aboveground Biomass, and Canopy Height", ORNL DAAC 1665).

Calculo (solo arboles, sin el suelo):
  biomasa aerea (Mg/ha, del mapa NASA)
  + biomasa de raices = 0.49 x aerea           (relacion raiz/tallo de manglar, Komiyama et al. 2008)
  carbono = 0.47 x biomasa                     (fraccion de carbono IPCC)
  CO2 = carbono x 3.67
El suelo del manglar guarda varias veces mas carbono que los arboles; aqui NO se suma (se dice en la app).
Equivalencia: un carro de gasolina emite ~4.6 t CO2 al ano (EPA).
Salida: web/<sitio>/ref/carbon.json y carbon_height.png
Uso: python scripts/fetch_blue_carbon.py
"""
import json
import math
import os
import tempfile

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP = 0.00018
SITES = {
    "barra": {"base": "web/data", "bbox": (-90.13, 13.66, -89.95, 13.79)},
    "jiquilisco": {"base": "web/data-jiquilisco", "bbox": (-88.70, 13.17, -88.30, 13.33)},
}
ROOT_SHOOT, C_FRAC, CO2_C, CAR_T = 0.49, 0.47, 3.67, 4.6


def login():
    import earthaccess
    import netrc
    c = netrc.netrc(os.path.expanduser("~/.netrc")).authenticators("urs.earthdata.nasa.gov")
    os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"] = c[0], c[2]
    earthaccess.login(strategy="environment")
    return earthaccess


def warp(path, bbox):
    W, S, E, N = bbox
    tr = from_origin(W, N, STEP, STEP)
    nx, ny = int(round((E - W) / STEP)), int(round((N - S) / STEP))
    dst = np.full((ny, nx), np.nan, np.float32)
    with rasterio.open(path) as src:
        reproject(rasterio.band(src, 1), dst, dst_transform=tr, dst_crs="EPSG:4326",
                  resampling=Resampling.nearest, src_nodata=src.nodata, dst_nodata=np.nan)
    return dst


def main():
    ea = login()
    grans = ea.search_data(short_name="CMS_Global_Map_Mangrove_Canopy_1665", count=300)
    want = [g for g in grans if any(k in g.data_links()[0] for k in ("agb_ElSalvador", "hmax95_ElSalvador"))]
    tmp = tempfile.mkdtemp(prefix="mangrove_nasa_")
    files = ea.download(want, tmp)
    agb_f = next(f for f in files if "agb" in os.path.basename(f))
    h_f = next(f for f in files if "hmax95" in os.path.basename(f))
    for name, s in SITES.items():
        agb = warp(agb_f, s["bbox"])
        h = warp(h_f, s["bbox"])
        agb[(agb <= 0) | (agb > 1000)] = np.nan
        h[(h <= 0) | (h > 80)] = np.nan
        W, S, E, N = s["bbox"]
        px_ha = (STEP * 111.32 * STEP * 111.32 * math.cos(math.radians((S + N) / 2))) * 100
        ok = np.isfinite(agb)
        biomass_t = float(np.nansum(agb[ok]) * px_ha) * (1 + ROOT_SHOOT)
        carbon_t = biomass_t * C_FRAC
        co2_t = carbon_t * CO2_C
        area_ha = float(ok.sum() * px_ha)
        rgba = np.zeros(h.shape + (4,), np.uint8)
        hv = np.clip(np.nan_to_num(h) / 25.0, 0, 1)
        rgba[..., 0] = (20 + 30 * hv).astype(np.uint8)
        rgba[..., 1] = (120 + 120 * hv).astype(np.uint8)
        rgba[..., 2] = (60 + 40 * (1 - hv)).astype(np.uint8)
        rgba[..., 3] = np.where(np.isfinite(h), 220, 0)
        base = os.path.join(ROOT, s["base"], "ref")
        Image.fromarray(rgba, "RGBA").save(os.path.join(base, "carbon_height.png"), optimize=True)
        out = {"source": "NASA ORNL DAAC 1665 (Simard et al. 2019): biomasa y altura de manglares, ano 2000",
               "area_ha": round(area_ha), "mean_agb_t_ha": round(float(np.nanmean(agb)), 1),
               "mean_height_m": round(float(np.nanmean(h)), 1), "max_height_m": round(float(np.nanmax(h)), 1),
               "carbon_t": round(carbon_t), "co2_t": round(co2_t), "co2_per_ha_t": round(co2_t / max(area_ha, 1), 1),
               "cars_year_equiv": round(co2_t / CAR_T), "height_img": "ref/carbon_height.png",
               "method": "biomasa aerea NASA + raices (0.49) x 0.47 carbono x 3.67 CO2; sin suelo"}
        json.dump(out, open(os.path.join(base, "carbon.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(name, out)


if __name__ == "__main__":
    main()
