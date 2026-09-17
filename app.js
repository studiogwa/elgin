// ============================================================
// Historic Property Research, City of Elgin
// Studio GWA — app.js
// ============================================================

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let map;
let propsData = null;         // RERZ property polygons FeatureCollection
let centroidsData = null;     // RERZ address points FeatureCollection
let propsById = {};           // id -> feature (polygon)
let centroidById = {};        // id -> centroid feature
let selectedId = null;
let hoveredFeatureId = null;

const els = {
  splash: document.getElementById('splash'),
  splashProgress: document.getElementById('splash-progress'),
  splashStatus: document.getElementById('splash-status'),
  searchInput: document.getElementById('search-input'),
  searchBox: document.querySelector('.search-box'),
  searchClear: document.getElementById('search-clear'),
  searchResults: document.getElementById('search-results'),
  emptyState: document.getElementById('empty-state'),
  snapshot: document.getElementById('snapshot'),
  snapshotBack: document.getElementById('snapshot-back'),
  snapAddress: document.getElementById('snap-address'),
  snapBuildingName: document.getElementById('snap-buildingname'),
  snapCopy: document.getElementById('snap-copy'),
  snapShare: document.getElementById('snap-share'),
  snapToast: document.getElementById('snap-toast'),
  snapFacts: document.getElementById('snap-facts'),
  snapStackWrap: document.getElementById('snap-stack-wrap'),
  snapStack: document.getElementById('snap-stack'),
  snapLinksWrap: document.getElementById('snap-links-wrap'),
  snapLinks: document.getElementById('snap-links'),
  snapNearby: document.getElementById('snap-nearby'),
  snapSv: document.getElementById('snap-streetview'),
  snapSvFrame: document.getElementById('snap-sv-frame'),
  snapSvNote: document.getElementById('snap-sv-note'),
  snapSvLink: document.getElementById('snap-sv-link'),
  parcelCount: document.getElementById('parcel-count'),
};

// ---------------- Splash progress ----------------
function setSplashProgress(pct, label) {
  els.splashProgress.style.width = pct + '%';
  if (label) els.splashStatus.textContent = label;
}
function hideSplash() {
  setTimeout(() => {
    els.splash.classList.add('splash-hidden');
  }, 350);
}

// ---------------- Utility ----------------
function fmtNum(v) {
  if (v === null || v === undefined || v === '') return null;
  return v;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function haversineFt(a, b) {
  // a, b = [lon, lat]; returns distance in feet
  const R = 20902231; // ft
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function boundsOfGeometry(geometry) {
  const bounds = new mapboxgl.LngLatBounds();
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      bounds.extend(coords);
    } else {
      coords.forEach(walk);
    }
  };
  walk(geometry.coordinates);
  return bounds;
}

// ---------------- Map init ----------------
map = new mapboxgl.Map({
  container: 'map',
  style: CONFIG.MAPBOX_STYLE,
  center: CONFIG.INITIAL_CENTER,
  zoom: CONFIG.INITIAL_ZOOM,
  attributionControl: true,
});
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');

map.on('load', init);

async function init() {
  setSplashProgress(15, 'Loading River Edge, historic district & Opportunity Zone boundaries…');

  const [rerz, oz, hd, properties, centroids] = await Promise.all([
    fetch(CONFIG.DATA.rerz).then((r) => r.json()),
    fetch(CONFIG.DATA.oz).then((r) => r.json()),
    fetch(CONFIG.DATA.hd).then((r) => r.json()),
    fetch(CONFIG.DATA.properties).then((r) => r.json()),
    fetch(CONFIG.DATA.centroids).then((r) => r.json()),
  ]);

  setSplashProgress(55, 'Indexing Elgin properties…');

  propsData = properties;
  centroidsData = centroids;
  propsData.features.forEach((f) => (propsById[f.properties.id] = f));
  centroidsData.features.forEach((f) => (centroidById[f.properties.id] = f));

  // district name -> City of Elgin ordinance document, for the Records list
  window.__hdLinks = {};
  hd.features.forEach((f) => {
    if (f.properties.name && f.properties.ord_link) {
      window.__hdLinks[f.properties.name] = f.properties.ord_link;
    }
  });

  els.parcelCount.textContent = propsData.features.length.toLocaleString();
  const stamp = document.getElementById('build-stamp');
  if (stamp) stamp.textContent = CONFIG.BUILD || 'unknown';

  // ---- Sources ----
  map.addSource('rerz', { type: 'geojson', data: rerz });
  map.addSource('oz', { type: 'geojson', data: oz });
  map.addSource('hd', { type: 'geojson', data: hd });
  map.addSource('props-poly', { type: 'geojson', data: propsData, promoteId: 'id' });

  setSplashProgress(75, 'Styling map layers…');

  // Three distinct hues so overlapping boundaries stay legible: a warm
  // terracotta accent for the RERZ, brand mid-green for historic districts,
  // and dark charcoal grey for Opportunity Zones. All three start visible;
  // fills are kept light so a parcel sitting in two or three of them is
  // still readable underneath.

  // ---- RERZ (terracotta accent) ----
  map.addLayer({
    id: 'rerz-fill',
    type: 'fill',
    source: 'rerz',
    paint: { 'fill-color': '#b5764a', 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: 'rerz-outline',
    type: 'line',
    source: 'rerz',
    paint: { 'line-color': '#b5764a', 'line-width': 2.4 },
  });

  // ---- OZ (dark grey) ----
  map.addLayer({
    id: 'oz-fill',
    type: 'fill',
    source: 'oz',
    paint: { 'fill-color': '#454948', 'fill-opacity': 0.1 },
  });
  map.addLayer({
    id: 'oz-outline',
    type: 'line',
    source: 'oz',
    paint: { 'line-color': '#454948', 'line-width': 1.8, 'line-dasharray': [2, 1.4] },
  });

  // ---- Historic districts (mid green) ----
  map.addLayer({
    id: 'hd-fill',
    type: 'fill',
    source: 'hd',
    paint: { 'fill-color': '#7ba457', 'fill-opacity': 0.16 },
  });
  map.addLayer({
    id: 'hd-outline',
    type: 'line',
    source: 'hd',
    paint: { 'line-color': '#7ba457', 'line-width': 1.8 },
  });

  // ---- Researched parcels (always visible, primary click target) ----
  map.addLayer({
    id: 'props-fill',
    type: 'fill',
    source: 'props-poly',
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#7ba457',
        '#454948',
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 0.35,
        ['boolean', ['feature-state', 'hover'], false], 0.28,
        0.12,
      ],
    },
  });
  map.addLayer({
    id: 'props-outline',
    type: 'line',
    source: 'props-poly',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#779354',
        '#454948',
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 3,
        1.1,
      ],
      'line-opacity': 0.85,
    },
  });

  setSplashProgress(100, 'Ready.');
  hideSplash();

  fitToProperties(0);
  bindMapInteractions();
  bindUI();
  bindLayerToggles();
  bindMobileLayersControl();
  initSheet();
  checkDeepLink();
}

// ---------------- Layer toggles ----------------
// Desktop legend and the mobile panel hold two copies of the same checkboxes;
// toggling either one updates the map and keeps its twin in sync.
function bindLayerToggles() {
  document.querySelectorAll('.legend-list input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const layer = input.dataset.layer;
      const visibility = input.checked ? 'visible' : 'none';
      [`${layer}-fill`, `${layer}-outline`].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      });
      document
        .querySelectorAll(`.legend-list input[data-layer="${layer}"]`)
        .forEach((twin) => { twin.checked = input.checked; });
    });
  });
}

function bindMobileLayersControl() {
  const toggle = document.getElementById('mobile-layers-toggle');
  const panel = document.getElementById('mobile-layers-panel');
  const wrap = document.getElementById('mobile-layers');
  if (!toggle || !panel || !wrap) return;

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      panel.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function fitToProperties(duration) {
  const bounds = new mapboxgl.LngLatBounds();
  centroidsData.features.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: duration ?? 900 });
}

// ---------------- Mobile bottom sheet ----------------
// Only affects layout under the 860px breakpoint defined in style.css.
// Three snap positions so the map is never fully hidden unless the
// viewer deliberately drags all the way up:
//   collapsed — handle + search bar only
//   half      — panel covers ~48% of the screen, map still visible above
//   full      — panel covers nearly the whole screen
const SHEET_PEEK_PX = 108;
const SHEET_HALF_RATIO = 0.48;
const SHEET_FULL_MARGIN_PX = 56;

let sheetExpandFn = null;
let sheetCollapseFn = null;

function initSheet() {
  const sidebar = document.getElementById('sidebar');
  const handle = document.getElementById('sheet-handle');
  if (!sidebar || !handle) return;

  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

  const snapPoints = () => {
    const h = sidebar.offsetHeight || window.innerHeight;
    return {
      collapsed: Math.max(0, h - SHEET_PEEK_PX),
      half: Math.max(0, h * (1 - SHEET_HALF_RATIO)),
      full: Math.max(0, SHEET_FULL_MARGIN_PX),
    };
  };

  let state = 'collapsed';
  let currentY = snapPoints().collapsed;

  function applyY(y, animate) {
    currentY = y;
    sidebar.classList.toggle('sheet-dragging', !animate);
    sidebar.style.setProperty('--sheet-y', `${y}px`);
  }

  function goTo(nextState) {
    state = nextState;
    applyY(snapPoints()[nextState], true);
  }

  function nearestState(y) {
    const pts = snapPoints();
    let best = 'collapsed';
    let bestDist = Infinity;
    for (const key of Object.keys(pts)) {
      const d = Math.abs(pts[key] - y);
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
    return best;
  }

  const cycle = { collapsed: 'half', half: 'full', full: 'collapsed' };

  sheetExpandFn = () => { if (isMobile()) goTo('half'); };
  sheetCollapseFn = () => { if (isMobile()) goTo('collapsed'); };

  window.addEventListener('resize', () => {
    if (!isMobile()) return;
    applyY(snapPoints()[state], true);
  });

  // ---- Drag handling ----
  let dragging = false;
  let moved = false;
  let startY = 0;
  let startTranslate = 0;

  function onPointerDown(e) {
    if (!isMobile()) return;
    dragging = true;
    moved = false;
    startY = e.clientY;
    startTranslate = currentY;
    applyY(currentY, false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    const pts = snapPoints();
    const next = Math.max(pts.full, Math.min(pts.collapsed, startTranslate + dy));
    applyY(next, false);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    if (!moved) {
      goTo(cycle[state]);
    } else {
      goTo(nearestState(currentY));
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);

  requestAnimationFrame(() => goTo('collapsed'));
}

// ---------------- Map interactions ----------------
function bindMapInteractions() {
  map.on('click', 'props-fill', (e) => {
    const id = e.features[0].properties.id;
    selectProperty(id, true);
  });

  map.on('mouseenter', 'props-fill', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'props-fill', () => (map.getCanvas().style.cursor = ''));

  map.on('mousemove', 'props-fill', (e) => {
    if (!e.features.length) return;
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'props-poly', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = e.features[0].id;
    map.setFeatureState({ source: 'props-poly', id: hoveredFeatureId }, { hover: true });
  });
  map.on('mouseleave', 'props-fill', () => {
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'props-poly', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = null;
  });
}

// ---------------- Search ----------------
function bindUI() {
  els.searchInput.addEventListener('input', onSearchInput);
  els.searchClear.addEventListener('click', () => {
    els.searchInput.value = '';
    els.searchBox.classList.remove('has-value');
    els.searchResults.innerHTML = '';
  });
  els.snapshotBack.addEventListener('click', deselectProperty);
  els.snapCopy.addEventListener('click', copyShareLink);
  els.snapShare.addEventListener('click', shareProperty);
}

function onSearchInput() {
  const q = els.searchInput.value.trim().toLowerCase();
  els.searchBox.classList.toggle('has-value', q.length > 0);
  if (q) sheetExpandFn?.();
  if (!q) {
    els.searchResults.innerHTML = '';
    return;
  }
  const matches = propsData.features
    .filter((f) => {
      const p = f.properties;
      return (
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.also && p.also.toLowerCase().includes(q)) ||
        (p.pin && p.pin.replace(/-/g, '').includes(q.replace(/-/g, ''))) ||
        (p.hd_name && p.hd_name.toLowerCase().includes(q)) ||
        (p.zoning && p.zoning.toLowerCase().includes(q)) ||
        (p.land_use && p.land_use.toLowerCase().includes(q))
      );
    })
    .slice(0, 12);

  if (!matches.length) {
    els.searchResults.innerHTML = '<div class="search-no-results">No River Edge properties match that search.</div>';
    return;
  }

  els.searchResults.innerHTML = matches
    .map((f) => {
      const p = f.properties;
      const flags = [];
      if (p.rerz === 'Y') flags.push('<span class="sr-flag on-rerz">RERZ</span>');
      if (p.hd === 'Y') flags.push('<span class="sr-flag on-hd">HISTORIC</span>');
      if (p.oz === 'Y') flags.push('<span class="sr-flag on-oz">OZ</span>');
      return `<div class="search-result-item" data-id="${esc(p.id)}">
        <div class="sr-title">${esc(p.address || 'Unknown address')}</div>
        <div class="sr-sub">${esc(p.units > 1 ? `${p.land_use || 'Parcel'} · ${p.units} addresses` : (p.land_use || p.zoning || ''))}</div>
        ${flags.length ? `<div class="sr-flags">${flags.join('')}</div>` : ''}
      </div>`;
    })
    .join('');

  els.searchResults.querySelectorAll('.search-result-item').forEach((el) => {
    el.addEventListener('click', () => selectProperty(el.dataset.id, true));
  });
}

// ---------------- Select / deselect ----------------
function selectProperty(id, flyTo) {
  const feature = propsById[id];
  if (!feature) return;

  if (selectedId !== null) {
    map.setFeatureState({ source: 'props-poly', id: selectedId }, { selected: false });
  }
  selectedId = id;
  map.setFeatureState({ source: 'props-poly', id }, { selected: true });

  els.emptyState.classList.add('hidden');
  els.snapshot.classList.remove('hidden');
  els.searchResults.innerHTML = '';

  renderSnapshot(feature);
  sheetExpandFn?.();

  if (flyTo) {
    const bounds = boundsOfGeometry(feature.geometry);
    map.fitBounds(bounds, { padding: framingPadding(), maxZoom: 17.5, duration: 900 });
  }

  const url = new URL(window.location.href);
  url.searchParams.set('p', id);
  window.history.replaceState({}, '', url);
}

// Padding for fitBounds that keeps the framed feature clear of whatever's
// covering the map — the sidebar on desktop, the half-open sheet on mobile.
function framingPadding() {
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  if (!isMobile) return 140;
  const headerH = 72;
  const sheetHalfPx = Math.round((window.innerHeight - headerH) * 0.48);
  return { top: 50, bottom: sheetHalfPx + 40, left: 40, right: 40 };
}

function deselectProperty() {
  if (selectedId !== null) {
    map.setFeatureState({ source: 'props-poly', id: selectedId }, { selected: false });
  }
  selectedId = null;
  els.snapshot.classList.add('hidden');
  els.emptyState.classList.remove('hidden');
  sheetCollapseFn?.();

  if (centroidsData) fitToProperties(900);

  const url = new URL(window.location.href);
  url.searchParams.delete('p');
  window.history.replaceState({}, '', url);
}


// ---------------- Street View ----------------
// Two Google services, both free:
//   * the metadata endpoint says whether a panorama exists near this parcel
//     and where its camera stands — unlimited, no charge;
//   * the Maps Embed API renders the interactive panel — no charge, no rate
//     limit.
// The billed Street View *Static* API is deliberately not used.
//
// Knowing the camera position is what makes this worth the extra request:
// Google's default view faces whichever way the car was pointing, which on a
// residential street is usually the street, not the building. With the camera
// coordinates we aim the heading straight at the parcel.

function bearing(from, to) {
  // initial great-circle bearing, degrees clockwise from north
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Each render gets a token; a slow response for a property the viewer has
// already clicked away from is discarded rather than landing in the panel.
let svToken = 0;

async function renderStreetView(feature) {
  const token = ++svToken;
  const wrap = els.snapSv;
  if (!wrap) return;

  const centroid = centroidById[feature.properties.id];
  if (!centroid) {
    wrap.classList.add('hidden');
    return;
  }
  const target = centroid.geometry.coordinates;   // [lon, lat]
  const [lon, lat] = target;

  wrap.classList.remove('hidden');
  els.snapSvFrame.classList.add('hidden');
  els.snapSvFrame.innerHTML = '';
  els.snapSvNote.classList.add('hidden');

  // The link out needs no API key and always works. It also gives the viewer
  // Google's historical imagery slider, which the embed does not expose.
  els.snapSvLink.href =
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

  const key = CONFIG.GOOGLE_MAPS_KEY;
  if (!key) return;   // link-only until a key is configured

  try {
    const meta = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lon}&radius=80&source=outdoor&key=${key}`
    ).then((r) => r.json());

    if (token !== svToken) return;   // viewer moved on

    if (meta.status !== 'OK') {
      els.snapSvNote.classList.remove('hidden');
      return;
    }

    const cam = [meta.location.lng, meta.location.lat];
    const heading = Math.round(bearing(cam, target));

    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = `Street View of ${feature.properties.address}`;
    iframe.src = `https://www.google.com/maps/embed/v1/streetview` +
      `?key=${encodeURIComponent(key)}` +
      `&pano=${encodeURIComponent(meta.pano_id)}` +
      `&heading=${heading}&pitch=8&fov=80`;
    els.snapSvFrame.innerHTML = '';
    els.snapSvFrame.appendChild(iframe);
    els.snapSvFrame.classList.remove('hidden');
  } catch (err) {
    // Network failure, a rejected key, or a referrer restriction that does
    // not cover this domain. The link out still works, so fail quietly.
    if (token === svToken) els.snapSvNote.classList.remove('hidden');
  }
}

// ---------------- Snapshot rendering ----------------
function statusRow(rowId, isYes, valueText) {
  const row = document.getElementById(rowId);
  row.classList.toggle('is-yes', isYes);
  row.classList.toggle('is-no', !isYes);
  document.getElementById(rowId + '-value').textContent = valueText;
}

// Plain-language read on what stacks on this parcel. Deliberately framed as
// "may qualify" — eligibility depends on the scope of work and program rules,
// not on location alone.
function stackNarrative(p) {
  const parts = [];
  if (p.rerz === 'Y') {
    parts.push('Sits in the Elgin River Edge Redevelopment Zone — qualifying rehabilitation may be eligible for the 25% River Edge Historic Tax Credit on certified historic structures, plus RERZ sales tax and investment incentives.');
  }
  if (p.hd === 'Y') {
    parts.push(`${p.rerz === 'Y' ? 'Inside' : 'Sits inside'} the ${p.hd_name} local historic district, so exterior work is subject to Elgin Heritage Commission review — and district status supports the case for the landmark or National Register certification that historic tax credits require.`);
  }
  if (p.rerz !== 'Y' && p.hd === 'Y') {
    parts.push('Outside the River Edge Redevelopment Zone, so the 25% state River Edge credit does not apply here — the federal 20% rehabilitation credit remains available for certified historic structures in income-producing use.');
  }
  if (p.oz === 'Y') {
    parts.push('Also in a federal Qualified Opportunity Zone, which can defer and reduce capital gains tax for investors putting gains into the project.');
  }
  if (p.ssa) {
    parts.push(`Within ${p.ssa} Special Service Area.`);
  }
  return parts.join(' ');
}

function renderSnapshot(feature) {
  const p = feature.properties;

  els.snapAddress.textContent = p.address || 'Address unavailable';
  // One parcel can carry many addresses (a condo or apartment building), so
  // the subtitle says how many rather than the map drawing the same polygon
  // once per unit.
  const sub = [p.land_use, p.units > 1 ? `${p.units} addresses on this parcel` : null]
    .filter(Boolean).join(' · ');
  els.snapBuildingName.textContent = sub;
  els.snapBuildingName.style.display = sub ? '' : 'none';

  // Status rows
  statusRow('status-rerz', p.rerz === 'Y', p.rerz === 'Y' ? 'Yes — in the zone' : 'Not in the RERZ');
  statusRow('status-oz', p.oz === 'Y', p.oz === 'Y' ? (p.oz_tract || 'Yes — Qualified Opportunity Zone') : 'Not in an Opportunity Zone');
  statusRow('status-hd', p.hd === 'Y', p.hd === 'Y' ? p.hd_name : 'Not in a local historic district');

  // Incentive stack narrative
  const narrative = stackNarrative(p);
  if (narrative) {
    els.snapStackWrap.classList.remove('hidden');
    els.snapStack.textContent = narrative;
  } else {
    els.snapStackWrap.classList.add('hidden');
  }

  // Facts
  const facts = [
    ['Parcel PIN', p.pin],
    ['Parcel Size', p.acres ? `${p.acres} ac` : null],
    ['Zoning', p.zoning],
    ['Current Land Use', p.land_use],
    ['Historic District', p.hd_name],
    ['Addresses on Parcel', p.units > 1 ? p.units : null],
    ['Also Addressed', p.also],
    ['TIF District', p.tif_district],
    ['Special Service Area', p.ssa],
    ['Census Tract', p.tract],
    ['Township', p.township],
    ['County', p.county],
    ['ZIP', p.zip],
  ];

  els.snapFacts.innerHTML = facts
    .filter(([, v]) => fmtNum(v))
    .map(([label, v]) => `<div class="snap-fact"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`)
    .join('');

  // Record links
  const links = [];
  if (p.treasurer) links.push(['Kane County tax record', p.treasurer]);
  const dist = (window.__hdLinks || {})[p.hd_name];
  if (dist) links.push([`${p.hd_name} district ordinance`, dist]);
  if (links.length) {
    els.snapLinksWrap.classList.remove('hidden');
    els.snapLinks.innerHTML = links
      .map(([label, href]) => `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} &#8599;</a></li>`)
      .join('');
  } else {
    els.snapLinksWrap.classList.add('hidden');
  }

  renderNearby(feature);
  renderStreetView(feature);
}

function renderNearby(feature) {
  const centroidFeat = centroidById[feature.properties.id];
  if (!centroidFeat) {
    els.snapNearby.innerHTML = '<li class="snap-nearby-empty">No nearby properties found.</li>';
    return;
  }
  const origin = centroidFeat.geometry.coordinates;

  const distances = centroidsData.features
    .filter((f) => f.properties.id !== feature.properties.id)
    .map((f) => ({
      id: f.properties.id,
      address: f.properties.address,
      distFt: haversineFt(origin, f.geometry.coordinates),
    }))
    .sort((a, b) => a.distFt - b.distFt)
    .slice(0, 5);

  if (!distances.length) {
    els.snapNearby.innerHTML = '<li class="snap-nearby-empty">No nearby properties found.</li>';
    return;
  }

  els.snapNearby.innerHTML = distances
    .map((d) => {
      const distLabel = d.distFt > 2800 ? `${(d.distFt / 5280).toFixed(2)} mi` : `${Math.round(d.distFt)} ft`;
      return `<li class="snap-nearby-item" data-id="${esc(d.id)}">
        <span>${esc(d.address || 'Unknown address')}</span>
        <span class="snap-nearby-dist">${distLabel}</span>
      </li>`;
    })
    .join('');

  els.snapNearby.querySelectorAll('.snap-nearby-item').forEach((el) => {
    el.addEventListener('click', () => selectProperty(el.dataset.id, true));
  });
}

// ---------------- Share / copy ----------------
function currentShareUrl() {
  const url = new URL(CONFIG.SHARE_BASE_URL);
  url.searchParams.set('p', selectedId);
  return url.toString();
}

function showToast() {
  els.snapToast.classList.add('show');
  setTimeout(() => els.snapToast.classList.remove('show'), 1800);
}

function copyShareLink() {
  if (!selectedId) return;
  const url = currentShareUrl();
  navigator.clipboard?.writeText(url).then(showToast).catch(() => {
    const tmp = document.createElement('input');
    document.body.appendChild(tmp);
    tmp.value = url;
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    showToast();
  });
}

function shareProperty() {
  if (!selectedId) return;
  const feature = propsById[selectedId];
  const url = currentShareUrl();
  const title = `${feature.properties.address} — Elgin Historic Property Research`;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    copyShareLink();
  }
}

// ---------------- Deep linking ----------------
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('p');
  if (id && propsById[id]) {
    selectProperty(id, true);
  }
}
