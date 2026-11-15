"""Detecta estanques (camaroneras / salineras) junto al manglar con NISAR: agua quieta que se repite en casi
todas las pasadas y tiene forma RECTANGULAR (la naturaleza no hace rectangulos; los estanques si).

Pasos:
 1. agua frecuente: pixel clasificado como agua (no mar) en >= 25 % de las fechas validas
    (las salineras y camaroneras se vacian parte del ano)
 2. se separan los cuerpos de agua (componentes conectados)
 3. por cada uno: area entre 1 y 150 ha, y "rectangularidad" = area / area de su rectangulo orientado >= 0.70
    (se descartan canales largos: alargamiento < 8)
 4. se mide cuanto queda a menos de 1 km del manglar (mapa ESA) y cuanto coincide con las perdidas
    de manglar 1996-2020 (Global Mangrove Watch)
Salida: web/<sitio>/ref/ponds.png y ponds.json
Uso: python scripts/detect_ponds.py
"""
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"barra": "web/data", "jiquilisco": "web/data-jiquilisco"}
MIN_HA, MAX_HA, MIN_RECT, MAX_ELONG = 1.0, 150.0, 0.70, 8.0


def oriented_fill(ys, xs):
    """area / area del rectangulo orientado (ejes principales del cuerpo de agua)"""
    pts = np.stack([xs, ys], 1).astype(float)
    pts -= pts.mean(0)
    _, vec = np.linalg.eigh(np.cov(pts.T))
    r = pts @ vec
    w = r[:, 0].max() - r[:, 0].min() + 1
    h = r[:, 1].max() - r[:, 1].min() + 1
    return len(xs) / (w * h), max(w, h) / max(1.0, min(w, h))


def main():
    for name, rel in SITES.items():
        base = os.path.join(ROOT, rel)
        S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
        dates = [d for d in S["dates"] if d.get("qc", True) and (d.get("coverage_pct") or 100) >= 50]
        W, So, E, N = S["bbox"]
        px_ha = S["step"] * 111.32 * S["step"] * 111.32 * math.cos(math.radians((So + N) / 2)) * 100
        cnt = seen = None
        for d in dates:
            c = np.array(Image.open(os.path.join(base, os.path.basename(d["cls"]))).convert("RGBA"))
            water = (c[..., 2] > 200) & (c[..., 0] < 60) & (c[..., 3] > 150)   # agua interior (no mar)
            e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"]))))
            v = e > 0
            cnt = water.astype(np.int16) if cnt is None else cnt + water
            seen = v.astype(np.int16) if seen is None else seen + v
        freq = np.where(seen > 0, cnt / np.maximum(seen, 1), 0)
        persistent = (freq >= 0.25) & (seen >= max(3, 0.5 * len(dates)))  # incluye estanques que se llenan y vacian (salineras)
        codes = np.array(Image.open(os.path.join(base, "ref", "worldcover_codes.png")))
        mang = codes == 95
        near_m = ndimage.distance_transform_edt(~mang) * S["step"] * 111.32 <= 1.0
        gmw_loss = None
        p = os.path.join(base, "ref", "gmw_change.png")
        if os.path.exists(p):
            g = np.array(Image.open(p).convert("RGBA"))
            gmw_loss = (g[..., 0] > 200) & (g[..., 1] < 120) & (g[..., 3] > 200)
        lab, n = ndimage.label(persistent)
        ponds = np.zeros(lab.shape, bool)
        items = []
        objs = ndimage.find_objects(lab)
        for i, sl in enumerate(objs, 1):
            m = lab[sl] == i
            ha = m.sum() * px_ha
            if not (MIN_HA <= ha <= MAX_HA):
                continue
            ys, xs = np.nonzero(m)
            fill, elong = oriented_fill(ys, xs)
            if fill < MIN_RECT or elong > MAX_ELONG:
                continue
            ponds[sl] |= m
            cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
            items.append({"ha": round(float(ha), 1), "rect": round(float(fill), 2), "water_freq": round(float(freq[sl][m].mean()), 2),
                          "lat": round(N - (cy + 0.5) * S["step"], 5), "lon": round(W + (cx + 0.5) * S["step"], 5)})
        rgba = np.zeros(ponds.shape + (4,), np.uint8)
        rgba[ponds] = (255, 150, 30, 235)
        edge = ponds & ~ndimage.binary_erosion(ponds)
        rgba[edge] = (255, 240, 200, 255)
        Image.fromarray(rgba, "RGBA").save(os.path.join(base, "ref", "ponds.png"), optimize=True)
        out = {"method": "agua en >=25% de las fechas NISAR (incluye estanques que se vacian) + forma rectangular (>=0.70), 1-150 ha",
               "count": len(items), "area_ha": round(float(ponds.sum() * px_ha), 1),
               "near_mangrove_ha": round(float((ponds & near_m).sum() * px_ha), 1),
               "on_mangrove_loss_ha": round(float((ponds & gmw_loss).sum() * px_ha), 1) if gmw_loss is not None else None,
               "gmw_loss_near_ponds_ha": round(float((gmw_loss & (ndimage.distance_transform_edt(~ponds) * S["step"] * 111.32 <= 0.3)).sum() * px_ha), 1) if gmw_loss is not None else None,
               "img": "ref/ponds.png", "ponds": sorted(items, key=lambda x: -x["ha"])[:60]}
        json.dump(out, open(os.path.join(base, "ref", "ponds.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(name, {k: v for k, v in out.items() if k != "ponds"})


if __name__ == "__main__":
    main()
