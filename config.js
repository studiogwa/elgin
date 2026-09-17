// ============================================================
// River Edge Redevelopment Zone Research, City of Elgin — config
// Studio GWA
// ============================================================

const CONFIG = {
  // Mapbox public access token (pk...). Free tier: 50,000 map loads/month.
  // Same token as the Rockford survey map — see DEPLOYMENT.md § Mapbox for
  // the URL-restriction step to run once this is live.
  MAPBOX_TOKEN: "pk.eyJ1IjoibWljaGFlbC1zbWl0aCIsImEiOiJjbXJ5NTExMWkwNWlrMzFwcWtvdTRqZHVkIn0.ICZG_Gxqk4tqm9VByqLyZg",

  // "Light" keeps the basemap muted so the zone overlays stay legible.
  MAPBOX_STYLE: "mapbox://styles/mapbox/light-v11",

  // Initial view — centered on the Elgin River Edge Redevelopment Zone
  INITIAL_CENTER: [-88.28003, 42.04324],
  INITIAL_ZOOM: 13.2,

  // Data files (all reprojected to WGS84 / EPSG:4326)
  DATA: {
    properties: "data/properties.geojson",  // RERZ addresses joined to parcels
    centroids: "data/centroids.geojson",    // RERZ address points
    parcels: "data/parcels.geojson",        // surrounding context parcels
    rerz: "data/rerz.geojson",
    oz: "data/oz.geojson",
    hd: "data/hd.geojson",
  },

  // Base URL used to build shareable per-property links (?p=id)
  SHARE_BASE_URL: window.location.origin + window.location.pathname,
};
