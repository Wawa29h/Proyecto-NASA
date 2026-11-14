"""Nivel del agua (WSE) del embalse con NASA/CNES SWOT.

1) Busca el identificador del lago en la base de lagos de SWOT (PLD) revisando los archivos
   LakeSP_Prior de un ciclo (cada archivo = una pasada; solo se guarda el resultado).
2) Pide la serie de tiempo de ese lago al servicio Hydrocron de PO.DAAC (sin descargas grandes).

Uso: python scripts/fetch_swot.py --site cerron
"""
import argparse
import glob
import json
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = {"cerron": {"out": "web/data-cerron", "bbox": (-89.27, 13.93, -88.93, 14.13), "point": (-89.05, 14.03)}}
HYDROCRON = "https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries"
FIELDS = "lake_id,time_str,wse,wse_u,area_total,quality_f,partial_f,dark_frac,xtrk_dist"


def login():
    import earthaccess
    import netrc
    c = netrc.netrc(os.path.expanduser("~/.netrc")).authenticators("urs.earthdata.nasa.gov")
    os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"] = c[0], c[2]
    earthaccess.login(strategy="environment")
    return earthaccess


def find_lakes(site, cache):
    if os.path.exists(cache):
        return json.load(open(cache))
    import shapefile
    ea = login()
    W, S, E, N = site["bbox"]
    grans = ea.search_data(short_name="SWOT_L2_HR_LakeSP_D", bounding_box=(W, S, E, N),
                           temporal=("2026-06-01", "2026-06-22"))
    pri = sorted([g for g in grans if "Prior" in g.data_links()[0] and "_02.zip" not in g.data_links()[0]],
                 key=lambda g: g.size)
    tmp = tempfile.mkdtemp(prefix="swot_")
    found = {}
    try:
        for g in pri:
            name = g.data_links()[0].split("/")[-1]
            f = ea.download([g], tmp)[0]
            x = os.path.join(tmp, "x")
            zipfile.ZipFile(f).extractall(x)
            os.remove(f)
            for shp in glob.glob(os.path.join(x, "**", "*.shp"), recursive=True):
                sf = shapefile.Reader(shp)
                flds = [fl[0] for fl in sf.fields[1:]]
                for sr in sf.iterShapeRecords():
                    s = sr.shape
                    if s.shapeType == 0 or not s.points:
                        continue
                    b = s.bbox
                    if b[0] < E and b[2] > W and b[1] < N and b[3] > S:
                        rec = dict(zip(flds, sr.record))
                        area = (b[2] - b[0]) * (b[3] - b[1])
                        lid = str(rec["lake_id"]).split(";")[0]
                        if lid and lid != "no_data":
                            found.setdefault(lid, {"bbox": [round(v, 4) for v in b], "bbox_area": area, "passes": []})
                            found[lid]["passes"].append(name.split("_")[6])
                sf.close()
            shutil.rmtree(x, ignore_errors=True)
            print(f"  {name}: lagos en la zona hasta ahora {len(found)}", flush=True)
            if any(v["bbox_area"] > 0.005 for v in found.values()):
                break  # ya encontramos el embalse grande
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    lakes = sorted(found.items(), key=lambda kv: -kv[1]["bbox_area"])
    json.dump(lakes, open(cache, "w"), indent=1)
    return lakes


def hydrocron(lake_id):
    q = urllib.parse.urlencode({"feature": "PriorLake", "feature_id": lake_id, "start_time": "2025-11-01T00:00:00Z",
                                "end_time": "2026-11-15T00:00:00Z", "output": "geojson", "fields": FIELDS})
    with urllib.request.urlopen(urllib.request.Request(f"{HYDROCRON}?{q}", headers={"User-Agent": "nisar-space-apps"}), timeout=120) as r:
        j = json.load(r)
    feats = j.get("results", {}).get("geojson", {}).get("features", [])
    out = []
    for f in feats:
        p = f["properties"]
        try:
            wse = float(p["wse"])
        except (TypeError, ValueError):
            continue
        if wse < -1000:
            continue
        out.append({"time": p["time_str"], "date": p["time_str"][:10], "wse_m": round(wse, 3),
                    "wse_u": float(p.get("wse_u") or 0), "area_km2": round(float(p.get("area_total") or 0), 2),
                    "quality": int(float(p.get("quality_f") or 0)), "partial": int(float(p.get("partial_f") or 0))})
    return sorted(out, key=lambda d: d["time"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", choices=SITES, default="cerron")
    a = ap.parse_args()
    site = SITES[a.site]
    out_dir = os.path.join(ROOT, site["out"])
    lakes = find_lakes(site, os.path.join(out_dir, "swot_lakes.json"))
    if not lakes:
        sys.exit("No encontre el lago en las pasadas SWOT revisadas")
    lid, info = lakes[0]
    print("Lago SWOT (PLD):", lid, info)
    series = hydrocron(lid)
    good = [s for s in series if s["quality"] <= 1]
    json.dump({"source": "NASA/CNES SWOT L2 HR LakeSP via PO.DAAC Hydrocron", "lake_id": lid,
               "observations": series}, open(os.path.join(out_dir, "swot.json"), "w"), indent=1)
    print(f"{len(series)} observaciones ({len(good)} con buena calidad)")
    for s in good[-8:]:
        print("  ", s["date"], s["wse_m"], "m", s["area_km2"], "km2")


if __name__ == "__main__":
    main()
