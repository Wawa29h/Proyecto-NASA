""""El radar aprende de la foto": entrena un modelo para detectar PLANTAS SOBRE EL AGUA con radar NISAR,
usando como 'respuestas' las fotos Sentinel-2 de dias despejados.

Idea: Sentinel-2 ve las plantas (NDVI alto) solo sin nubes; NISAR ve siempre, pero no "sabe" que es una
planta. Emparejamos fechas cercanas (<= MAX_GAP dias), mostramos al modelo la senal de radar de cada pixel y
lo que la foto dijo de ese pixel. Luego el modelo detecta plantas en TODAS las fechas NISAR, incluidas las
nubladas de la epoca lluviosa.

Validacion honesta: "deja una fecha fuera" (se entrena con las otras parejas y se prueba en la que el
modelo nunca vio). Se compara contra la regla fija anterior (umbral de HV).

Uso: python scripts/train_radar_from_photo.py --site cerron
Salida: web/<sitio>/ml.json, web/<sitio>/<fecha>_ml.png, models/radar_from_photo_<sitio>.joblib
"""
import argparse
import datetime as dt
import json
import os

import joblib
import numpy as np
from PIL import Image
from scipy import ndimage
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, precision_score, recall_score

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"cerron": "web/data-cerron", "barra": "web/data"}
MAX_GAP = 8          # dias maximos entre la foto y el radar
MIN_COVER = 0.5      # fraccion minima del agua cubierta por NISAR para usar la pareja
PER_PAIR = 60000     # pixeles de muestra por pareja (balanceados)
FEATURES = ["HH", "HV", "HH-HV", "HH rel. agua", "HV rel. agua", "HH media 5x5", "HV media 5x5",
            "HH textura 5x5", "HV textura 5x5", "distancia a la orilla"]
RNG = np.random.default_rng(42)


def d2(s):
    return dt.date.fromisoformat(s)


def load_nisar(base, d, hh_range):
    lo, hi = hh_range
    e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
    hh = np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan)
    rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
    hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
    return hh, hv


def local(a, size):
    """media y desviacion local ignorando NaN"""
    v = np.isfinite(a).astype(np.float32)
    z = np.nan_to_num(a)
    n = ndimage.uniform_filter(v, size)
    m = ndimage.uniform_filter(z, size) / np.maximum(n, 1e-6)
    m2 = ndimage.uniform_filter(z * z, size) / np.maximum(n, 1e-6)
    return m, np.sqrt(np.maximum(m2 - m * m, 0))


def features(hh, hv, calib, dist):
    wh = (calib or {}).get("water_hh", -20.0)
    wv = (calib or {}).get("water_hv", -25.0)
    mh, sh = local(hh, 5)
    mv, sv = local(hv, 5)
    return np.stack([hh, hv, hh - hv, hh - wh, hv - wv, mh, mv, sh, sv, dist], axis=-1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", choices=SITES, default="cerron")
    a = ap.parse_args()
    base = os.path.join(ROOT, SITES[a.site])
    S = json.load(open(os.path.join(base, "series.json"), encoding="utf-8"))
    R = json.load(open(os.path.join(base, "ref", "reference.json"), encoding="utf-8"))
    codes = np.array(Image.open(os.path.join(base, "ref", "worldcover_codes.png")))
    lake = codes == 80
    dist = ndimage.distance_transform_edt(lake).astype(np.float32)  # px desde la orilla hacia adentro
    px_km2 = S["step"] * 111.32 * S["step"] * 111.32 * np.cos(np.radians((S["bbox"][1] + S["bbox"][3]) / 2))
    nis = [d for d in S["dates"] if d.get("qc", True)]

    # ---- 1. emparejar fechas foto <-> radar ----
    pairs = []
    for s in R["sentinel2"]:
        best = min(nis, key=lambda d: abs((d2(d["date"]) - d2(s["date"])).days))
        gap = abs((d2(best["date"]) - d2(s["date"])).days)
        if gap > MAX_GAP or s.get("cloud_water_pct", 100) > 10:
            continue
        hh, hv = load_nisar(base, best, S["hh_range"])
        photo = np.array(Image.open(os.path.join(base, "ref", os.path.basename(s["img"])))).astype(np.int16)
        cloud = photo.min(-1) > 180                                   # nubes brillantes en la foto
        veg = np.array(Image.open(os.path.join(base, "ref", os.path.basename(s["veg_img"]))).convert("RGBA"))[..., 3] > 0
        valid = lake & np.isfinite(hh) & np.isfinite(hv) & ~cloud
        if valid.sum() < MIN_COVER * lake.sum():
            continue
        X = features(hh, hv, best.get("calib"), dist)
        pairs.append({"s2": s["date"], "nisar": best["date"], "gap": gap, "X": X, "y": veg, "valid": valid,
                      "rule": None})
        # regla fija anterior (clase verde de fetch_gcov) para comparar
        cls = np.array(Image.open(os.path.join(base, os.path.basename(best["cls"]))).convert("RGBA"))
        pairs[-1]["rule"] = (cls[..., 1] > 200) & (cls[..., 0] < 100)
        print(f"  pareja: foto {s['date']} <-> radar {best['date']} ({gap} d) | pixeles validos {valid.sum()} | "
              f"plantas en la foto {veg[valid].mean() * 100:.1f}%")
    if len(pairs) < 3:
        raise SystemExit("Muy pocas parejas para entrenar")

    def sample(p):
        """muestra al azar con la proporcion REAL de plantas/agua (asi el area que predice queda calibrada)"""
        idx = np.flatnonzero(p["valid"] & np.isfinite(p["X"]).all(-1))
        sel = RNG.choice(idx, min(PER_PAIR, len(idx)), replace=False)
        return p["X"].reshape(-1, len(FEATURES))[sel], p["y"].ravel()[sel]

    def model():
        return RandomForestClassifier(n_estimators=120, max_depth=12, min_samples_leaf=25, oob_score=True,
                                      n_jobs=-1, random_state=0)

    def fit(parts):
        """entrena y elige el corte de decision que maximiza F1 en las predicciones 'fuera de bolsa'
        (datos de entrenamiento que cada arbol no vio): no usa la fecha de prueba."""
        X = np.concatenate([t[0] for t in parts])
        y = np.concatenate([t[1] for t in parts])
        m = model().fit(X, y)
        oob = m.oob_decision_function_[:, 1]
        ok = np.isfinite(oob)
        grid = np.arange(0.2, 0.75, 0.025)
        thr = float(grid[np.argmax([f1_score(y[ok], oob[ok] >= t) for t in grid])])
        return m, thr

    # ---- 2. validacion: dejar una fecha fuera ----
    print("Validacion (el modelo nunca vio la fecha que se prueba):")
    folds = []
    for i, test in enumerate(pairs):
        m, thr = fit([sample(p) for j, p in enumerate(pairs) if j != i])
        v = test["valid"] & np.isfinite(test["X"]).all(-1)
        yt = test["y"][v]
        yp = m.predict_proba(test["X"][v])[:, 1] >= thr
        yr = test["rule"][v]
        f = {"s2": test["s2"], "nisar": test["nisar"], "gap_days": test["gap"],
             "f1": round(f1_score(yt, yp), 3), "precision": round(precision_score(yt, yp, zero_division=0), 3),
             "recall": round(recall_score(yt, yp), 3), "f1_rule": round(f1_score(yt, yr), 3),
             "photo_km2": round(float(yt.sum() * px_km2), 2), "model_km2": round(float(yp.sum() * px_km2), 2),
             "rule_km2": round(float(yr.sum() * px_km2), 2)}
        folds.append(f)
        print(f"  {f['s2']}: F1 modelo {f['f1']} vs regla fija {f['f1_rule']} | plantas foto {f['photo_km2']} km2, "
              f"modelo {f['model_km2']} km2, regla {f['rule_km2']} km2")
    mean = lambda k: round(float(np.mean([f[k] for f in folds])), 3)
    print(f"PROMEDIO F1: modelo {mean('f1')} | regla fija {mean('f1_rule')}")

    # ---- 3. modelo final con todas las parejas ----
    final, THR = fit([sample(p) for p in pairs])
    print(f"Corte de decision elegido: {THR:.3f}")
    os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
    joblib.dump(final, os.path.join(ROOT, "models", f"radar_from_photo_{a.site}.joblib"), compress=3)
    imp = sorted(zip(FEATURES, final.feature_importances_), key=lambda t: -t[1])

    # ---- 4. aplicar a TODAS las fechas NISAR ----
    out_dates = []
    for d in nis:
        hh, hv = load_nisar(base, d, S["hh_range"])
        X = features(hh, hv, d.get("calib"), dist)
        v = lake & np.isfinite(X).all(-1)
        prob = np.zeros(lake.shape, np.float32)
        prob[v] = final.predict_proba(X[v])[:, 1]
        pred = v & (prob >= THR)
        rgba = np.zeros(lake.shape + (4,), np.uint8)
        rgba[pred] = (255, 214, 0, 0)
        rgba[pred, 3] = np.clip(140 + (prob[pred] - THR) * 250, 0, 255).astype(np.uint8)
        name = f"{d['id']}_ml.png"
        Image.fromarray(rgba, "RGBA").save(os.path.join(base, name), optimize=True)
        cov = float(v.sum() / lake.sum())
        out_dates.append({"date": d["date"], "id": d["id"], "img": name, "ml_veg_km2": round(float(pred.sum() * px_km2), 2),
                          "lake_covered_pct": round(100 * cov, 1)})
        print(f"  {d['date']}: plantas (NISAR + IA) {out_dates[-1]['ml_veg_km2']} km2  (agua cubierta {100 * cov:.0f}%)")

    json.dump({"model": "Random Forest (120 arboles, prof. 12) - scikit-learn", "threshold": round(THR, 3),
               "trained_on": [{"s2": p["s2"], "nisar": p["nisar"], "gap_days": p["gap"]} for p in pairs],
               "features": FEATURES, "importance": [{"feature": k, "value": round(float(v), 3)} for k, v in imp],
               "validation": {"method": "dejar una fecha fuera", "folds": folds,
                              "mean_f1": mean("f1"), "mean_f1_rule": mean("f1_rule"),
                              "mean_precision": mean("precision"), "mean_recall": mean("recall")},
               "dates": out_dates},
              open(os.path.join(base, "ml.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("Importancia de cada dato:", ", ".join(f"{k} {v:.2f}" for k, v in imp))
    print("listo ->", os.path.join(base, "ml.json"))


if __name__ == "__main__":
    main()
