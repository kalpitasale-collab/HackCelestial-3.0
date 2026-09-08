import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ------------------------------------------------------------------ */
/*  Fix default Leaflet marker icons (webpack / vite bundler issue)   */
/* ------------------------------------------------------------------ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ------------------------------------------------------------------ */
/*  Dark OpenStreetMap tile layer (CartoDB Dark Matter)                */
/* ------------------------------------------------------------------ */
const DARK_TILE_URL =
  'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/* ------------------------------------------------------------------ */
/*  Default data (same as before)                                     */
/* ------------------------------------------------------------------ */
const DEFAULT_ZONES = [
  {
    id: 'shivajinagar',
    name: 'Shivajinagar Hub',
    coordinates: [73.8478, 18.5314],
    risk: 'VERY HIGH',
    riskScore: 92.4,
    crowd: 5980,
    capacity: 6500,
  },
  {
    id: 'swargate',
    name: 'Swargate Junction',
    coordinates: [73.857, 18.5003],
    risk: 'MODERATE',
    riskScore: 71.2,
    crowd: 6420,
    capacity: 10200,
  },
  {
    id: 'pune-station',
    name: 'Pune Station Gate',
    coordinates: [73.8766, 18.5286],
    risk: 'MODERATE',
    riskScore: 59.8,
    crowd: 7115,
    capacity: 13500,
  },
  {
    id: 'deccan',
    name: 'Deccan Square',
    coordinates: [73.8395, 18.5174],
    risk: 'MODERATE',
    riskScore: 52.1,
    crowd: 3920,
    capacity: 8200,
  },
  {
    id: 'sarasbaug',
    name: 'Sarasbaug Access',
    coordinates: [73.8498, 18.5018],
    risk: 'LOW',
    riskScore: 34.6,
    crowd: 2860,
    capacity: 9800,
  },
];

const DEFAULT_BOUNDARY = [
  [73.8538, 18.5185],
  [73.8596, 18.5185],
  [73.8602, 18.516],
  [73.8591, 18.5138],
  [73.8552, 18.5136],
  [73.8536, 18.5155],
  [73.8538, 18.5185],
];

const DEFAULT_MAIN_GATE = {
  name: 'Main Gate',
  coordinates: [73.856111, 18.516389],
};

const DEFAULT_EMERGENCY_EXITS = [
  {
    id: 'route-1-sevasadan-chowk',
    route: 'Route 1 (Western Exit)',
    name: 'Sevasadan Chowk',
    coordinates: [73.8504, 18.5134],
  },
  {
    id: 'route-1-west',
    route: 'Route 1 (Western Exit)',
    name: 'Laxmi Road',
    coordinates: [73.8487, 18.514],
  },
  {
    id: 'route-1-tilak-road',
    route: 'Route 1 (Western Exit)',
    name: 'Tilak Road',
    coordinates: [73.8447, 18.5111],
  },
  {
    id: 'route-2-north',
    route: 'Route 2 (Northern Exit)',
    name: 'Mamledar Kacheri',
    coordinates: [73.8581, 18.5067],
  },
  {
    id: 'route-2-jayantrao-tilak-bridge',
    route: 'Route 2 (Northern Exit)',
    name: 'Jayantrao Tilak Bridge',
    coordinates: [73.8532, 18.5214],
  },
  {
    id: 'route-3-east',
    route: 'Route 3 (Eastern Exit)',
    name: 'Subhanshah Dargah (Raviwar Peth)',
    coordinates: [73.8605, 18.5152],
  },
  {
    id: 'route-3-govind-halwai-chowk',
    route: 'Route 3 (Eastern Exit)',
    name: 'Govind Halwai Chowk',
    coordinates: [73.8618, 18.513],
  },
  {
    id: 'route-4-southwest',
    route: 'Route 4 (South-Western Exit)',
    name: 'Perugate',
    coordinates: [73.8487, 18.5114],
  },
  {
    id: 'route-4-maharana-pratap-udyan',
    route: 'Route 4 (South-Western Exit)',
    name: 'Maharana Pratap Udyan',
    coordinates: [73.8536, 18.5101],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function ensureClosedBoundary(boundary) {
  if (!Array.isArray(boundary) || boundary.length < 3) {
    return DEFAULT_BOUNDARY;
  }
  const [firstLng, firstLat] = boundary[0];
  const last = boundary[boundary.length - 1];
  if (last && last[0] === firstLng && last[1] === firstLat) {
    return boundary;
  }
  return [...boundary, [firstLng, firstLat]];
}

/** Convert [lng, lat] to Leaflet [lat, lng] */
function toLatLng(coords) {
  return [coords[1], coords[0]];
}

/** Risk score → color for circle markers */
function riskColor(score) {
  if (score >= 80) return '#ef5b5b';
  if (score >= 50) return '#f1b336';
  return '#27b26b';
}

/** Risk score → glow opacity */
function riskOpacity(score) {
  return Math.min(0.3 + (score / 100) * 0.55, 0.85);
}

/** Create a colored circle-div icon for Leaflet */
function createCircleIcon(color, size = 24) {
  return L.divIcon({
    className: 'leaflet-circle-marker-icon',
    html: `<div style="
      width:${size}px; height:${size}px; border-radius:50%;
      background:${color}; border:2.5px solid #fff;
      box-shadow: 0 0 ${size * 0.6}px ${color}88, 0 0 ${size * 1.2}px ${color}44;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Create the main-gate icon (green pulsing) */
function createMainGateIcon() {
  return L.divIcon({
    className: 'leaflet-main-gate-icon',
    html: `<div style="position:relative;width:32px;height:32px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(4,201,119,0.25);
        animation: gatePulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;
        background:#04c977;border:3px solid #fff;
        box-shadow:0 0 12px rgba(4,201,119,0.6);
      "></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/** Create emergency exit icon (red, smaller) */
function createExitIcon() {
  return L.divIcon({
    className: 'leaflet-exit-icon',
    html: `<div style="
      width:14px; height:14px; border-radius:50%;
      background:#ff3030; border:2px solid #fff;
      box-shadow:0 0 8px rgba(255,48,48,0.5);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7],
  });
}

/** Create camera icon (white circle with green border) */
function createCameraIcon(count) {
  return L.divIcon({
    className: 'leaflet-camera-icon',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:#fff;border:2.5px solid #0ea05a;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:#111;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    ">${count ?? ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function LiveCommandMap({ mapData, cameras, highlightedRoute }) {
  const { t, i18n } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});

  /* Localization helpers (unchanged from original) */
  const zoneNameKeyByName = {
    'Shivajinagar Hub': 'map.zoneNames.shivajinagar',
    'Swargate Junction': 'map.zoneNames.swargate',
    'Pune Station Gate': 'map.zoneNames.puneStation',
    'Deccan Square': 'map.zoneNames.deccan',
    'Sarasbaug Access': 'map.zoneNames.sarasbaug',
  };
  const exitNameKeyByName = {
    'Sevasadan Chowk': 'map.exitNames.sevasadanChowk',
    'Laxmi Road': 'map.exitNames.laxmiRoad',
    'Tilak Road': 'map.exitNames.tilakRoad',
    'Mamledar Kacheri': 'map.exitNames.mamledarKacheri',
    'Jayantrao Tilak Bridge': 'map.exitNames.jayantraoTilakBridge',
    'Subhanshah Dargah (Raviwar Peth)': 'map.exitNames.subhanshahDargah',
    'Govind Halwai Chowk': 'map.exitNames.govindHalwaiChowk',
    Perugate: 'map.exitNames.perugate',
    'Maharana Pratap Udyan': 'map.exitNames.maharanaPratapUdyan',
  };
  const routeNameKeyByName = {
    'Route 1 (Western Exit)': 'map.routeNames.route1',
    'Route 2 (Northern Exit)': 'map.routeNames.route2',
    'Route 3 (Eastern Exit)': 'map.routeNames.route3',
    'Route 4 (South-Western Exit)': 'map.routeNames.route4',
  };
  const riskKeyByValue = {
    'VERY HIGH': 'map.risk.veryHigh',
    MODERATE: 'map.risk.moderate',
    LOW: 'map.risk.low',
  };

  const localizeZoneName = (value) => {
    const key = zoneNameKeyByName[value];
    return key ? t(key) : value || t('map.unknownZone');
  };
  const localizeExitName = (value) => {
    const key = exitNameKeyByName[value];
    return key ? t(key) : value;
  };
  const localizeRouteName = (value) => {
    const key = routeNameKeyByName[value];
    return key ? t(key) : value;
  };
  const localizeRisk = (value) => {
    const key = riskKeyByValue[value];
    return key ? t(key) : value || t('common.na');
  };
  const localizeMainGateName = (value) => {
    if (value === 'Main Gate') return t('map.mainGateName');
    return value || t('map.mainGateName');
  };

  /* Resolved data */
  const zones =
    Array.isArray(mapData?.zones) && mapData.zones.length > 0
      ? mapData.zones
      : DEFAULT_ZONES;
  const boundary = ensureClosedBoundary(mapData?.boundary || DEFAULT_BOUNDARY);
  const mainGate =
    mapData?.main_gate && Array.isArray(mapData.main_gate.coordinates)
      ? mapData.main_gate
      : DEFAULT_MAIN_GATE;

  const emergencyExits = useMemo(() => {
    const provided = Array.isArray(mapData?.emergency_exits)
      ? mapData.emergency_exits
      : [];
    const merged = [...provided];
    const existingKeys = new Set(
      provided.map((ep) => {
        const route = String(ep?.route || '').trim().toLowerCase();
        const name = String(ep?.name || '').trim().toLowerCase();
        return `${route}::${name}`;
      })
    );
    DEFAULT_EMERGENCY_EXITS.forEach((de) => {
      const key = `${String(de.route).trim().toLowerCase()}::${String(de.name).trim().toLowerCase()}`;
      if (!existingKeys.has(key)) merged.push(de);
    });
    return merged;
  }, [mapData?.emergency_exits]);

  /* ================================================================ */
  /*  Initialize the Leaflet map once                                 */
  /* ================================================================ */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = L.map(mapContainerRef.current, {
      center: toLatLng(mainGate.coordinates),
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(DARK_TILE_URL, {
      attribution: DARK_TILE_ATTR,
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;
    layersRef.current = {};

    /* --- Boundary polygon --- */
    const boundaryLatLngs = boundary.map(toLatLng);
    const boundaryPoly = L.polygon(boundaryLatLngs, {
      color: '#8bb8f2',
      weight: 2.8,
      opacity: 0.95,
      dashArray: '8 8',
      fillColor: '#4f6f92',
      fillOpacity: 0.14,
    }).addTo(map);
    layersRef.current.boundary = boundaryPoly;

    /* --- Boundary vertex labels --- */
    const vertexGroup = L.layerGroup().addTo(map);
    boundary.slice(0, -1).forEach((point, idx) => {
      L.circleMarker(toLatLng(point), {
        radius: 6,
        fillColor: '#046b3f',
        fillOpacity: 0.9,
        color: '#dce8ff',
        weight: 1.4,
      })
        .bindTooltip(`L${idx + 1}`, {
          permanent: true,
          direction: 'bottom',
          className: 'boundary-vertex-tooltip',
          offset: [0, 8],
        })
        .addTo(vertexGroup);
    });
    layersRef.current.vertices = vertexGroup;

    /* --- Heatmap glow circles (simulated via large semi-transparent circles) --- */
    const heatGroup = L.layerGroup().addTo(map);
    layersRef.current.heat = heatGroup;

    /* --- Zone markers --- */
    const zoneGroup = L.layerGroup().addTo(map);
    layersRef.current.zones = zoneGroup;

    /* --- Camera markers --- */
    const cameraGroup = L.layerGroup().addTo(map);
    layersRef.current.cameras = cameraGroup;

    /* --- Main gate marker --- */
    const gateMarker = L.marker(toLatLng(mainGate.coordinates), {
      icon: createMainGateIcon(),
      zIndexOffset: 1000,
    })
      .bindPopup(
        `<div class="map-popup"><h4>${localizeMainGateName(mainGate.name)}</h4><p><strong>${t('map.popupLocationLabel')}:</strong> ${t('map.mainGateDescription')}</p></div>`,
        { className: 'leaflet-dark-popup' }
      )
      .addTo(map);
    layersRef.current.gate = gateMarker;

    /* --- Emergency exit markers --- */
    const exitGroup = L.layerGroup().addTo(map);
    emergencyExits.forEach((route) => {
      L.marker(toLatLng(route.coordinates), {
        icon: createExitIcon(),
      })
        .bindPopup(
          `<div class="map-popup"><h4>${localizeRouteName(route.route)}</h4><p><strong>${t('map.popupExitPointLabel')}:</strong> ${localizeExitName(route.name)}</p></div>`,
          { className: 'leaflet-dark-popup' }
        )
        .addTo(exitGroup);
    });
    layersRef.current.exits = exitGroup;

    /* --- Evacuation route polyline (initially empty) --- */
    const routeLine = L.polyline([], {
      color: '#ef5b5b',
      weight: 6,
      opacity: 0.96,
    }).addTo(map);
    layersRef.current.routeLine = routeLine;

    const routeCasing = L.polyline([], {
      color: '#ffffff',
      weight: 10,
      opacity: 0.88,
    }).addTo(map);
    layersRef.current.routeCasing = routeCasing;

    /* --- Fit bounds to show all markers --- */
    const allPoints = [
      toLatLng(mainGate.coordinates),
      ...emergencyExits.map((e) => toLatLng(e.coordinates)),
    ];
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints).pad(0.15), { maxZoom: 16 });
    }

    /* --- ResizeObserver for container changes --- */
    let resizeObserver;
    const handleResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(mapContainerRef.current);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layersRef.current = {};
    };
  }, [i18n.language]);

  /* ================================================================ */
  /*  Update zone markers & heatmap glow when data changes            */
  /* ================================================================ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    /* Heatmap glow */
    const heatGroup = layersRef.current.heat;
    if (heatGroup) {
      heatGroup.clearLayers();
      zones.forEach((zone) => {
        const score = zone.riskScore || 0;
        const color = riskColor(score);

        // Large outer glow
        L.circle(toLatLng(zone.coordinates), {
          radius: 320,
          fillColor: color,
          fillOpacity: riskOpacity(score) * 0.45,
          color: 'transparent',
          weight: 0,
          interactive: false,
        }).addTo(heatGroup);

        // Inner glow
        L.circle(toLatLng(zone.coordinates), {
          radius: 150,
          fillColor: color,
          fillOpacity: riskOpacity(score) * 0.65,
          color: 'transparent',
          weight: 0,
          interactive: false,
        }).addTo(heatGroup);
      });
    }

    /* Zone markers */
    const zoneGroup = layersRef.current.zones;
    if (zoneGroup) {
      zoneGroup.clearLayers();
      zones.forEach((zone) => {
        const score = zone.riskScore || 0;
        const color = riskColor(score);
        const zoneName = localizeZoneName(zone.name);
        const risk = localizeRisk(zone.risk);
        const scoreFormatted = Number.isFinite(score)
          ? score.toLocaleString(i18n.language === 'mr' ? 'mr-IN' : 'en-IN', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          : t('common.na');

        L.marker(toLatLng(zone.coordinates), {
          icon: createCircleIcon(color, 22),
        })
          .bindPopup(
            `<div class="map-popup"><h4>${zoneName}</h4><p><strong>${t('map.popupRiskLabel')}:</strong> ${risk}</p><p><strong>${t('map.popupScoreLabel')}:</strong> ${scoreFormatted}</p></div>`,
            { className: 'leaflet-dark-popup' }
          )
          .addTo(zoneGroup);
      });
    }
  }, [zones, i18n.language]);

  /* ================================================================ */
  /*  Update camera markers when data changes                         */
  /* ================================================================ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cameraGroup = layersRef.current.cameras;
    if (!cameraGroup) return;

    cameraGroup.clearLayers();
    (cameras || [])
      .filter((cam) => Array.isArray(cam.coordinates))
      .forEach((cam) => {
        const count = cam.ml_count ?? cam.count ?? 0;
        L.marker(toLatLng(cam.coordinates), {
          icon: createCameraIcon(count),
        })
          .bindPopup(
            `<div class="map-popup map-popup--camera">
              <h4>${(cam.title || '').toUpperCase()}</h4>
              <p><strong>${t('camera.count')}:</strong> <span class="popup-count-val">${count}</span></p>
              <p><strong>${t('camera.emotion')}:</strong> ${cam.primary_emotion || cam.emotion || 'Calm'}</p>
              <p class="popup-location">${cam.location_details || cam.locationDetails || ''}</p>
            </div>`,
            { className: 'leaflet-dark-popup' }
          )
          .addTo(cameraGroup);
      });
  }, [cameras, i18n.language]);

  /* ================================================================ */
  /*  Update evacuation route                                         */
  /* ================================================================ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeLine = layersRef.current.routeLine;
    const routeCasing = layersRef.current.routeCasing;
    if (!routeLine || !routeCasing) return;

    const coords = Array.isArray(highlightedRoute?.coordinates)
      ? highlightedRoute.coordinates
      : [];

    if (coords.length < 2) {
      routeLine.setLatLngs([]);
      routeCasing.setLatLngs([]);
      return;
    }

    const latLngs = coords.map(toLatLng);
    routeCasing.setLatLngs(latLngs);
    routeLine.setLatLngs(latLngs);

    map.fitBounds(L.latLngBounds(latLngs).pad(0.1), {
      maxZoom: 17,
      duration: 1,
    });
  }, [highlightedRoute]);

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div className="mapbox-wrapper">
      <div
        ref={mapContainerRef}
        className="mapbox-canvas"
        aria-label={t('map.fallbackTitle')}
      />
    </div>
  );
}
