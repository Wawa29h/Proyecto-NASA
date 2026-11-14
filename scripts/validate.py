"""Compara lo que mide NISAR con el mapa oficial ESA WorldCover 2021.

- Firma de radar (HH y HV medianos) de cada tipo de cobertura en cada fecha.
- Coincidencia del agua del estero de NISAR con el agua/manglar de WorldCover.
Escribe web/data/ref/validation.json (lo usa la app).
Uso: python scripts/validate.py  (despues de fetch_gcov.py y fetch_reference.py)
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
CLASSES = {95: "Manglar", 10: "Bosque", 40: "Cultivo", 30: "Pasto", 80: "Agua"}


def main():
    S = json.load(open(os.path.join(WEB, "data", "series.json"), encoding="utf-8"))
    codes = np.array(Image.open(os.path.join(WEB, "data", "ref", "worldcover_codes.png")))
    lo, hi = S["hh_range"]
    out = {"classes": list(CLASSES.values()), "dates": []}
    # mar fijo = union del mar en todas las fechas (una fecha con hueco no debe contar el mar como "agua interior")
    sea_all = None
    for d in S["dates"]:
        c = np.array(Image.open(os.path.join(WEB, d["cls"])).convert("RGBA"))
        o = (c[..., 3] > 0) & (c[..., 3] < 150)
        sea_all = o if sea_all is None else (sea_all | o)
    for d in S["dates"]:
        if d.get("qc") is False:
            print(d["date"], "descartada (sin contraste agua/vegetacion)")
            continue
        e = np.array(Image.open(os.path.join(WEB, d["hh"]))).astype(float)
        hh = np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan)
        rgb = np.array(Image.open(os.path.join(WEB, d["rgb"])).convert("RGBA")).astype(float)
        hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
        cls = np.array(Image.open(os.path.join(WEB, d["cls"])).convert("RGBA"))
        ocean = sea_all
        covered = np.isfinite(hh)
        estero = (cls[..., 2] > 200) & (cls[..., 0] < 60) & (cls[..., 3] > 150)

        row = {"date": d["date"], "hh": {}, "hv": {}}
        for c, name in CLASSES.items():
            m = (codes == c) & np.isfinite(hh) & ~ocean
            row["hh"][name] = round(float(np.nanmedian(hh[m])), 2) if m.sum() > 50 else None
            row["hv"][name] = round(float(np.nanmedian(hv[m])), 2) if m.sum() > 50 else None
        inland_water = (codes == 80) & ~ocean & covered
        row["estero_en_mapa_pct"] = round(100 * float((estero & ((codes == 80) | (codes == 95) | (codes == 90))).sum()) / max(1, estero.sum()), 1)
        row["agua_mapa_detectada_pct"] = round(100 * float((estero & inland_water).sum()) / max(1, inland_water.sum()), 1)
        out["dates"].append(row)
        print(d["date"], "HV manglar", row["hv"]["Manglar"], "| cultivo", row["hv"]["Cultivo"],
              "| agua", row["hv"]["Agua"], "| estero NISAR dentro de agua/manglar del mapa:", row["estero_en_mapa_pct"], "%",
              "| agua del mapa vista por NISAR:", row["agua_mapa_detectada_pct"], "%")
    with open(os.path.join(WEB, "data", "ref", "validation.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
