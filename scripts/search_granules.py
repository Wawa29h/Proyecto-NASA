"""Busca en ASF todos los productos NISAR GCOV sobre Barra de Santiago.

No necesita login. Guarda la lista en data/granules.json.
Uso:  python scripts/search_granules.py
"""
import json
import os
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POINT = "POINT(-90.05 13.72)"  # Barra de Santiago, Ahuachapán, El Salvador
API = "https://api.daac.asf.alaska.edu/services/search/param"


def search(level: str):
    q = urllib.parse.urlencode({
        "dataset": "NISAR",
        "processingLevel": level,
        "intersectsWith": POINT,
        "output": "geojson",
        "maxResults": 1000,
    })
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": "nisar-space-apps"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["features"]


def main():
    out = []
    for f in search("GCOV"):
        p = f["properties"]
        out.append({
            "scene": p["sceneName"],
            "date": p["startTime"][:10],
            "start": p["startTime"],
            "direction": p["flightDirection"],
            "track": p["pathNumber"],
            "frame": p["frameNumber"],
            "url": p["url"],
            "browse": [b for b in p.get("browse") or [] if b.endswith("_LATLON.png")],
            "gb": round(sum(v["bytes"] for v in (p.get("bytes") or {}).values()) / 1e9, 2),
            "footprint": f["geometry"]["coordinates"],
        })
    out.sort(key=lambda g: g["start"])
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    path = os.path.join(ROOT, "data", "granules.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1)
    print(f"{len(out)} granulos GCOV -> {path}")
    for g in out:
        print(f"  {g['date']}  {g['direction'][:4]} track {g['track']} frame {g['frame']}  {g['gb']} GB")


if __name__ == "__main__":
    main()
