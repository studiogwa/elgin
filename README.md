# River Edge Redevelopment Zone Research, City of Elgin

A Studio GWA research map of the City of Elgin's River Edge Redevelopment Zone (RERZ) — search any address in the zone and see, in one panel, whether it also sits in a federal Opportunity Zone, a local historic district, or a TIF district, plus the parcel's zoning, land use, size, and tax record.

Built as a static site (Mapbox GL JS + GeoJSON), same pattern as the [Rockford Historic Industrial Property Survey Map](https://studiogwa.github.io/mpl-survey-map/).

See **DEPLOYMENT.md** to publish it, set a custom domain, and turn on Google Analytics.

Live at **https://studiogwa.github.io/elgin/**

## Running it locally

There is no build step, but the browser will not load the GeoJSON files off `file://`, so serve the folder:

```bash
cd elgin
python3 -m http.server 8000
# then open http://localhost:8000
```

## Fonts

Poppins and Lora from Google Fonts, standing in for the brand's Gilroy and Surveyor Text — same approach as the Rockford map, since the real typefaces are licensed for desktop use only. The real names are first in the font stacks, so a viewer with Gilroy installed locally sees it.

## Data

All layers are reprojected to WGS84 (EPSG:4326) and simplified for web delivery. Built from the source GeoPackages in `_source/` by `build_data.py`; re-run it to regenerate `data/` if the source data is refreshed.

| File | Features | What it is |
|---|---|---|
| `properties.geojson` | 2,524 | Every address in the RERZ, joined to its Kane County parcel polygon by PIN, carrying all the incentive-status fields. The primary click and search target. |
| `centroids.geojson` | 2,524 | The address points themselves — used for the initial map fit and the "nearby properties" distances. |
| `parcels.geojson` | 6,622 | Surrounding parcels that intersect the RERZ, an Opportunity Zone, or a historic district. Context only, off by default. |
| `rerz.geojson` | 1 | River Edge Redevelopment Zone boundary. |
| `oz.geojson` | 3 | Qualified Opportunity Zone census tracts in Elgin. |
| `hd.geojson` | 4 | Elgin local historic districts, with links to their designating ordinances. |

**Sources:** City of Elgin GIS (master address file, historic districts); Kane County GIS (parcels, treasurer records); Illinois DCEO (River Edge Redevelopment Zone); U.S. Treasury / CDFI Fund (Opportunity Zones).

### Property fields

| Field | Notes |
|---|---|
| `id` | City of Elgin address record ID; also the `?p=` share-link key |
| `address`, `zip` | From the Elgin master address file |
| `pin` | Kane County parcel number; 2,405 of 2,524 addresses matched a parcel polygon |
| `rerz` | Always `Y` — every record in this dataset is in the zone |
| `oz`, `oz_tract` | Computed by point-in-polygon against the OZ tracts (165 properties) |
| `hd`, `hd_name` | Computed against the historic district polygons, falling back to the city's own field (585 properties) |
| `tif`, `tif_district` | From the city's address file — Central TIF for most of the zone |
| `ssa` | Special Service Area, where applicable |
| `zoning`, `land_use`, `subdivision`, `acres` | Parcel attributes; `acres` falls back to computed polygon area where the recorded acreage is blank |
| `treasurer` | Link to the Kane County tax record |
| `has_parcel` | `N` for the 119 addresses with no PIN match — those get a 30-foot placeholder footprint around the address point, so they're still searchable and clickable |

## A note on what the map claims

The incentive-stack text is deliberately written as "may be eligible." Zone boundaries determine *location* eligibility only — actual eligibility for the River Edge Historic Tax Credit, a TIF agreement, or Opportunity Zone treatment depends on the scope of work, the structure's certification status, and program rules. The footnote in the panel says as much. Verify with the City of Elgin and a tax advisor before anything goes in a proposal.
