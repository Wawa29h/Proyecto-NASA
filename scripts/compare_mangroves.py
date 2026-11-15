"""Compara manglares con NISAR usando las mismas medidas.

Por sitio y por fecha, dentro del manglar del mapa ESA WorldCover (clase 95):
- HV mediana (senal de radar; no diagnostica por si sola salud del manglar)
- % del manglar con doble rebote (HH > -3 dB) = manglar con agua debajo
- agua del estero/bahia (km2)
Y en el ano:
- % del manglar con perdida persistente de senal (HV baja > 3 dB en las 3 ultimas fechas vs las 3 primeras)
Uso: python scripts/compare_mangroves.py
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"Barra de Santiago": "web/data", "Bahia de Jiquilisco": "web/data-jiquilisco"}


def load(base, d, rng):
    lo, hi = rng
    e = np.array(Image.open(os.path.join(base, os.path.basename(d["hh"])))).astype(np.float32)
    hh = np.where(e > 0, lo + (e - 1) / 254 * (hi - lo), np.nan)
    rgb = np.array(Image.open(os.path.join(base, os.path.basename(d["rgb"]))).convert("RGBA")).astype(np.float32)
    hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
    return hh, hv


def sha256(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def common_signal_change(hvs, mang):
    """Common processed support, including fills: not an observed-only mask."""
    if len(hvs) < 6:
        raise ValueError("Se requieren al menos seis observaciones para ventanas no superpuestas")
    covered = mang & np.isfinite(hvs).all(0)
    if not covered.any():
        raise ValueError("Sin soporte comun valido: no se publica una perdida igual a cero")
    # Numerator and denominator use exactly the same support.
    first = hvs[:3, covered].mean(0)
    last = hvs[-3:, covered].mean(0)
    return covered, int((last - first < -3).sum()), int((last - first > 3).sum())


def water_area(cls, px):
    # Count the published classification, independently of the series statistics.
    water = np.all(cls == (30, 136, 229, 230), axis=-1)
    return round(float(water.sum() * px), 3)


def build_site(root, rel, site):
    base = Path(root) / rel
    inputs = {}

    def record(path):
        path = Path(path)
        inputs[path.relative_to(root).as_posix()] = sha256(path)
        return path

    record(Path(root) / "web/sites.json")
    S = json.loads(record(base / "series.json").read_text(encoding="utf-8"))
    codes = np.array(Image.open(record(base / "ref/worldcover_codes.png")))
    mang = codes == 95
    px = S["step"] ** 2 * 111.32 ** 2 * np.cos(np.radians((S["bbox"][1] + S["bbox"][3]) / 2))
    dates = [d for d in S["dates"] if d.get("qc") is not False and
             d.get("coverage_pct", 100) + d.get("time_filled_pct", 0) >= site.get("min_coverage", 90)]
    if len({d["id"] for d in dates}) != len(dates) or len({d["date"] for d in dates}) != len(dates):
        raise ValueError(f"{rel}: fechas o identificadores duplicados")
    dates.sort(key=lambda d: d["date"])
    rows, hvs = [], []
    for d in dates:
        for field in ("hh", "rgb", "cls"):
            record(base / os.path.basename(d[field]))
        hh, hv = load(base, d, S["hh_range"])
        cls = np.array(Image.open(base / os.path.basename(d["cls"])).convert("RGBA"))
        if hh.shape != codes.shape or hv.shape != codes.shape or cls.shape[:2] != codes.shape:
            raise ValueError(f"{rel}/{d['id']}: mallas incompatibles")
        water = water_area(cls, px)
        if abs(water - d["water_km2"]) > 0.0005:
            raise ValueError(f"{rel}/{d['id']}: clasificacion y serie discrepan; no se regenera parcialmente")
        m = mang & np.isfinite(hh) & np.isfinite(hv)
        if not m.any():
            raise ValueError(f"{rel}/{d['id']}: sin manglar valido")
        rows.append({"date": d["date"], "hv_mangrove": round(float(np.median(hv[m])), 2),
                     "flooded_mangrove_pct": round(100 * float((hh[m] > -3).mean()), 1),
                     "water_km2": water})
        hvs.append(np.where(m, hv, np.nan))
    covered, loss_count, gain_count = common_signal_change(np.array(hvs), mang)
    hv_m = [r["hv_mangrove"] for r in rows]
    fl = [r["flooded_mangrove_pct"] for r in rows]
    wa = [r["water_km2"] for r in rows]
    # Refuse publication if input files changed during this computation.
    for path, digest in inputs.items():
        if sha256(Path(root) / path) != digest:
            raise ValueError(f"Entrada modificada durante el calculo: {path}")
    return {"mangrove_km2": round(float(mang.sum() * px), 1),
            "mangrove_seen_km2": round(float(covered.sum() * px), 1), "dates": rows,
            "hv_range_db": round(max(hv_m) - min(hv_m), 2),
            "flooded_range_pct": [min(fl), max(fl)], "water_range_km2": [min(wa), max(wa)],
            "loss_km2": round(float(loss_count * px), 2),
            "loss_pct": round(100 * loss_count / int(covered.sum()), 2),
            "gain_km2": round(float(gain_count * px), 2),
            "provenance": {
                "schema_version": "1.0",
                "basis": "published_processed_rasters",
                "generator": "scripts/compare_mangroves.py",
                "generator_sha256": sha256(Path(__file__)),
                "input_sha256": inputs,
                "method": "HH encoded -30..5 dB; HV decoded from RGB green -32..-8 dB; WorldCover class 95",
                "change_support": "common valid processed mangrove pixels across all selected dates",
                "change_definition": "mean HV of last 3 minus first 3 observations; thresholds -3/+3 dB",
                "water_definition": "count of RGBA (30,136,229,230) in published classification",
                "temporal_fill_dates": [d["date"] for d in dates if d.get("time_filled_pct", 0) > 0],
                "orbital_fill_dates": [d["date"] for d in dates if d.get("filled_pct", 0) > 0],
                "limitations": ["Fills remain included; processed validity is not observed-only provenance.",
                                "Signal loss/gain does not establish ecological loss/gain.",
                                "Quantized processed inputs; not a regeneration from original NISAR HDF5."]}}


def build(root=ROOT):
    config = json.loads((Path(root) / "web/sites.json").read_text(encoding="utf-8"))
    by_base = {"web/" + s["base"]: s for s in config}
    return {name: build_site(root, rel, by_base[rel]) for name, rel in SITES.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default=os.path.join(ROOT, "web/mangrove_comparison.json"))
    args = ap.parse_args()
    out = build()
    payload = json.dumps(out, indent=1, ensure_ascii=False, allow_nan=False) + "\n"
    target = Path(args.output)
    # A complete successful calculation precedes the atomic replacement.
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as stream:
        temporary = stream.name
        stream.write(payload)
    try:
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    for name, item in out.items():
        print(f"{name}: {len(item['dates'])} fechas; soporte procesado comun {item['mangrove_seen_km2']} km2")
    print("Generado:", target)


if __name__ == "__main__":
    main()
