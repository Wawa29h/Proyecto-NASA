"""Lee en remoto SOLO el recorte de Barra de Santiago de cada NISAR GCOV (sin bajar los 7 GB)
y genera las capas para la app web en web/data/.

Por fecha genera:
  <id>_rgb.png  composicion falso color  R=HH  G=HV  B=HH/HV
  <id>_hh.png   HH en dB codificado en 8 bits (0 = sin dato, 1..255 = -30..+5 dB), para el detector de cambios
  <id>_cls.png  clases: agua abierta (azul) y vegetacion inundada / doble rebote (magenta)
y actualiza web/data/series.json con areas (km2) y promedios.

Uso:
  python scripts/fetch_gcov.py                      # todas las fechas del track 134 A frame 9
  python scripts/fetch_gcov.py --limit 3            # solo las 3 primeras pendientes (prueba)
  python scripts/fetch_gcov.py --local archivo.h5   # un .h5 ya descargado desde Vertex
La primera vez earthaccess te pide usuario y contrasena de Earthdata (los escribes tu en la terminal)
y los guarda en ~/.netrc.
"""
import argparse
import json
import os
import re
import sys

import h5py
import numpy as np
from PIL import Image
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("NISAR_OUT") or os.path.join(ROOT, "web", "data")

# Zona de estudio: estero, manglar y barra de Barra de Santiago (W, S, E, N)
BBOX = (-90.13, 13.66, -89.95, 13.79)
STEP = 0.00018  # grados (~20 m), igual al posteo de GCOV

# Umbrales banda L (gamma0, dB). Ajustables; ver README.
WATER_HH = -17.0   # agua abierta: superficie lisa, refleja lejos del radar
WATER_HV = -24.0
FLOODVEG_HH = -3.0  # doble rebote agua + troncos (manglar / bosque inundado)
WATER_FRAC = 0.35  # umbral adaptativo: fraccion del camino entre la senal del agua y la de la vegetacion
WETLAND_R = 20     # px (~400 m): el "agua del estero" solo cuenta cerca de agua/manglar/humedal del mapa ESA
OCEAN_R = 12       # px (~240 m): canales mas angostos que ~2*OCEAN_R se consideran estero, no mar

HH_MIN, HH_MAX = -30.0, 5.0


# ---------- lectura HDF5 ----------
def find_freq_group(h):
    for path in ("science/LSAR/GCOV/grids/frequencyA", "science/LSAR/GCOV/grids/frequencyB"):
        if path in h and "HHHH" in h[path]:
            return h[path]
    found = []
    h.visit(lambda n: found.append(n) if n.endswith("/HHHH") else None)
    if not found:
        raise RuntimeError("No encontre la banda HHHH en el archivo")
    return h[found[0].rsplit("/", 1)[0]]


def find_epsg(g):
    for name in ("projection",):
        if name in g:
            for k in ("epsg_code", "epsg"):
                if k in g[name].attrs:
                    return int(g[name].attrs[k])
            try:
                return int(g[name][()])
            except Exception:
                pass
    for ds in (g["HHHH"],):
        for k in ("epsg_code", "epsg"):
            if k in ds.attrs:
                return int(ds.attrs[k])
    raise RuntimeError("No encontre el codigo EPSG de la proyeccion")


def box_mean(a, r=1):
    """Filtro de media (2r+1)^2 que ignora NaN: reduce el moteado (speckle)."""
    v = np.isfinite(a)
    z = np.where(v, a, 0.0)
    zp = np.pad(z, r)
    vp = np.pad(v.astype(np.float32), r)
    s = np.zeros_like(z)
    c = np.zeros_like(z)
    n = 2 * r + 1
    for dy in range(n):
        for dx in range(n):
            s += zp[dy:dy + z.shape[0], dx:dx + z.shape[1]]
            c += vp[dy:dy + z.shape[0], dx:dx + z.shape[1]]
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(c > 0, s / c, np.nan)


def read_crop(fobj):
    """Devuelve HH y HV (lineal) remuestreados a una malla lat/lon regular sobre BBOX."""
    with h5py.File(fobj, "r") as h:
        g = find_freq_group(h)
        epsg = find_epsg(g)
        xs = g["xCoordinates"][()]
        ys = g["yCoordinates"][()]
        to_xy = Transformer.from_crs(4326, epsg, always_xy=True)

        W, S, E, N = BBOX
        ex = np.concatenate([np.linspace(W, E, 50), np.full(50, E), np.linspace(E, W, 50), np.full(50, W)])
        ey = np.concatenate([np.full(50, S), np.linspace(S, N, 50), np.full(50, N), np.linspace(N, S, 50)])
        bx, by = to_xy.transform(ex, ey)
        dx = abs(xs[1] - xs[0])
        dy = abs(ys[1] - ys[0])
        m = 5
        cols = np.where((xs >= bx.min() - m * dx) & (xs <= bx.max() + m * dx))[0]
        rows = np.where((ys >= by.min() - m * dy) & (ys <= by.max() + m * dy))[0]
        if len(cols) == 0 or len(rows) == 0:
            raise RuntimeError("La zona de estudio no cae dentro de este granulo")
        c0, c1, r0, r1 = cols.min(), cols.max() + 1, rows.min(), rows.max() + 1
        print(f"    recorte filas {r0}:{r1} cols {c0}:{c1} (EPSG {epsg})", flush=True)
        hh = g["HHHH"][r0:r1, c0:c1].astype(np.float32)
        hv = g["HVHV"][r0:r1, c0:c1].astype(np.float32) if "HVHV" in g else np.full_like(hh, np.nan)
        sx, sy = xs[c0:c1], ys[r0:r1]

    for a in (hh, hv):
        a[(a <= 0) | ~np.isfinite(a)] = np.nan
    hh = box_mean(hh, 1)
    hv = box_mean(hv, 1)

    nx = int(round((E - W) / STEP))
    ny = int(round((N - S) / STEP))
    lon = W + (np.arange(nx) + 0.5) * STEP
    lat = N - (np.arange(ny) + 0.5) * STEP
    LON, LAT = np.meshgrid(lon, lat)
    X, Y = to_xy.transform(LON, LAT)
    ci = np.rint((X - sx[0]) / (sx[1] - sx[0])).astype(int)
    ri = np.rint((Y - sy[0]) / (sy[1] - sy[0])).astype(int)
    ok = (ci >= 0) & (ci < len(sx)) & (ri >= 0) & (ri < len(sy))
    ci = np.clip(ci, 0, len(sx) - 1)
    ri = np.clip(ri, 0, len(sy) - 1)
    HH = np.where(ok, hh[ri, ci], np.nan)
    HV = np.where(ok, hv[ri, ci], np.nan)
    return HH, HV


# ---------- productos ----------
def scale(a, lo, hi):
    return np.clip((a - lo) / (hi - lo) * 255, 0, 255)


def make_products(HH, HV, ident):
    with np.errstate(divide="ignore", invalid="ignore"):
        hh = 10 * np.log10(HH)
        hv = 10 * np.log10(HV)
    valid = np.isfinite(hh)
    ratio = hh - hv

    rgb = np.zeros(hh.shape + (4,), np.uint8)
    rgb[..., 0] = scale(np.nan_to_num(hh, nan=-99), -25, 0)
    rgb[..., 1] = scale(np.nan_to_num(hv, nan=-99), -32, -8)
    rgb[..., 2] = scale(np.nan_to_num(ratio, nan=0), 0, 15)
    rgb[..., 3] = np.where(valid, 255, 0)
    Image.fromarray(rgb, "RGBA").save(os.path.join(OUT, f"{ident}_rgb.png"), optimize=True)

    enc = np.where(valid, 1 + scale(np.nan_to_num(hh, nan=HH_MIN), HH_MIN, HH_MAX) * 254 / 255, 0)
    Image.fromarray(enc.astype(np.uint8), "L").save(os.path.join(OUT, f"{ident}_hh.png"), optimize=True)

    return classify(hh, hv, ident)


_SEA = {}


def sea_mask(shape):
    """Mar fijo a partir del mapa ESA WorldCover (agua conectada al borde de la imagen).
    El mar no cambia entre fechas; asi el oleaje o el viento no lo confunden con el estero."""
    if shape in _SEA:
        return _SEA[shape]
    p = os.path.join(OUT, "ref", "worldcover_codes.png")
    m = None
    if OCEAN_R > 0 and os.path.exists(p):
        codes = np.array(Image.open(p))
        if codes.shape == shape:
            from scipy import ndimage
            water = codes == 80
            core = box_mean(water.astype(np.float32), OCEAN_R) > 0.97
            lab, _ = ndimage.label(core)
            edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
            core = np.isin(lab, edge[edge > 0])
            near_water = box_mean(water.astype(np.float32), 3) > 0
            m = (box_mean(core.astype(np.float32), OCEAN_R + 3) > 0) & near_water
    _SEA[shape] = m
    return m


def wc_codes(shape):
    p = os.path.join(OUT, "ref", "worldcover_codes.png")
    if os.path.exists(p):
        c = np.array(Image.open(p))
        if c.shape == shape:
            return c
    return None


def adaptive_thresholds(hh, hv, codes, sea):
    """Umbral calibrado en cada fecha con el mapa ESA WorldCover como 'maestro':
    mediana de la senal en agua conocida vs vegetacion conocida, corte a la mitad.
    Asi la regla se ajusta sola a la epoca (agua mas rugosa en lluvias, suelo mojado, etc.)."""
    if codes is None:
        return WATER_HH, WATER_HV, None
    from scipy import ndimage
    water_known = ndimage.binary_erosion(codes == 80, iterations=2)
    if sea is not None:
        water_known &= ~sea
    veg_known = np.isin(codes, [95, 10]) if (codes == 95).sum() > 500 else np.isin(codes, [10, 20, 30, 40])
    w = water_known & np.isfinite(hh) & np.isfinite(hv)
    v = veg_known & np.isfinite(hh) & np.isfinite(hv)
    if w.sum() < 200 or v.sum() < 200:
        return WATER_HH, WATER_HV, None
    wh, wv = np.median(hh[w]), np.median(hv[w])
    vh, vv = np.median(hh[v]), np.median(hv[v])
    if vv - wv < 4:  # sin contraste agua/vegetacion: fecha sospechosa
        return WATER_HH, WATER_HV, {"water_hv": round(float(wv), 2), "veg_hv": round(float(vv), 2), "qc": False}
    f = WATER_FRAC  # corte mas cerca del agua: suelo desnudo/arado tambien es oscuro
    return (min(wh + f * (vh - wh), -12.0), wv + f * (vv - wv),
            {"water_hh": round(float(wh), 2), "water_hv": round(float(wv), 2),
             "veg_hh": round(float(vh), 2), "veg_hv": round(float(vv), 2), "qc": True})


def classify(hh, hv, ident):
    valid = np.isfinite(hh)
    hv_ok = np.isfinite(hv)
    ocean = sea_mask(hh.shape)
    codes = wc_codes(hh.shape)
    t_hh, t_hv, calib = adaptive_thresholds(hh, hv, codes, ocean)
    water = valid & (hh < t_hh) & (~hv_ok | (hv < t_hv))
    if ocean is None and OCEAN_R > 0:
        # sin mapa de referencia: erosion (el mar es una mancha enorme; el estero, un canal angosto)
        from scipy import ndimage
        wet = box_mean(np.where(valid, water.astype(np.float32), np.nan), 2) > 0.5
        core = box_mean(wet.astype(np.float32), OCEAN_R) > 0.97
        lab, _ = ndimage.label(core)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        core = np.isin(lab, edge[edge > 0])
        ocean = (box_mean(core.astype(np.float32), OCEAN_R + 2) > 0) & wet
    elif ocean is None:
        ocean = np.zeros_like(water)
    ocean = ocean & valid
    estero = water & ~ocean
    if OCEAN_R > 0 and codes is not None:
        from scipy import ndimage
        zone = ndimage.maximum_filter(np.isin(codes, [80, 90, 95]).astype(np.uint8), size=2 * WETLAND_R + 1) > 0
        estero &= zone
        water = estero | ocean
    floodveg = valid & (hh > FLOODVEG_HH) & ~water & ~ocean
    # Cuerpo de agua interior (embalse): lo que esta dentro del agua permanente pero NO se ve como agua
    # y tiene senal de volumen (HV alta) = superficie con vegetacion flotante (posible lirio)
    floatveg = np.zeros_like(water)
    if OCEAN_R <= 0 and codes is not None:
        from scipy import ndimage
        lake = codes == 80
        zone = ndimage.maximum_filter(lake.astype(np.uint8), size=2 * WETLAND_R + 1) > 0
        water &= zone          # agua solo dentro/cerca del embalse (no parcelas oscuras lejanas)
        estero = water
        floodveg &= zone
        floatveg = lake & valid & ~water & hv_ok & (hv > t_hv + 2)
        floodveg &= ~lake
    cls = np.zeros(hh.shape + (4,), np.uint8)
    cls[ocean] = (20, 50, 90, 90)
    cls[estero] = (30, 136, 229, 230)
    cls[floodveg] = (216, 27, 196, 230)
    cls[floatveg] = (60, 220, 90, 235)
    Image.fromarray(cls, "RGBA").save(os.path.join(OUT, f"{ident}_cls.png"), optimize=True)

    lat_c = (BBOX[1] + BBOX[3]) / 2
    px_km2 = (STEP * 111.32) * (STEP * 111.32 * np.cos(np.radians(lat_c)))
    return {
        "valid_km2": round(float(valid.sum() * px_km2), 2),
        "water_km2": round(float(estero.sum() * px_km2), 3),
        "ocean_km2": round(float(ocean.sum() * px_km2), 2),
        "floodveg_km2": round(float(floodveg.sum() * px_km2), 3),
        "floatveg_km2": round(float(floatveg.sum() * px_km2), 3),
        "thr": {"hh": round(float(t_hh), 2), "hv": round(float(t_hv), 2)},
        "calib": calib,
        "qc": True if calib is None else calib.get("qc", True),
        "hh_mean_db": round(float(np.nanmean(hh)), 2) if valid.any() else None,
        "hv_mean_db": round(float(np.nanmean(hv)), 2) if hv_ok.any() else None,
    }


# ---------- serie ----------
def load_series():
    p = os.path.join(OUT, "series.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return {"bbox": BBOX, "step": STEP, "hh_range": [HH_MIN, HH_MAX],
            "thresholds": {"water_hh": WATER_HH, "water_hv": WATER_HV, "floodveg_hh": FLOODVEG_HH},
            "dates": []}


def save_series(s):
    s["dates"].sort(key=lambda d: d["date"])
    with open(os.path.join(OUT, "series.json"), "w", encoding="utf-8") as fh:
        json.dump(s, fh, indent=1, ensure_ascii=False)


def reclassify(series):
    """Recalcula clases y areas desde las capas ya guardadas (sin volver a descargar)."""
    for d in series["dates"]:
        e = np.array(Image.open(os.path.join(OUT, f"{d['id']}_hh.png"))).astype(np.float32)
        hh = np.where(e > 0, HH_MIN + (e - 1) / 254 * (HH_MAX - HH_MIN), np.nan)
        rgb = np.array(Image.open(os.path.join(OUT, f"{d['id']}_rgb.png")).convert("RGBA")).astype(np.float32)
        hv = np.where(rgb[..., 3] > 0, -32 + rgb[..., 1] / 255 * 24, np.nan)
        d.update(classify(hh, hv, d["id"]))
        print(f"  {d['date']}: agua estero {d['water_km2']} km2 | mar {d['ocean_km2']} | veg. inundada {d['floodveg_km2']}")
    series["thresholds"] = {"water_hh": WATER_HH, "water_hv": WATER_HV, "floodveg_hh": FLOODVEG_HH}
    save_series(series)


def save_entry(HH, HV, meta, scenes, frames):
    ident = f"{meta['date']}_{meta['direction'][0]}{meta['track']}"
    stats = make_products(HH, HV, ident)
    entry = {"id": ident, "date": meta["date"], "direction": meta["direction"], "track": meta["track"],
             "frame": frames[0] if len(frames) == 1 else frames, "scene": scenes[0] if len(scenes) == 1 else scenes,
             "coverage_pct": round(100 * float(np.isfinite(HH).mean()), 1),
             "rgb": f"data/{ident}_rgb.png", "hh": f"data/{ident}_hh.png", "cls": f"data/{ident}_cls.png", **stats}
    series = load_series()  # releer: puede haber otros procesos escribiendo en paralelo
    series["dates"] = [d for d in series["dates"] if d["id"] != ident] + [entry]
    save_series(series)
    print(f"  {ident}: cobertura {entry['coverage_pct']}% (frames {frames}) | agua {stats['water_km2']} km2 | "
          f"veg. inundada {stats['floodveg_km2']} km2", flush=True)


def process(fobj, meta, series):
    print(f"  {meta['date']}: leyendo recorte...", flush=True)
    HH, HV = read_crop(fobj)
    save_entry(HH, HV, meta, [meta["scene"]], [meta["frame"]])


def merge(acc, new):
    """Rellena los pixeles sin dato de acc con los de new (union de frames vecinos)."""
    if acc is None:
        return new
    return tuple(np.where(np.isfinite(a), a, b) for a, b in zip(acc, new))


def meta_from_name(path):
    name = os.path.basename(path)
    m = re.search(r"GCOV_\d+_(\d+)_([AD])_(\d+)_.*?_(\d{8})T", name)
    if not m:
        return {"scene": name, "date": "0000-00-00", "direction": "ASCENDING", "track": 0, "frame": 0}
    t, d, f, ymd = m.groups()
    return {"scene": name.replace(".h5", ""), "date": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}",
            "direction": "ASCENDING" if d == "A" else "DESCENDING", "track": int(t), "frame": int(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=134)
    ap.add_argument("--frames", type=int, nargs="*", default=[9, 8], help="frames a unir por fecha (en orden de prioridad)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--local", nargs="*", help="archivos .h5 ya descargados")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("W", "S", "E", "N"), help="otra zona de estudio")
    ap.add_argument("--out", help="carpeta de salida (por defecto web/data)")
    ap.add_argument("--ocean-r", type=int, help="radio para separar mar; 0 = zona sin mar (embalse, lago)")
    ap.add_argument("--dates", nargs="*", help="solo estas fechas AAAA-MM-DD")
    ap.add_argument("--granules", default="data/granules.json", help="lista de granulos (search_granules.py --out)")
    ap.add_argument("--reclassify", action="store_true", help="recalcular clases desde las capas guardadas")
    ap.add_argument("--redo-partial", action="store_true", help="volver a procesar fechas con cobertura < 99%%")
    a = ap.parse_args()
    global BBOX, OUT, OCEAN_R
    if a.bbox:
        BBOX = tuple(a.bbox)
    if a.out:
        OUT = os.path.abspath(a.out)
    if a.ocean_r is not None:
        OCEAN_R = a.ocean_r

    os.makedirs(OUT, exist_ok=True)
    series = load_series()
    done = {d["date"] for d in series["dates"] if not (a.redo_partial and (d.get("coverage_pct") or 100) < 99)}
    if a.reclassify:
        reclassify(series)
        return

    if a.local:
        for p in a.local:
            process(p, meta_from_name(p), series)
        return

    with open(os.path.join(ROOT, a.granules), encoding="utf-8") as fh:
        grans = [g for g in json.load(fh) if g["track"] == a.track and g["frame"] in a.frames]
    if a.dates:
        grans = [g for g in grans if g["date"] in a.dates]
    by_date = {}
    for g in sorted(grans, key=lambda g: a.frames.index(g["frame"])):
        by_date.setdefault(g["date"], []).append(g)
    todo = [d for d in sorted(by_date) if a.force or d not in done]
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(todo)} fechas por procesar (track {a.track}, frames {a.frames})")
    if not todo:
        return

    import earthaccess
    # En Windows earthaccess busca ~/_netrc; leemos ~/.netrc nosotros y lo pasamos por entorno (solo en este proceso)
    import netrc as _netrc
    for name in (".netrc", "_netrc"):
        p = os.path.join(os.path.expanduser("~"), name)
        if os.path.exists(p):
            cred = _netrc.netrc(p).authenticators("urs.earthdata.nasa.gov")
            if cred:
                os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"] = cred[0], cred[2]
                break
    auth = earthaccess.login(strategy="environment")
    if not getattr(auth, "authenticated", False):
        sys.exit("No se pudo iniciar sesion en Earthdata (revisa usuario/contrasena en ~/.netrc)")
    print("Sesion Earthdata OK", flush=True)
    fs = earthaccess.get_fsspec_https_session()
    for date in todo:
        acc, scenes, frames = None, [], []
        for g in by_date[date]:
            if acc is not None and np.isfinite(acc[0]).mean() > 0.995:
                break  # ya esta completo, no hace falta el siguiente frame
            for attempt in range(3):  # la lectura remota a veces falla por la red: reintentar
                try:
                    print(f"  {date}: leyendo frame {g['frame']}..." + (f" (intento {attempt + 1})" if attempt else ""), flush=True)
                    with fs.open(g["url"], "rb", block_size=4 * 1024 * 1024, cache_type="blockcache") as fobj:
                        acc = merge(acc, read_crop(fobj))
                    scenes.append(g["scene"])
                    frames.append(g["frame"])
                    break
                except Exception as e:
                    msg = str(e) or type(e).__name__
                    if "no cae dentro" in msg:
                        print(f"    frame {g['frame']} no cubre la zona", flush=True)
                        break
                    print(f"    frame {g['frame']} fallo: {msg[:120]}", flush=True)
        if acc is None:
            print(f"    ERROR {date}: ningun frame cubre la zona", flush=True)
            continue
        save_entry(acc[0], acc[1], by_date[date][0], scenes, frames)


if __name__ == "__main__":
    main()
