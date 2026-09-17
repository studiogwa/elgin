# Historic Property Research, City of Elgin

A Studio GWA research map of historic property incentives in Elgin — search any address in the River Edge Redevelopment Zone or one of the city's local historic districts and see, in one panel, which incentives it may qualify for, plus the parcel's zoning, land use, size, and tax record.

Built as a static site (Mapbox GL JS + GeoJSON), same pattern as the [Rockford Historic Industrial Property Survey Map](https://studiogwa.github.io/mpl-survey-map/).

Live at **https://studiogwa.github.io/elgin/**

See **DEPLOYMENT.md** to publish it, set a custom domain, and turn on Google Analytics.

## Running it locally

There is no build step, but the browser will not load the GeoJSON files off `file://`, so serve the folder:

```bash
cd elgin
python3 -m http.server 8000
# then open http://localhost:8000
```

## Fonts

Poppins and Lora from Google Fonts, standing in for the brand's Gilroy and Surveyor Text — same approach as the Rockford map, since the real typefaces are licensed for desktop use only. The real names are first in the font stacks, so a viewer with Gilroy installed locally sees it.

## Street View

The property panel embeds an interactive Street View pano, aimed at the building rather than down the street: the free Street View metadata endpoint gives the camera's coordinates, and the heading is the computed bearing from camera to parcel.

Both services used — the Maps Embed API and the Street View metadata endpoint — are free and unrestricted. The billable Street View *Static* API is not used. `CONFIG.GOOGLE_MAPS_KEY` is blank by default, in which case the panel degrades to a no-key "Open in Google Maps" link. See DEPLOYMENT.md § 3b.

## Data

All layers are reprojected to WGS84 (EPSG:4326) and simplified for web delivery. Built by `build_data.py` from the sources in `_source/`; re-run it to regenerate `data/` if the source data is refreshed.

| File | Features | What it is |
|---|---|---|
| `properties.geojson` | 2,438 | **One feature per parcel.** Every parcel in the River Edge Redevelopment Zone or a local historic district, with its incentive-status fields. The map's click and search target. |
| `centroids.geojson` | 2,438 | One point per parcel — the initial map fit and the "nearby properties" distances. |
| `rerz.geojson` | 1 | River Edge Redevelopment Zone boundary. |
| `hd.geojson` | 4 | Elgin local historic districts, with links to their designating ordinances. |
| `oz.geojson` | 3 | Qualified Opportunity Zone census tracts in Elgin. |

**Sources:** City of Elgin GIS (master address file, historic districts); Kane County GIS (parcels, treasurer records); Illinois DCEO (River Edge Redevelopment Zone); U.S. Treasury / CDFI Fund (Opportunity Zones).

### Parcel roll-up

The city's address file is **unit-level**: one condo or apartment building can carry hundreds of addresses on a single PIN. The two source point files hold 5,168 distinct addresses (2,524 in the RERZ, 3,235 in historic districts, 585 in both) sitting on **2,438 parcels**. One building on Times Square alone accounts for 218 addresses.

The build groups addresses by PIN and emits one polygon per parcel. This matters for more than tidiness: drawing a semi-transparent polygon once per address stacks the same geometry hundreds of times, and the compounded fills read as a shading gradient that looks like data but is really just unit count. Every address stays searchable — `also` holds the other street addresses on the parcel, `units` the count.

The 137 addresses whose PIN doesn't match a Kane County parcel get a 30-foot placeholder footprint around the address point so they stay findable.

### Property fields

| Field | Notes |
|---|---|
| `id` | Parcel PIN (or the city's address record ID for unmatched addresses); the `?p=` share-link key |
| `address` | The most common base street address on the parcel, unit designations stripped |
| `also` | Other base addresses on the same parcel, up to five |
| `units` | How many addresses the parcel carries |
| `rerz` | `Y` if any address on the parcel is in the River Edge Redevelopment Zone (1,015 parcels) |
| `hd`, `hd_name` | Local historic district, from point-in-polygon against the district layer, falling back to the city's own field — which catches the Bungalow Thematic district, a designation with no polygon in the districts layer (1,672 parcels) |
| `oz`, `oz_tract` | Qualified Opportunity Zone, by point-in-polygon (501 parcels) |
| `ssa` | Special Service Area, where applicable |
| `zoning`, `land_use`, `acres` | Parcel attributes; `acres` falls back to computed polygon area where the recorded acreage is blank |
| `tif_district` | TIF district from the city's address file — Central covers 1,273 parcels, Route 20 one |
| `treasurer` | Link to the Kane County tax record |
| `has_parcel` | `N` for the placeholder footprints described above |

249 parcels are in both the RERZ and a historic district.

## A note on what the map claims

The incentive-stack text is deliberately written as "may be eligible." Zone boundaries determine *location* eligibility only — actual eligibility for the River Edge Historic Tax Credit, the federal rehabilitation credit, or Opportunity Zone treatment depends on the scope of work, the structure's certification status, and program rules. The footnote in the panel says as much. Verify with the City of Elgin and a tax advisor before anything goes in a proposal.
