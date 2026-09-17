#!/usr/bin/env python3
"""
Elgin River Edge Redevelopment Zone Research — data build
Converts the five source GeoPackages into web-ready GeoJSON for the
static map site.

  properties.geojson  RERZ address points joined to their parcel polygon
  centroids.geojson   the RERZ address points (search index + map fit)
  parcels.geojson     context parcels clipped to RERZ + OZ + historic districts
  rerz.geojson        River Edge Redevelopment Zone boundary
  oz.geojson          Opportunity Zone census tracts
  hd.geojson          Elgin local historic districts
"""
import json, os, re
import geopandas as gpd
import pandas as pd
from shapely.ops import unary_union

SRC = "/mnt/user-data/uploads/Elgin Historic Website/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "elgin-rerz-map", "data")
os.makedirs(OUT, exist_ok=True)

IL_FT = "EPSG:3435"   # NAD83 / Illinois East (ftUS) — source CRS, good for metric ops
WGS = "EPSG:4326"


def clean(v):
    """Normalise the many placeholder spellings in the City of Elgin data."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if s in ("", "NONE", "NA", "N/A", "None", "nan", "0"):
        return None
    return s


KEEP_UPPER = {"US", "IL", "SSA", "TIF", "RERZ", "DC", "CBD", "LLC", "II", "III",
              "IV", "NE", "NW", "SE", "SW", "N", "S", "E", "W", "JR", "SR"}
SMALL = {"of", "the", "and", "at", "in", "on", "de", "la"}


def titleish(v):
    """ALL CAPS source values -> Title Case, keeping obvious acronyms.

    Handles the two shapes the Elgin/Kane data uses:
      "CC1-CENTER CITY 1"  -> "CC1 — Center City 1"   (leading zoning code)
      "DC COOK-LOVELL"     -> "DC Cook-Lovell"        (hyphenated names)
    """
    s = clean(v)
    if s is None:
        return None

    prefix = ""
    m = re.match(r"^([A-Z]{1,3}\d{0,2})-(?=[A-Z])", s)
    if m:                       # leading code like CC1- / RC3- / MFR-
        prefix = m.group(1) + " — "
        s = s[m.end():]

    def cap_word(w, first):
        core = w.strip("().,/")
        if not core:
            return w
        if core.upper() in KEEP_UPPER:
            return w.upper()
        if any(ch.isdigit() for ch in core) and core.isupper():
            return w.upper()    # e.g. "U-46", "CC2"
        if not first and core.lower() in SMALL:
            return w.lower()
        return w.capitalize()

    out = []
    for i, word in enumerate(s.split()):
        # capitalize each hyphen-separated part: COOK-LOVELL -> Cook-Lovell
        parts = word.split("-")
        out.append("-".join(cap_word(p, i == 0 and j == 0)
                            for j, p in enumerate(parts)))
    return prefix + " ".join(out)


def acres_of(prow):
    """Recorded acreage, falling back to the parcel's own geometry.

    RecordedAc is blank or 0 on a fair number of Kane County parcels, so
    compute from the polygon area (source CRS is in survey feet) when the
    recorded figure is missing.
    """
    if prow is None:
        return None
    raw = clean(prow.get("RecordedAc"))
    try:
        if raw and float(raw) > 0:
            return f"{float(raw):.2f}"
    except ValueError:
        pass
    try:
        a = prow.geometry.area / 43560.0   # sq ft -> acres
        return f"{a:.2f}" if a > 0.004 else None
    except Exception:
        return None


def round_geom(gdf, nd=6):
    """Round coordinates to ~0.1 m to keep the GeoJSON small."""
    return gdf.set_geometry(gdf.geometry.apply(
        lambda g: json_round(g, nd)))


def json_round(geom, nd):
    from shapely.geometry import shape
    return shape(json.loads(json.dumps(geom.__geo_interface__, default=lambda o: round(float(o), nd))))


def write(gdf, name, nd=6):
    path = os.path.join(OUT, name)
    g = gdf.to_crs(WGS)
    gj = json.loads(g.to_json(drop_id=True))
    # round coordinates
    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [rnd(x) for x in c]
    for f in gj["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
        f["properties"] = {k: v for k, v in f["properties"].items()
                           if v is not None and v == v and v != ""}
    with open(path, "w") as fh:
        json.dump(gj, fh, separators=(",", ":"))
    print(f"  {name:24s} {len(gj['features']):6,d} features  {os.path.getsize(path)/1024:8.1f} KB")
    return gj


print("Reading sources…")
pts = gpd.read_file(SRC + "Properties in RERZ.gpkg").to_crs(IL_FT)
par = gpd.read_file(SRC + "Elgin Parcels.gpkg").to_crs(IL_FT)
rerz = gpd.read_file(SRC + "River Edge Redevelopment Zone - Elgin.gpkg").to_crs(IL_FT)
oz = gpd.read_file(SRC + "Opportunity Zones in Elgin.gpkg").to_crs(IL_FT)
hd = gpd.read_file(SRC + "Elgin Historic Districts .gpkg").to_crs(IL_FT)
print(f"  points {len(pts):,} | parcels {len(par):,} | rerz {len(rerz)} | oz {len(oz)} | hd {len(hd)}")

# ---------------------------------------------------------------- boundaries
rerz["name"] = "River Edge Redevelopment Zone — Elgin"
rerz_out = rerz[["name", "geometry"]].copy()
rerz_out["geometry"] = rerz_out.geometry.simplify(3)

oz["name"] = "Census Tract " + oz["TRACT"].astype(str).str.lstrip("0")
oz["geoid"] = oz["GEOID10"]
oz_out = oz[["name", "geoid", "geometry"]].copy()
oz_out["geometry"] = oz_out.geometry.simplify(3)

hd["name"] = hd["NAME"].apply(titleish)
hd["ordinance"] = hd["ORD_NUMBER"].apply(clean)
hd["ord_link"] = hd["ORD_LINK"].apply(clean)
hd_out = hd[["name", "ordinance", "ord_link", "geometry"]].copy()
hd_out["geometry"] = hd_out.geometry.simplify(3)

# ------------------------------------------------- spatial flags for points
rerz_u = unary_union(rerz.geometry)
oz_u = unary_union(oz.geometry)
hd_union = unary_union(hd.geometry)
study_area = unary_union([rerz_u, oz_u, hd_union])

pts["oz_flag"] = pts.geometry.within(oz_u).map({True: "Y", False: "N"})
# name of the OZ tract a point falls in
oz_join = gpd.sjoin(pts[["geometry"]], oz[["name", "geometry"]], how="left", predicate="within")
pts["oz_tract"] = oz_join["name"].reindex(pts.index)
hd_join = gpd.sjoin(pts[["geometry"]], hd[["name", "geometry"]].rename(columns={"name": "hd_name"}),
                    how="left", predicate="within")
pts["hd_spatial"] = hd_join["hd_name"].reindex(pts.index)

print(f"  points in an Opportunity Zone: {(pts.oz_flag == 'Y').sum():,}")
print(f"  points in a historic district: {pts.hd_spatial.notna().sum():,}")

# ------------------------------------------------------- property attributes
par_idx = par.drop_duplicates(subset="PIN").set_index("PIN")

records = []
for i, r in pts.iterrows():
    pin = clean(r["Parcel_Number"])
    prow = par_idx.loc[pin] if (pin and pin in par_idx.index) else None
    geom = prow.geometry if prow is not None else r.geometry.buffer(30)
    hd_name = titleish(r["hd_spatial"]) or titleish(r["Historic_District"])
    records.append({
        "id": clean(r["SF_ID"]) or f"pt{i}",
        "address": titleish(r["FULL_ADR"]),
        "zip": clean(r["ZipCode"]),
        "pin": pin,
        "rerz": "Y",
        "oz": r["oz_flag"],
        "oz_tract": clean(r["oz_tract"]),
        "hd": "Y" if hd_name else "N",
        "hd_name": hd_name,
        "tif": "Y" if clean(r["TIF_District"]) else "N",
        "tif_district": titleish(r["TIF_District"]),
        "ssa": titleish(r["SSA_District"]),
        "zoning": titleish(r["Zoning"]),
        "land_use": titleish(r["Current_Land_Use"]),
        "subdivision": titleish(r["Subdivision"]),
        "township": titleish(r["Township"]),
        "county": titleish(r["COUNTY"]),
        "acres": acres_of(prow),
        "treasurer": (clean(prow.get("Kane_Treasurer_Link")) if prow is not None else None),
        "tract": (clean(r["Census_Tract"]) or "").removesuffix(".0") or None,
        "has_parcel": "Y" if prow is not None else "N",
        "geometry": geom,
    })

props = gpd.GeoDataFrame(records, geometry="geometry", crs=IL_FT)
props = props[~props.geometry.is_empty & props.geometry.notna()]
props["geometry"] = props.geometry.simplify(2)
print(f"  properties built: {len(props):,} "
      f"({(props.has_parcel == 'Y').sum():,} with a real parcel polygon)")

# centroid / point index (used for search fit + 'nearby')
cent = props.copy()
cent["geometry"] = pts.set_index(props.index.map(lambda i: i)).geometry.values \
    if len(pts) == len(props) else props.geometry.representative_point()
cent = cent[["id", "address", "hd_name", "oz", "geometry"]]

# ------------------------------------------------------------ context parcels
ctx = par[par.geometry.intersects(study_area)].copy()
ctx = ctx[~ctx["PIN"].isin(set(props["pin"].dropna()))]
ctx["geometry"] = ctx.geometry.simplify(4)
ctx_out = ctx[["PIN", "geometry"]].rename(columns={"PIN": "pin"})
print(f"  context parcels in study area: {len(ctx_out):,}")

print("\nWriting GeoJSON…")
write(rerz_out, "rerz.geojson")
write(oz_out, "oz.geojson")
write(hd_out, "hd.geojson")
write(props, "properties.geojson")
write(cent, "centroids.geojson")
write(ctx_out, "parcels.geojson")

b = props.to_crs(WGS).total_bounds
print(f"\nBounds (WGS84): {[round(x, 5) for x in b]}")
print(f"Center: {[round((b[0]+b[2])/2, 5), round((b[1]+b[3])/2, 5)]}")
