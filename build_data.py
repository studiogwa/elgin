#!/usr/bin/env python3
"""
Historic Property Research, City of Elgin — data build

Turns the City of Elgin / Kane County source layers into web-ready GeoJSON.

Inputs (in _source/, or the folder above it):
  Properties in RERZ.gpkg                    address points inside the RERZ
  Properties in Historic Districts .geojson  address points inside a local
                                             historic district
  Elgin Parcels.gpkg                         Kane County parcel polygons
  River Edge Redevelopment Zone - Elgin.gpkg
  Opportunity Zones in Elgin.gpkg
  Elgin Historic Districts .gpkg

Outputs (data/):
  properties.geojson  ONE FEATURE PER PARCEL — the map's click/search target
  centroids.geojson   one point per parcel (map fit + "nearby" distances)
  rerz.geojson / oz.geojson / hd.geojson   boundary layers

Why parcel-level: the city's address file is unit-level, so a condo or
apartment building appears once per unit — one building on Times Square
carries 219 addresses. Drawing a polygon per address stacks the same
geometry hundreds of times, and semi-transparent fills compound into a
solid blob that looks like a data gradient but is really just unit count.
Rolling up to the parcel fixes the rendering and the click target; the
addresses are kept on the feature so search still finds every one of them.
"""
import json, os, re, glob
import geopandas as gpd
import pandas as pd
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")
os.makedirs(OUT, exist_ok=True)

IL_FT = "EPSG:3435"   # NAD83 / Illinois East (ftUS) — source CRS, feet
WGS = "EPSG:4326"


def find(name):
    """Source files live in _source/ once the repo is set up, but sit in the
    parent folder on a fresh checkout of the working directory."""
    for base in (os.path.join(HERE, "_source"), HERE, os.path.dirname(HERE)):
        hits = glob.glob(os.path.join(base, name))
        if hits:
            return hits[0]
    raise FileNotFoundError(name)


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

      "CC1-CENTER CITY 1"  -> "CC1 — Center City 1"   (leading zoning code)
      "DC COOK-LOVELL"     -> "DC Cook-Lovell"        (hyphenated names)
    """
    s = clean(v)
    if s is None:
        return None

    prefix = ""
    m = re.match(r"^([A-Z]{1,3}\d{0,2})-(?=[A-Z])", s)
    if m:
        prefix = m.group(1) + " — "
        s = s[m.end():]

    def cap_word(w, first):
        core = w.strip("().,/")
        if not core:
            return w
        if core.upper() in KEEP_UPPER:
            return w.upper()
        if any(ch.isdigit() for ch in core) and core.isupper():
            return w.upper()
        if not first and core.lower() in SMALL:
            return w.lower()
        return w.capitalize()

    out = []
    for i, word in enumerate(s.split()):
        parts = word.split("-")
        out.append("-".join(cap_word(p, i == 0 and j == 0)
                            for j, p in enumerate(parts)))
    return prefix + " ".join(out)


UNIT_RE = re.compile(r"\s+(?:UNIT|APT|STE|SUITE|#)\s*[-#]?\s*[\w-]+\s*$", re.I)


def base_address(full):
    """'4 TIMES SQ UNIT 313' -> '4 Times Sq'. Unit-level addresses are what
    make one parcel appear hundreds of times."""
    s = clean(full)
    if s is None:
        return None
    return titleish(UNIT_RE.sub("", s).strip())


def acres_of(prow):
    """Recorded acreage, falling back to the parcel polygon's own area.
    RecordedAc is blank or 0 on a fair number of Kane County parcels."""
    if prow is None:
        return None
    raw = clean(prow.get("RecordedAc"))
    try:
        if raw and float(raw) > 0:
            return f"{float(raw):.2f}"
    except ValueError:
        pass
    try:
        a = prow.geometry.area / 43560.0
        return f"{a:.2f}" if a > 0.004 else None
    except Exception:
        return None


def write(gdf, name, nd=6):
    path = os.path.join(OUT, name)
    g = gdf.to_crs(WGS)
    gj = json.loads(g.to_json(drop_id=True))

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
    print(f"  {name:22s} {len(gj['features']):6,d} features  {os.path.getsize(path)/1024:8.1f} KB")


# ------------------------------------------------------------------ sources
print("Reading sources…")
rerz_pts = gpd.read_file(find("Properties in RERZ.gpkg")).to_crs(IL_FT)
hd_pts = gpd.read_file(find("Properties in Historic Districts*.geojson")).to_crs(IL_FT)
par = gpd.read_file(find("Elgin Parcels.gpkg")).to_crs(IL_FT)
rerz = gpd.read_file(find("River Edge Redevelopment Zone*.gpkg")).to_crs(IL_FT)
oz = gpd.read_file(find("Opportunity Zones in Elgin.gpkg")).to_crs(IL_FT)
hd = gpd.read_file(find("Elgin Historic Districts*.gpkg")).to_crs(IL_FT)
print(f"  RERZ addresses {len(rerz_pts):,} | historic district addresses {len(hd_pts):,} "
      f"| parcels {len(par):,}")

# Union the two address sets on the city's own record id. 585 addresses are
# in both — they keep both flags rather than appearing twice.
rerz_pts["_rerz"] = True
hd_pts["_hd"] = True
pts = pd.concat([rerz_pts, hd_pts], ignore_index=True)
pts["_rerz"] = pts["_rerz"].fillna(False)
pts["_hd"] = pts["_hd"].fillna(False)
agg = pts.groupby("SF_ID", as_index=False).agg({"_rerz": "max", "_hd": "max"})
pts = (pts.drop_duplicates(subset="SF_ID", keep="first")
          .drop(columns=["_rerz", "_hd"])
          .merge(agg, on="SF_ID", how="left"))
pts = gpd.GeoDataFrame(pts, geometry="geometry", crs=IL_FT)
print(f"  distinct addresses after union: {len(pts):,} "
      f"(in both: {int((pts._rerz & pts._hd).sum()):,})")

# -------------------------------------------------------------- boundaries
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

# ------------------------------------------------- spatial flags per address
oz_u = unary_union(oz.geometry)
pts["oz_flag"] = pts.geometry.within(oz_u)
oz_join = gpd.sjoin(pts[["geometry"]], oz[["name", "geometry"]],
                    how="left", predicate="within")
pts["oz_tract"] = oz_join["name"].reindex(pts.index)
hd_join = gpd.sjoin(pts[["geometry"]],
                    hd[["name", "geometry"]].rename(columns={"name": "hd_name"}),
                    how="left", predicate="within")
pts["hd_spatial"] = hd_join["hd_name"].reindex(pts.index)
print(f"  in an Opportunity Zone: {int(pts.oz_flag.sum()):,}")

# ------------------------------------------------ roll addresses up to parcels
par_idx = par.drop_duplicates(subset="PIN").set_index("PIN")

groups = {}
for i, r in pts.iterrows():
    pin = clean(r["Parcel_Number"])
    key = pin if (pin and pin in par_idx.index) else f"addr:{clean(r['SF_ID']) or i}"
    groups.setdefault(key, []).append(r)

records = []
for key, rows in groups.items():
    pin = key if not key.startswith("addr:") else None
    prow = par_idx.loc[pin] if pin else None
    first = rows[0]
    geom = prow.geometry if prow is not None else first.geometry.buffer(30)

    # base addresses on this parcel, most common first
    bases = [base_address(r["FULL_ADR"]) for r in rows]
    bases = [b for b in bases if b]
    ranked = sorted(set(bases), key=lambda b: (-bases.count(b), b))
    primary = ranked[0] if ranked else "Address unavailable"
    also = ", ".join(ranked[1:6]) if len(ranked) > 1 else None

    # a parcel is in a zone if any of its addresses is
    in_rerz = any(bool(r["_rerz"]) for r in rows)
    in_hd_attr = any(clean(r["Historic_District"]) for r in rows)
    hd_name = None
    for r in rows:
        hd_name = titleish(r["hd_spatial"]) or titleish(r["Historic_District"])
        if hd_name:
            break
    in_oz = any(bool(r["oz_flag"]) for r in rows)
    oz_tract = next((clean(r["oz_tract"]) for r in rows if clean(r["oz_tract"])), None)

    records.append({
        "id": pin or clean(first["SF_ID"]) or key,
        "address": primary,
        "also": also,
        "units": len(rows),
        "zip": clean(first["ZipCode"]),
        "pin": pin,
        "rerz": "Y" if in_rerz else "N",
        "oz": "Y" if in_oz else "N",
        "oz_tract": oz_tract,
        "hd": "Y" if (hd_name or in_hd_attr) else "N",
        "hd_name": hd_name,
        "tif_district": next((titleish(r["TIF_District"]) for r in rows
                              if clean(r["TIF_District"])), None),
        "ssa": titleish(first["SSA_District"]),
        "zoning": titleish(first["Zoning"]),
        "land_use": titleish(first["Current_Land_Use"]),
        "township": titleish(first["Township"]),
        "county": titleish(first["COUNTY"]),
        "acres": acres_of(prow),
        "treasurer": clean(prow.get("Kane_Treasurer_Link")) if prow is not None else None,
        "tract": (clean(first["Census_Tract"]) or "").removesuffix(".0") or None,
        "has_parcel": "Y" if prow is not None else "N",
        "geometry": geom,
        "_pt": first.geometry,
    })

props = gpd.GeoDataFrame(records, geometry="geometry", crs=IL_FT)
props = props[~props.geometry.is_empty & props.geometry.notna()].reset_index(drop=True)

cent = gpd.GeoDataFrame(
    props[["id", "address", "hd_name", "rerz", "hd", "oz"]].copy(),
    geometry=gpd.GeoSeries(props["_pt"].values, crs=IL_FT))
props = props.drop(columns=["_pt"])
props["geometry"] = props.geometry.simplify(2)

print(f"  parcels: {len(props):,} "
      f"(RERZ {int((props.rerz=='Y').sum()):,} | historic {int((props.hd=='Y').sum()):,} "
      f"| both {int(((props.rerz=='Y') & (props.hd=='Y')).sum()):,} "
      f"| OZ {int((props.oz=='Y').sum()):,})")
print(f"  largest parcel by address count: {int(props.units.max()):,} addresses")
print(f"  addresses with no parcel match: {int((props.has_parcel=='N').sum()):,}")

print("\nWriting GeoJSON…")
write(rerz_out, "rerz.geojson")
write(oz_out, "oz.geojson")
write(hd_out, "hd.geojson")
write(props, "properties.geojson")
write(cent, "centroids.geojson")

b = props.to_crs(WGS).total_bounds
print(f"\nBounds (WGS84): {[round(x, 5) for x in b]}")
print(f"Center: {[round((b[0]+b[2])/2, 5), round((b[1]+b[3])/2, 5)]}")
