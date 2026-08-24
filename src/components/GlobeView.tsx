import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from 'maplibre-gl';
import { Compass } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Earthquake, MapLayerState, MapStyle, SeismicStation, Volcano } from '../types';

const COUNTRIES_URL = `${import.meta.env.BASE_URL}data/countries.geojson`;
const PLACES_URL = `${import.meta.env.BASE_URL}data/places.geojson`;
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const RELIEF_TILES = 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png';
const BATHYMETRY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
const REFERENCE_LABEL_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const OCEAN_LABEL_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}';

interface GlobeViewProps {
  events: Earthquake[];
  stations: SeismicStation[];
  volcanoes: Volcano[];
  layers: MapLayerState;
  mapStyle: MapStyle;
  selectedEvent: Earthquake | null;
  selectedStation: SeismicStation | null;
  focusTarget: { lat: number; lng: number; altitude?: number; token: number } | null;
  pulseEvent: Earthquake | null;
  onSelectEvent: (event: Earthquake) => void;
  onSelectStation: (station: SeismicStation) => void;
}

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: { type: 'Point' | 'LineString'; coordinates: unknown }; properties: Record<string, unknown> }>;
};

function createStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {},
    layers: [{ id: 'space', type: 'background', paint: { 'background-color': '#071015' } }],
  };
}

function asCollection(features: FeatureCollection['features']): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function earthquakeGeoJson(events: Earthquake[]): FeatureCollection {
  const now = Date.now();
  return asCollection(events.map((event) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
    properties: {
      eventId: event.id, magnitude: event.magnitude, magLabel: `M${event.magnitude.toFixed(1)}`,
      depth: event.depthKm, place: event.place, reviewCode: event.reviewCode,
      roman: event.intensity ? toRomanIntensity(event.intensity) : '', source: event.source,
      ageMinutes: Math.max(0, (now - event.time) / 60_000),
    },
  })));
}

function stationGeoJson(stations: SeismicStation[]): FeatureCollection {
  return asCollection(stations.map((station) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [station.lng, station.lat] },
    properties: {
      stationId: station.id, code: station.code, network: station.network, name: station.name,
      country: station.country, source: station.source, status: station.status,
    },
  })));
}

function volcanoGeoJson(volcanoes: Volcano[]): FeatureCollection {
  return asCollection(volcanoes.map((volcano) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [volcano.lng, volcano.lat] },
    properties: { volcanoId: volcano.id, name: volcano.name, country: volcano.country, volcanoType: volcano.volcanoType || '' },
  })));
}

function destinationPoint(origin: { lat: number; lng: number }, bearingDegrees: number, distanceKm: number): [number, number] {
  const angularDistance = distanceKm / 6371.0088;
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = origin.lat * Math.PI / 180;
  const lng1 = origin.lng * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
  return [((lng2 * 180 / Math.PI + 540) % 360) - 180, lat2 * 180 / Math.PI];
}

function waveCollection(origin: { lat: number; lng: number }, pRadiusKm: number, sRadiusKm: number): FeatureCollection {
  const ring = (radiusKm: number) => Array.from({ length: 121 }, (_, index) => destinationPoint(origin, index * 3, radiusKm));
  const features: FeatureCollection['features'] = [];
  if (pRadiusKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring(pRadiusKm) }, properties: { waveType: 'p' } });
  if (sRadiusKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring(sRadiusKm) }, properties: { waveType: 's' } });
  return asCollection(features);
}

function graticuleGeoJson(): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const coordinates: number[][] = [];
    for (let lng = -180; lng <= 180; lng += 2) coordinates.push([lng, lat]);
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
  }
  for (let lng = -180; lng < 180; lng += 15) {
    const coordinates: number[][] = [];
    for (let lat = -85; lat <= 85; lat += 2) coordinates.push([lng, lat]);
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
  }
  return asCollection(features);
}

function toRomanIntensity(value: number) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return numerals[Math.max(0, Math.min(11, Math.round(value) - 1))];
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

function setVisibility(map: maplibregl.Map, ids: string[], visible: boolean) {
  for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

function stationIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D no disponible');
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(16, 3); context.lineTo(29, 27); context.lineTo(3, 27); context.closePath();
  context.fillStyle = '#08736f'; context.fill();
  context.strokeStyle = '#d9fffa'; context.lineWidth = 2.4; context.stroke();
  context.beginPath(); context.arc(16, 18, 3.5, 0, Math.PI * 2);
  context.fillStyle = '#53e1d3'; context.fill();
  return context.getImageData(0, 0, 32, 32);
}

function addSourceAndLayers(map: maplibregl.Map) {
  map.addImage('station-node', stationIcon(), { pixelRatio: 2 });
  map.addSource('satellite', { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
  map.addSource('relief', { type: 'raster', tiles: [RELIEF_TILES], tileSize: 256, minzoom: 0, maxzoom: 17, attribution: '© OpenTopoMap · © OpenStreetMap contributors · SRTM' });
  map.addSource('bathymetry', { type: 'raster', tiles: [BATHYMETRY_TILES], tileSize: 256, minzoom: 0, maxzoom: 16, attribution: 'Ocean Basemap © Esri, GEBCO, NOAA and contributors' });
  map.addSource('reference-labels', { type: 'raster', tiles: [REFERENCE_LABEL_TILES], tileSize: 256, minzoom: 0, maxzoom: 16, attribution: 'Boundaries and places © Esri and contributors' });
  map.addSource('ocean-labels', { type: 'raster', tiles: [OCEAN_LABEL_TILES], tileSize: 256, minzoom: 0, maxzoom: 16, attribution: 'Ocean reference © Esri and contributors' });
  map.addSource('countries', { type: 'geojson', data: COUNTRIES_URL, attribution: 'Natural Earth' });
  map.addSource('places', { type: 'geojson', data: PLACES_URL, attribution: 'Natural Earth' });
  map.addSource('plate-boundaries', { type: 'geojson', data: `${import.meta.env.BASE_URL}data/plate-boundaries.json`, attribution: 'PB2002 · Peter Bird / Nordpil' });
  map.addSource('plate-orogens', { type: 'geojson', data: `${import.meta.env.BASE_URL}data/plate-orogens.json`, attribution: 'PB2002 · Peter Bird / Nordpil' });
  map.addSource('graticule', { type: 'geojson', data: graticuleGeoJson() as never });
  map.addSource('earthquakes', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('stations', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('volcanoes', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('wave', { type: 'geojson', data: asCollection([]) as never });

  map.addLayer({ id: 'satellite-base', type: 'raster', source: 'satellite', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100 } });
  map.addLayer({ id: 'relief-base', type: 'raster', source: 'relief', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100, 'raster-saturation': -0.12 } });
  map.addLayer({ id: 'bathymetry-base', type: 'raster', source: 'bathymetry', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100, 'raster-saturation': -0.08 } });
  map.addLayer({
    id: 'political-fill', type: 'fill', source: 'countries',
    paint: { 'fill-color': '#172633', 'fill-opacity': 0.99 },
  });
  map.addLayer({ id: 'political-border', type: 'line', source: 'countries', paint: { 'line-color': '#8ca4b6', 'line-opacity': 0.92, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.62, 5, 1.05, 12, 1.7] } as never });
  map.addLayer({ id: 'reference-label-layer', type: 'raster', source: 'reference-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 80 } });
  map.addLayer({ id: 'ocean-label-layer', type: 'raster', source: 'ocean-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 80 } });
  map.addLayer({ id: 'graticule-lines', type: 'line', source: 'graticule', layout: { visibility: 'none' }, paint: { 'line-color': '#405a5f', 'line-opacity': 0.22, 'line-width': 0.55 } });
  map.addLayer({ id: 'orogen-lines', type: 'line', source: 'plate-orogens', paint: { 'line-color': '#a91428', 'line-opacity': 0.64, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 1, 11, 1.75], 'line-dasharray': [2.4, 1.8] } as never });
  map.addLayer({ id: 'plate-lines', type: 'line', source: 'plate-boundaries', paint: { 'line-color': '#e12834', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.72, 5, 1.45, 11, 2.8] } as never });

  map.addLayer({ id: 'volcano-clusters', type: 'circle', source: 'volcanoes', filter: ['has', 'point_count'], paint: { 'circle-color': '#b84c35', 'circle-radius': ['step', ['get', 'point_count'], 7, 10, 10, 40, 14], 'circle-stroke-color': '#fff1df', 'circle-stroke-width': 1, 'circle-opacity': 0.86 } as never });
  map.addLayer({ id: 'volcano-cluster-count', type: 'symbol', source: 'volcanoes', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 9 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'volcano-points', type: 'circle', source: 'volcanoes', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#d55b37', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.8, 5, 3, 10, 4.8, 16, 6.2], 'circle-stroke-color': '#5d1716', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 10, 1.2] } as never });
  map.addLayer({ id: 'volcano-labels', type: 'symbol', source: 'volcanoes', minzoom: 4.2, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 12, 16, 14], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': '#f26a45', 'text-halo-color': 'rgba(8,15,18,.95)', 'text-halo-width': 1.5 } as never });

  map.addLayer({ id: 'station-cluster-halo', type: 'circle', source: 'stations', filter: ['has', 'point_count'], paint: { 'circle-color': '#2ee5d4', 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 250, 29], 'circle-opacity': 0.16, 'circle-blur': 0.35 } as never });
  map.addLayer({ id: 'station-clusters', type: 'circle', source: 'stations', filter: ['has', 'point_count'], paint: { 'circle-color': '#08736f', 'circle-radius': ['step', ['get', 'point_count'], 10, 10, 14, 50, 19, 250, 24], 'circle-stroke-color': '#c9fff8', 'circle-stroke-width': 1.4, 'circle-opacity': 0.94 } as never });
  map.addLayer({ id: 'station-cluster-count', type: 'symbol', source: 'stations', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 9 }, paint: { 'text-color': '#eafffb' } });
  map.addLayer({ id: 'station-selected', type: 'circle', source: 'stations', filter: ['==', ['get', 'stationId'], ''], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 10, 10, 16, 14], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': 0 } as never });
  map.addLayer({ id: 'station-points', type: 'circle', source: 'stations', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#31e0d0', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 4, 4.2, 8, 5.5, 12, 7.5, 18, 10], 'circle-opacity': 0.28, 'circle-blur': 0.3 } as never });
  map.addLayer({ id: 'station-icons', type: 'symbol', source: 'stations', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': 'station-node', 'icon-size': ['interpolate', ['linear'], ['zoom'], 0, .72, 6, .78, 12, .9, 20, 1.05], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-optional': false } as never });
  map.addLayer({ id: 'station-labels', type: 'symbol', source: 'stations', minzoom: 7, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['concat', ['get', 'network'], '.', ['get', 'code']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8, 12, 10, 18, 13], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': '#59e2d4', 'text-halo-color': 'rgba(5,18,21,.96)', 'text-halo-width': 1.5 } as never });

  map.addLayer({ id: 'earthquake-clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#f5b347', 10, '#f17b45', 50, '#e7454f', 250, '#b92842'], 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 19, 50, 25, 250, 32], 'circle-stroke-color': '#fff7ea', 'circle-stroke-width': 1.8, 'circle-opacity': 0.96 } as never });
  map.addLayer({ id: 'earthquake-cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 10 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'earthquake-halos', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': ['step', ['get', 'depth'], '#ff5c52', 35, '#ffad39', 70, '#4fc8ff', 300, '#a88cff'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 10, 2, 13, 4, 17, 6, 25, 8, 34], 8, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 13, 2, 17, 4, 23, 6, 33, 8, 47], 16, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 16, 2, 21, 4, 29, 6, 42, 8, 60]],
    'circle-opacity': ['interpolate', ['linear'], ['get', 'magnitude'], -2, .22, 3, .3, 6, .42], 'circle-blur': .34,
  } as never });
  map.addLayer({ id: 'earthquake-rings', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': 'rgba(0,0,0,0)',
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 8, 2, 11, 4, 15, 6, 21, 8, 29], 10, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 10, 2, 14, 4, 20, 6, 29, 8, 40], 20, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 12, 2, 17, 4, 24, 6, 36, 8, 50]],
    'circle-stroke-color': ['step', ['get', 'ageMinutes'], '#ff4f58', 60, '#ff9f3f', 1440, '#e0c74f', 10080, '#70bf8f'],
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 1.6, 10, 2.2, 20, 2.8],
    'circle-stroke-opacity': .96,
  } as never });
  map.addLayer({ id: 'earthquake-selected', type: 'circle', source: 'earthquakes', filter: ['==', ['get', 'eventId'], ''], paint: { 'circle-color': 'rgba(255,255,255,.08)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 9, 8, 18, 15, 26], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.2 } as never });
  map.addLayer({ id: 'earthquake-points', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': ['step', ['get', 'depth'], '#f06157', 35, '#f1a43c', 70, '#4caad6', 300, '#856bc6'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 5.5, 1, 7, 4, 10, 6, 15, 8, 22], 8, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 7.5, 1, 10, 4, 15, 6, 22, 8, 32], 16, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 9, 1, 13, 4, 19, 6, 29, 8, 42]],
    'circle-stroke-color': '#fff8ec', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 1.25, 10, 2], 'circle-opacity': 1,
  } as never });
  map.addLayer({ id: 'earthquake-labels', type: 'symbol', source: 'earthquakes', minzoom: 4.2, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['concat', ['get', 'reviewCode'], ' ', ['get', 'magLabel'], ['case', ['!=', ['get', 'roman'], ''], ['concat', ' · ', ['get', 'roman']], '']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 11, 16, 13], 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': '#fff8ec', 'text-halo-color': 'rgba(7,14,17,.96)', 'text-halo-width': 1.5 } as never });

  map.addLayer({ id: 'p-wave', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 'p'], paint: { 'line-color': '#4db9ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.4, 8, 2.1, 16, 2.8], 'line-opacity': 0 } as never });
  map.addLayer({ id: 's-wave', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 's'], paint: { 'line-color': '#ff6659', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.6, 8, 2.4, 16, 3.1], 'line-opacity': 0 } as never });

  map.addLayer({ id: 'country-labels', type: 'symbol', source: 'countries', minzoom: 0, maxzoom: 9, layout: { 'text-field': ['coalesce', ['get', 'NAME_ES'], ['get', 'ADMIN'], ['get', 'NAME']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 0, 8, 5, 12, 8, 15], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-allow-overlap': false }, paint: { 'text-color': '#253534', 'text-halo-color': 'rgba(244,244,226,.88)', 'text-halo-width': 1.4 } as never });
  map.addLayer({ id: 'place-labels', type: 'symbol', source: 'places', minzoom: 3, filter: ['<=', ['to-number', ['get', 'scalerank']], 7], layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 12, 14, 15], 'text-allow-overlap': false }, paint: { 'text-color': '#eaf6f5', 'text-halo-color': 'rgba(2,9,12,.95)', 'text-halo-width': 1.6 } as never });
}

export function GlobeView({
  events, stations, volcanoes, layers, mapStyle, selectedEvent, selectedStation,
  focusTarget, pulseEvent, onSelectEvent, onSelectStation,
}: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const eventsRef = useRef(events);
  const stationsByIdRef = useRef(new Map(stations.map((station) => [station.id, station])));
  const onSelectEventRef = useRef(onSelectEvent);
  const onSelectStationRef = useRef(onSelectStation);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!hasWebGL());
  const [zoom, setZoom] = useState(1);
  const [bearing, setBearing] = useState(0);
  eventsRef.current = events;
  onSelectEventRef.current = onSelectEvent;
  onSelectStationRef.current = onSelectStation;

  useEffect(() => {
    stationsByIdRef.current = new Map(stations.map((station) => [station.id, station]));
  }, [stations]);

  useEffect(() => {
    if (!hostRef.current || failed || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: hostRef.current, style: createStyle(), center: [3, 27], zoom: 1.05,
        minZoom: 0.15, maxZoom: 20, maxPitch: 76, pitch: 0, bearing: 0,
        renderWorldCopies: false, attributionControl: false, cooperativeGestures: false, fadeDuration: 100,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      map.scrollZoom.setWheelZoomRate(1 / 290);
      map.on('load', () => {
        map.setProjection({ type: 'globe' });
        addSourceAndLayers(map);
        setReady(true);
        setZoom(map.getZoom());
        map.on('zoom', () => setZoom(map.getZoom()));
        map.on('rotate', () => setBearing(map.getBearing()));
        map.on('click', 'earthquake-points', (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.eventId;
          const item = eventsRef.current.find((candidate) => candidate.id === id);
          if (item) onSelectEventRef.current(item);
        });
        const selectStationFeature = (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.stationId;
          const item = stationsByIdRef.current.get(id);
          if (item) onSelectStationRef.current(item);
        };
        map.on('click', 'station-points', selectStationFeature);
        map.on('click', 'station-icons', selectStationFeature);
        map.on('click', 'volcano-points', (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          new maplibregl.Popup({ closeButton: true, offset: 8 })
            .setLngLat(coordinates)
            .setHTML(`<div class="map-popup"><b>${String(feature.properties?.name || 'Volcán')}</b><span>${String(feature.properties?.country || '')}</span><small>${String(feature.properties?.volcanoType || 'Catálogo Smithsonian GVP')}</small></div>`)
            .addTo(map);
        });
        const stationHover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
        map.on('mousemove', 'station-icons', (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          const content = document.createElement('div');
          content.className = 'map-popup station-hover-popup';
          const title = document.createElement('b');
          title.textContent = `${String(feature.properties?.network || '')}.${String(feature.properties?.code || '')}`;
          const name = document.createElement('span');
          name.textContent = String(feature.properties?.name || 'Estación sísmica');
          const source = document.createElement('small');
          source.textContent = `${String(feature.properties?.country || '—')} · ${String(feature.properties?.source || 'FDSN')}`;
          content.append(title, name, source);
          stationHover.setLngLat(coordinates).setDOMContent(content).addTo(map);
        });
        map.on('mouseleave', 'station-icons', () => stationHover.remove());
        for (const layerId of ['earthquake-points', 'station-points', 'station-icons', 'volcano-points']) {
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        }
      });
      const observer = new ResizeObserver(() => map.resize());
      observer.observe(hostRef.current);
      return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
    } catch { setFailed(true); }
  }, [failed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('earthquakes') as GeoJSONSource).setData(earthquakeGeoJson(events) as never);
  }, [events, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('stations') as GeoJSONSource).setData(stationGeoJson(stations) as never);
  }, [stations, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('volcanoes') as GeoJSONSource).setData(volcanoGeoJson(volcanoes) as never);
  }, [volcanoes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setVisibility(map, ['political-fill', 'political-border'], mapStyle === 'political');
    setVisibility(map, ['satellite-base'], mapStyle === 'satellite');
    setVisibility(map, ['relief-base'], mapStyle === 'relief');
    setVisibility(map, ['bathymetry-base'], mapStyle === 'bathymetry');
    map.setPaintProperty('space', 'background-color', mapStyle === 'political' ? '#010205' : '#050a0f');
    const flat = mapStyle === 'political';
    map.setPaintProperty('country-labels', 'text-color', flat ? '#253534' : '#f4f7f5');
    map.setPaintProperty('country-labels', 'text-halo-color', flat ? 'rgba(244,244,226,.9)' : 'rgba(2,9,12,.95)');
    map.setPaintProperty('place-labels', 'text-color', flat ? '#354746' : '#eaf6f5');
    map.setPaintProperty('place-labels', 'text-halo-color', flat ? 'rgba(244,244,226,.92)' : 'rgba(2,9,12,.95)');
  }, [mapStyle, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setVisibility(map, ['earthquake-clusters', 'earthquake-cluster-count', 'earthquake-halos', 'earthquake-rings', 'earthquake-points', 'earthquake-labels', 'earthquake-selected', 'p-wave', 's-wave'], layers.earthquakes);
    setVisibility(map, ['station-cluster-halo', 'station-clusters', 'station-cluster-count', 'station-points', 'station-icons', 'station-labels', 'station-selected'], layers.stations);
    setVisibility(map, ['plate-lines', 'orogen-lines'], layers.plates);
    setVisibility(map, ['volcano-clusters', 'volcano-cluster-count', 'volcano-points', 'volcano-labels'], layers.volcanoes);
    setVisibility(map, ['reference-label-layer'], layers.labels && (mapStyle === 'political' || mapStyle === 'satellite'));
    setVisibility(map, ['ocean-label-layer'], layers.labels && mapStyle === 'bathymetry');
    setVisibility(map, ['country-labels', 'place-labels'], false);
    setVisibility(map, ['graticule-lines'], layers.graticule);
  }, [layers, mapStyle, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusTarget) return;
    const targetZoom = focusTarget.altitude !== undefined && focusTarget.altitude <= 1 ? 10 : focusTarget.altitude !== undefined && focusTarget.altitude <= 1.4 ? 7.8 : 1.05;
    map.easeTo({ center: [focusTarget.lng, focusTarget.lat], zoom: targetZoom, pitch: targetZoom > 5 ? 28 : 0, duration: 1200, essential: true });
  }, [focusTarget, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('earthquake-selected', ['==', ['get', 'eventId'], selectedEvent?.id ?? '']);
    map.setFilter('station-selected', ['==', ['get', 'stationId'], selectedStation?.id ?? '']);
  }, [selectedEvent, selectedStation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const wave = pulseEvent ?? selectedEvent;
    const source = map.getSource('wave') as GeoJSONSource;
    if (!wave) {
      source.setData(asCollection([]) as never);
      map.setPaintProperty('p-wave', 'line-opacity', 0);
      map.setPaintProperty('s-wave', 'line-opacity', 0);
      return;
    }
    let frame = 0;
    let lastUpdate = 0;
    const started = performance.now();
    const maxRadiusKm = Math.max(120, Math.min(1350, 160 + Math.max(0, wave.magnitude) * 140));
    const animate = (time: number) => {
      if (time - lastUpdate >= 40) {
        const cycle = ((time - started) % 10_000) / 10_000;
        const p = Math.min(1, cycle * 1.35);
        const s = Math.min(1, cycle * .9);
        source.setData(waveCollection(wave, p * maxRadiusKm, s * maxRadiusKm) as never);
        map.setPaintProperty('p-wave', 'line-opacity', Math.max(0, .78 * (1 - p)));
        map.setPaintProperty('s-wave', 'line-opacity', Math.max(0, .9 * (1 - s)));
        lastUpdate = time;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      source.setData(asCollection([]) as never);
    };
  }, [pulseEvent, selectedEvent, ready]);

  if (failed) return <div className="webgl-fallback" role="status"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><p className="eyebrow">MODO DE COMPATIBILIDAD</p><h2>El globo 3D necesita WebGL</h2><p>Los datos y el historial siguen disponibles. Activa la aceleración gráfica para abrir la cartografía científica.</p></div>;

  return <div className="globe-host" aria-label="Globo sísmico tridimensional">
    <div ref={hostRef} className="maplibre-host" />
    {layers.atmosphere && <div className="atmosphere-overlay" aria-hidden="true" />}
    <div className="orientation-controls" aria-label="Orientación del globo">
      <button onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 })} title="Norte arriba" aria-label="Poner el norte arriba"><Compass size={18} style={{ transform: `rotate(${-bearing}deg)` }} /><span>N</span></button>
    </div>
    <div className="globe-corner-scale" aria-hidden="true">
      <span>PROFUNDIDAD</span><i style={{ background: '#f06157' }} />0–35<i style={{ background: '#f1a43c' }} />35–70<i style={{ background: '#4caad6' }} />70–300<i style={{ background: '#856bc6' }} />300+ km
      <span className="tectonic-key"><i className="plate-solid" />LÍMITE<i className="plate-diffuse" />ZONA DIFUSA</span>
      <b>ZOOM {zoom.toFixed(1)}</b>
    </div>
  </div>;
}
