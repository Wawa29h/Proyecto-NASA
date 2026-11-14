"""Alerta de lirio por zonas del embalse Cerron Grande, a partir de lo que detecta NISAR + IA.

Divide el embalse (agua permanente del mapa ESA) en 4 zonas reconocibles y, para cada pasada:
  - km2 con plantas flotantes y % del agua de la zona
  - cambio contra la pasada anterior
  - nivel (bajo / medio / alto) comparado con el resto del ano en esa misma zona
  - un mensaje corto en lenguaje comun, listo para copiar
Salida: web/data-cerron/alerts.json
Uso: python scripts/lirio_alert.py   (despues de train_radar_from_photo.py)
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "web", "data-cerron")
# zonas por coordenadas (W, S, E, N): aproximadas, pensadas para que la gente las reconozca
ZONES = [
    {"id": "lempa", "name": "Entrada del río Lempa", "short": "Entrada del Lempa", "box": (-89.27, 13.93, -89.10, 14.13)},
    {"id": "norte", "name": "Norte (Chalatenango)", "short": "Norte", "box": (-89.10, 14.04, -88.98, 14.13)},
    {"id": "centro", "name": "Centro del embalse", "short": "Centro", "box": (-89.10, 13.93, -88.98, 14.04)},
    {"id": "sur", "name": "Brazo sur y este (Suchitoto – Cabañas)", "short": "Brazo sur", "box": (-88.98, 13.93, -88.93, 14.13)},
]
MIN_COVER = 90  # % del agua que debe ver el radar para usar la fecha


def fmt_date(s):
    m = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    y, mo, d = s.split("-")
    return f"{int(d)} {m[int(mo) - 1]} {y}"


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    S = json.load(open(os.path.join(BASE, "series.json"), encoding="utf-8"))
    ml = json.load(open(os.path.join(BASE, "ml.json"), encoding="utf-8"))
    W, So, E, N = S["bbox"]
    step = S["step"]
    px = step * 111.32 * step * 111.32 * np.cos(np.radians((So + N) / 2))
    lake = np.array(Image.open(os.path.join(BASE, "ref", "worldcover_codes.png"))) == 80
    ny, nx = lake.shape
    lon = W + (np.arange(nx) + 0.5) * step
    lat = N - (np.arange(ny) + 0.5) * step
    LON, LAT = np.meshgrid(lon, lat)
    masks = {}
    zones_out = []
    for z in ZONES:
        w, s, e, n = z["box"]
        m = lake & (LON >= w) & (LON < e) & (LAT >= s) & (LAT < n)
        masks[z["id"]] = m
        ys, xs = np.nonzero(m)
        zones_out.append({**{k: z[k] for k in ("id", "name", "short")}, "box": z["box"],
                          "water_km2": round(float(m.sum() * px), 1),
                          "label": [round(float(lat[int(np.median(ys))]), 4), round(float(lon[int(np.median(xs))]), 4)]})
        print(f"{z['name']}: {m.sum() * px:.1f} km2 de agua")

    rows = []
    for d in [x for x in ml["dates"] if x["lake_covered_pct"] >= MIN_COVER]:
        a = np.array(Image.open(os.path.join(BASE, d["img"])).convert("RGBA"))[..., 3] > 0
        zs = {}
        for z in ZONES:
            m = masks[z["id"]]
            k = float((a & m).sum() * px)
            zs[z["id"]] = {"km2": round(k, 2), "pct": round(100 * k / max(1e-9, m.sum() * px), 1)}
        rows.append({"date": d["date"], "id": d["id"], "zones": zs})
    rows.sort(key=lambda r: r["date"])

    # nivel comparado con el ano en la misma zona, y cambio contra la pasada anterior
    for z in ZONES:
        vals = np.array([r["zones"][z["id"]]["km2"] for r in rows])
        lo, hi = np.percentile(vals, [33, 66])
        for i, r in enumerate(rows):
            v = r["zones"][z["id"]]
            v["level"] = "alto" if v["km2"] > hi else "bajo" if v["km2"] <= lo else "medio"
            v["delta_km2"] = round(v["km2"] - rows[i - 1]["zones"][z["id"]]["km2"], 2) if i else None

    for i, r in enumerate(rows):
        prev = rows[i - 1]["date"] if i else None
        worst = max(ZONES, key=lambda z: r["zones"][z["id"]]["km2"])
        lines = [f"Lirio acuático · Embalse Cerrón Grande · {fmt_date(r['date'])} (satélite NISAR, ve aunque esté nublado)"]
        for z in ZONES:
            v = r["zones"][z["id"]]
            arrow = "" if v["delta_km2"] is None else (" ▲ sube" if v["delta_km2"] > 0.3 else " ▼ baja" if v["delta_km2"] < -0.3 else " = igual")
            lines.append(f"• {z['short']}: {v['km2']:.1f} km² ({v['pct']:.0f}% del agua){arrow} · nivel {v['level'].upper()}")
        altos = [z for z in ZONES if r["zones"][z["id"]]["level"] == "alto"]
        if altos:
            lines.append("Atención: nivel ALTO en " + ", ".join(z["name"] for z in altos) +
                         f". La zona con más lirio es {worst['name']}. Precaución con lanchas y redes.")
        else:
            lines.append(f"Ninguna zona en nivel alto respecto al resto del año. La zona con más lirio es {worst['name']}.")
        if prev:
            lines.append(f"Comparado con la pasada del {fmt_date(prev)}.")
        lines.append("Dato experimental: confirmar en el lugar.")
        r["message"] = "\n".join(lines)
        r["top_zone"] = worst["id"]

    json.dump({"source": "NISAR + IA (radar_from_photo)", "zones": zones_out, "dates": rows},
              open(os.path.join(BASE, "alerts.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(rows[-1]["message"])


if __name__ == "__main__":
    main()
