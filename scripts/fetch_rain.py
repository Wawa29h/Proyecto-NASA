"""Lluvia diaria promedio sobre la cuenca que alimenta el sitio.

Fuente principal: NASA GPM IMERG Late diario (GPM_3IMERGDL v07, 0.1 grados), leido en remoto (solo el recorte).
  Requiere que tu cuenta Earthdata tenga autorizada la app "NASA GESDISC DATA ARCHIVE".
Respaldo: NASA POWER (sin login), parametro PRECTOTCORR.

Uso:
  python scripts/fetch_rain.py --site barra
  python scripts/fetch_rain.py --site cerron
"""
import argparse
import datetime as dt
import json
import os
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {
    # cuenca aproximada que drena al sitio (W, S, E, N)
    "barra": {"out": "web/data", "basin": (-90.20, 13.65, -89.85, 13.95), "name": "rios Paz / Cara Sucia"},
    "cerron": {"out": "web/data-cerron", "basin": (-89.70, 13.90, -88.50, 14.70), "name": "alto Lempa (SV, GT, HN)"},
}
START, END = dt.date(2025, 11, 20), dt.date(2026, 11, 10)


def login():
    import earthaccess
    import netrc
    c = netrc.netrc(os.path.expanduser("~/.netrc")).authenticators("urs.earthdata.nasa.gov")
    os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"] = c[0], c[2]
    earthaccess.login(strategy="environment")
    return earthaccess


def imerg(basin):
    import h5py
    ea = login()
    grans = ea.search_data(short_name="GPM_3IMERGDL", temporal=(START.isoformat(), END.isoformat()))
    fs = ea.get_fsspec_https_session()
    W, S, E, N = basin
    i0, i1 = int((W + 180) / 0.1), int((E + 180) / 0.1) + 1
    j0, j1 = int((S + 90) / 0.1), int((N + 90) / 0.1) + 1
    daily = {}
    for k, g in enumerate(grans):
        url = g.data_links(access="external")[0]
        day = url.split("3IMERG.")[1][:8]
        with fs.open(url, "rb", block_size=1024 * 1024) as f, h5py.File(f, "r") as h:
            p = h["precipitation"][0, i0:i1, j0:j1].astype(float)  # (time, lon, lat), mm/dia
        p[p < 0] = np.nan
        daily[f"{day[:4]}-{day[4:6]}-{day[6:]}"] = round(float(np.nanmean(p)), 2)
        if k % 30 == 0:
            print(f"  IMERG {k + 1}/{len(grans)}", flush=True)
    return daily


def power(basin):
    W, S, E, N = basin
    lons = np.arange(W + 0.25, E, 0.5) if E - W > 0.5 else [(W + E) / 2]
    lats = np.arange(S + 0.25, N, 0.5) if N - S > 0.5 else [(S + N) / 2]
    acc = {}
    for lat in lats:
        for lon in lons:
            u = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG"
                 f"&longitude={lon:.3f}&latitude={lat:.3f}&start={START:%Y%m%d}&end={END:%Y%m%d}&format=JSON")
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "nisar-space-apps"}), timeout=120) as r:
                v = json.load(r)["properties"]["parameter"]["PRECTOTCORR"]
            for k, x in v.items():
                if x is not None and x >= 0:
                    acc.setdefault(f"{k[:4]}-{k[4:6]}-{k[6:]}", []).append(x)
    return {k: round(float(np.mean(v)), 2) for k, v in sorted(acc.items())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", choices=SITES, default="barra")
    ap.add_argument("--source", choices=["auto", "imerg", "power"], default="auto")
    a = ap.parse_args()
    s = SITES[a.site]
    daily, source = None, None
    if a.source in ("auto", "imerg"):
        try:
            daily, source = imerg(s["basin"]), "NASA GPM IMERG Late diario (v07)"
        except Exception as e:
            print("  IMERG no disponible:", str(e)[:160])
            if a.source == "imerg":
                raise
    if daily is None:
        daily, source = power(s["basin"]), "NASA POWER (PRECTOTCORR)"
    out = os.path.join(ROOT, s["out"], "rain.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"source": source, "basin": s["basin"], "basin_name": s["name"], "daily_mm": daily}, fh, indent=1, ensure_ascii=False)
    tot = sum(daily.values())
    print(f"{a.site}: {source} | {len(daily)} dias | total {tot:.0f} mm -> {out}")


if __name__ == "__main__":
    main()
