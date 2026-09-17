// ============================================================
// Historic Property Research, City of Elgin — config
// Studio GWA
// ============================================================

// Bump this on every deploy. It is appended to each data/asset URL as ?v=…
// so browsers can never serve a stale mix of old data with new code — the
// failure mode where the map looks fine but silently shows last week's
// parcels. Any new string works; the date is just readable.
const BUILD = "2026-09-17d";

const CONFIG = {
  // Mapbox public access token (pk...). Free tier: 50,000 map loads/month.
  // Same token as the Rockford survey map — see DEPLOYMENT.md § Mapbox for
  // the URL-restriction step to run once this is live.
  MAPBOX_TOKEN: "pk.eyJ1IjoibWljaGFlbC1zbWl0aCIsImEiOiJjbXJ5NTExMWkwNWlrMzFwcWtvdTRqZHVkIn0.ICZG_Gxqk4tqm9VByqLyZg",

  // "Light" keeps the basemap muted so the zone overlays stay legible.
  MAPBOX_STYLE: "mapbox://styles/mapbox/light-v11",

  // Initial view — centered on the Elgin study area
  INITIAL_CENTER: [-88.28003, 42.04324],
  INITIAL_ZOOM: 13.2,

  // Data files (all reprojected to WGS84 / EPSG:4326)
  DATA: {
    properties: `data/properties.geojson?v=${BUILD}`,  // researched parcels
    centroids: `data/centroids.geojson?v=${BUILD}`,    // one point per parcel
    rerz: `data/rerz.geojson?v=${BUILD}`,
    oz: `data/oz.geojson?v=${BUILD}`,
    hd: `data/hd.geojson?v=${BUILD}`,
  },

  BUILD,

  // Base URL used to build shareable per-property links (?p=id)
  SHARE_BASE_URL: window.location.origin + window.location.pathname,
};
