import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from 'maplibre-gl';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Earthquake, MapLayerState, MapStyle, SeismicStation, Volcano } from '../types';
import { waveRadiusKm } from '../services/travelTimes';
import { estimateIntensityZones } from '../services/shakeMap';

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
  focusTarget: { lat: number; lng: number; altitude?: number; cinematic?: boolean; token: number } | null;
  pulseEvent: Earthquake | null;
  waveSpeed: number;
  wavePaused: boolean;
  onSelectEvent: (event: Earthquake) => void;
  onSelectStation: (station: SeismicStation) => void;
}

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: { type: 'Point' | 'LineString' | 'Polygon'; coordinates: unknown }; properties: Record<string, unknown> }>;
};

type ResolvedTheme = 'morning' | 'afternoon' | 'night';

const GLOBE_THEME = {
  morning: {
    space: '#c8dcdf',
    politicalFill: '#d7dfd0',
    politicalBorder: '#678783',
    label: '#253534',
    labelHalo: 'rgba(244,248,241,.92)',
    volcanoFill: '#b94732',
    volcanoStroke: '#f5ddd4',
    volcanoLabel: '#8f3024',
    volcanoLabelHalo: 'rgba(244,248,241,.94)',
    volcanoActivity: '#c73f28',
    globeOutline: 'rgba(61,91,89,.9)',
  },
  afternoon: {
    space: '#463942',
    politicalFill: '#394746',
    politicalBorder: '#c0a98f',
    label: '#f2e9dc',
    labelHalo: 'rgba(34,25,27,.92)',
    volcanoFill: '#ed704d',
    volcanoStroke: '#ffe0ca',
    volcanoLabel: '#ff936f',
    volcanoLabelHalo: 'rgba(34,25,27,.94)',
    volcanoActivity: '#ffb07b',
    globeOutline: 'rgba(235,214,187,.82)',
  },
  night: {
    space: '#050a0f',
    politicalFill: '#172633',
    politicalBorder: '#8ca4b6',
    label: '#f4f7f5',
    labelHalo: 'rgba(2,9,12,.95)',
    volcanoFill: '#df5a3f',
    volcanoStroke: '#ffddcb',
    volcanoLabel: '#ff7b5c',
    volcanoLabelHalo: 'rgba(2,9,12,.96)',
    volcanoActivity: '#ffb088',
    globeOutline: 'rgba(174,205,218,.82)',
  },
} satisfies Record<ResolvedTheme, Record<string, string>>;

function currentResolvedTheme(): ResolvedTheme {
  const value = document.documentElement.dataset.theme;
  return value === 'morning' || value === 'afternoon' ? value : 'night';
}

function createStyle(backgroundColor = GLOBE_THEME.night.space): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sky: { 'atmosphere-blend': 0 },
    sources: {},
    layers: [{ id: 'space', type: 'background', paint: { 'background-color': backgroundColor } }],
  };
}

function asCollection(features: FeatureCollection['features']): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function earthquakeGeoJson(events: Earthquake[]): FeatureCollection {
  return asCollection(events.map((event) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
    properties: {
      eventId: event.id, magnitude: event.magnitude, magnitudeText: event.magnitude.toFixed(1), magLabel: `M${event.magnitude.toFixed(1)}`,
      depth: event.depthKm, place: event.place, reviewCode: event.reviewCode,
      roman: event.intensity ? toRomanIntensity(event.intensity) : '', source: event.source,
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
    properties: {
      volcanoId: volcano.id, name: volcanoDisplayName(volcano), catalogueName: volcano.name, country: volcano.country,
      volcanoType: volcano.volcanoType || '', elevationM: volcano.elevationM,
      status: volcano.status, region: volcano.region || '', lastEruptionYear: volcano.lastEruptionYear || '',
      weeklyActivity: volcano.weeklyActivity || '', weeklyActivityLabel: volcano.weeklyActivityLabel || '',
      weeklyReportPeriod: volcano.weeklyReportPeriod || '', weeklyReportUpdatedAt: volcano.weeklyReportUpdatedAt || '',
      weeklyReportUrl: volcano.weeklyReportUrl || '',
    },
  })));
}

const volcanoDisplayNames: Record<string, string> = {
  '383010': 'La Palma — Cumbre Vieja',
  '383020': 'El Hierro — sistema volcánico insular',
  '383030': 'Tenerife — Teide–Pico Viejo',
  '383040': 'Gran Canaria — Bandama / El Garañón',
  '383050': 'Fuerteventura — campo volcánico insular',
  '383060': 'Lanzarote — Timanfaya / Tao–Nuevo del Fuego',
};

function volcanoDisplayName(volcano: Volcano) {
  return volcanoDisplayNames[volcano.id] ?? volcano.name;
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

function waveCollection(origin: { lat: number; lng: number }, pRadiusKm: number, sRadiusKm: number, surfaceRadiusKm: number): FeatureCollection {
  const ring = (radiusKm: number) => Array.from({ length: 121 }, (_, index) => destinationPoint(origin, index * 3, radiusKm));
  const features: FeatureCollection['features'] = [];
  if (pRadiusKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring(pRadiusKm) }, properties: { waveType: 'p' } });
  if (sRadiusKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring(sRadiusKm) }, properties: { waveType: 's' } });
  if (surfaceRadiusKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring(surfaceRadiusKm) }, properties: { waveType: 'surface' } });
  return asCollection(features);
}

function shakeMapCollection(event: Earthquake | null): FeatureCollection {
  if (!event) return asCollection([]);
  return asCollection(estimateIntensityZones(event).map((zone) => {
    const ring = Array.from({ length: 121 }, (_, index) => destinationPoint(event, index * 3, zone.radiusKm));
    ring.push(ring[0]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { intensity: zone.intensity, color: zone.color, label: zone.label } };
  }));
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

function globeOutlineGeoJson(center: { lat: number; lng: number }): FeatureCollection {
  const horizonDistanceKm = 6371.0088 * Math.PI * .4975;
  const coordinates = Array.from({ length: 181 }, (_, index) => destinationPoint(center, index * 2, horizonDistanceKm));
  coordinates.push(coordinates[0]);
  return asCollection([{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }]);
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
  map.addSource('globe-outline', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('earthquakes', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('stations', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('volcanoes', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('wave', { type: 'geojson', data: asCollection([]) as never });
  map.addSource('shakemap', { type: 'geojson', data: asCollection([]) as never });

  map.addLayer({ id: 'satellite-base', type: 'raster', source: 'satellite', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  map.addLayer({ id: 'relief-base', type: 'raster', source: 'relief', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0, 'raster-saturation': -0.12 } });
  map.addLayer({ id: 'bathymetry-base', type: 'raster', source: 'bathymetry', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0, 'raster-saturation': -0.08 } });
  map.addLayer({
    id: 'political-fill', type: 'fill', source: 'countries',
    paint: { 'fill-color': '#172633', 'fill-opacity': 0.99 },
  });
  map.addLayer({ id: 'political-border', type: 'line', source: 'countries', paint: { 'line-color': '#8ca4b6', 'line-opacity': 0.92, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.62, 5, 1.05, 12, 1.7] } as never });
  map.addLayer({ id: 'globe-outline-line', type: 'line', source: 'globe-outline', layout: { visibility: 'none' }, paint: { 'line-color': 'rgba(174,205,218,.82)', 'line-opacity': .92, 'line-width': 1.05, 'line-blur': .08 } });
  map.addLayer({ id: 'reference-label-layer', type: 'raster', source: 'reference-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } });
  map.addLayer({ id: 'ocean-label-layer', type: 'raster', source: 'ocean-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } });
  map.addLayer({ id: 'graticule-lines', type: 'line', source: 'graticule', layout: { visibility: 'none' }, paint: { 'line-color': '#405a5f', 'line-opacity': 0.22, 'line-width': 0.55 } });
  map.addLayer({ id: 'orogen-lines', type: 'line', source: 'plate-orogens', paint: { 'line-color': '#a91428', 'line-opacity': 0.64, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 1, 11, 1.75], 'line-dasharray': [2.4, 1.8] } as never });
  map.addLayer({ id: 'plate-lines', type: 'line', source: 'plate-boundaries', paint: { 'line-color': '#e12834', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.72, 5, 1.45, 11, 2.8] } as never });

  map.addLayer({ id: 'shakemap-fill', type: 'fill', source: 'shakemap', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 2, .08, 6, .15, 10, .25] } as never });
  map.addLayer({ id: 'shakemap-outline', type: 'line', source: 'shakemap', paint: { 'line-color': ['get', 'color'], 'line-opacity': .58, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, .55, 8, 1.35, 16, 2] } as never });

  map.addLayer({ id: 'volcano-clusters', type: 'circle', source: 'volcanoes', filter: ['has', 'point_count'], paint: { 'circle-color': '#b84c35', 'circle-radius': ['step', ['get', 'point_count'], 7, 10, 10, 40, 14], 'circle-stroke-color': '#fff1df', 'circle-stroke-width': 1, 'circle-opacity': 0.86 } as never });
  map.addLayer({ id: 'volcano-cluster-count', type: 'symbol', source: 'volcanoes', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 9 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'volcano-weekly-rings', type: 'circle', source: 'volcanoes', filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'weeklyActivity'], '']], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 4.8, 5, 7, 10, 10, 16, 12.5], 'circle-stroke-color': '#ffb088', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1.7], 'circle-stroke-opacity': .96 } as never });
  map.addLayer({ id: 'volcano-new-activity-rings', type: 'circle', source: 'volcanoes', filter: ['all', ['!', ['has', 'point_count']], ['in', ['get', 'weeklyActivity'], ['literal', ['new-eruption', 'new-unrest']]]], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 7, 5, 10, 10, 14, 16, 17], 'circle-stroke-color': '#ffb088', 'circle-stroke-width': .75, 'circle-stroke-opacity': .6 } as never });
  map.addLayer({ id: 'volcano-points', type: 'circle', source: 'volcanoes', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#d55b37', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.8, 5, 3, 10, 4.8, 16, 6.2], 'circle-stroke-color': '#5d1716', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 10, 1.2] } as never });
  map.addLayer({ id: 'volcano-labels', type: 'symbol', source: 'volcanoes', minzoom: 4.2, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 12, 16, 14], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': '#f26a45', 'text-halo-color': 'rgba(8,15,18,.95)', 'text-halo-width': 1.5 } as never });

  map.addLayer({ id: 'station-cluster-halo', type: 'circle', source: 'stations', filter: ['has', 'point_count'], paint: { 'circle-color': '#2ee5d4', 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 250, 29], 'circle-opacity': 0.16, 'circle-blur': 0.35 } as never });
  map.addLayer({ id: 'station-clusters', type: 'circle', source: 'stations', filter: ['has', 'point_count'], paint: { 'circle-color': '#08736f', 'circle-radius': ['step', ['get', 'point_count'], 10, 10, 14, 50, 19, 250, 24], 'circle-stroke-color': '#c9fff8', 'circle-stroke-width': 1.4, 'circle-opacity': 0.94 } as never });
  map.addLayer({ id: 'station-cluster-count', type: 'symbol', source: 'stations', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 9 }, paint: { 'text-color': '#eafffb' } });
  map.addLayer({ id: 'station-selected', type: 'circle', source: 'stations', filter: ['==', ['get', 'stationId'], ''], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 10, 10, 16, 14], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': 0 } as never });
  map.addLayer({ id: 'station-points', type: 'circle', source: 'stations', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['case', ['==', ['get', 'status'], 'online'], '#31e0d0', '#83989c'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 4, 4.2, 8, 5.5, 12, 7.5, 18, 10], 'circle-opacity': ['case', ['==', ['get', 'status'], 'online'], .28, .15], 'circle-blur': 0.3 } as never });
  map.addLayer({ id: 'station-icons', type: 'symbol', source: 'stations', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': 'station-node', 'icon-size': ['interpolate', ['linear'], ['zoom'], 0, .72, 6, .78, 12, .9, 20, 1.05], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-optional': false }, paint: { 'icon-opacity': ['case', ['==', ['get', 'status'], 'online'], 1, .48] } as never });
  map.addLayer({ id: 'station-labels', type: 'symbol', source: 'stations', minzoom: 7, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['concat', ['get', 'network'], '.', ['get', 'code']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8, 12, 10, 18, 13], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': ['case', ['==', ['get', 'status'], 'online'], '#59e2d4', '#9babad'], 'text-halo-color': 'rgba(5,18,21,.96)', 'text-halo-width': 1.5 } as never });

  map.addLayer({ id: 'earthquake-clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#f5b347', 10, '#f17b45', 50, '#e7454f', 250, '#b92842'], 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 19, 50, 25, 250, 32], 'circle-stroke-color': '#fff7ea', 'circle-stroke-width': 1.8, 'circle-opacity': 0.96 } as never });
  map.addLayer({ id: 'earthquake-cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 10 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'earthquake-halos', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': ['step', ['get', 'magnitude'], '#4aa9cf', 1, '#60bf81', 3, '#e7c449', 5, '#f08a3f', 6, '#e65348', 7, '#aa2c50'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 10, 2, 13, 4, 17, 6, 25, 8, 34], 8, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 13, 2, 17, 4, 23, 6, 33, 8, 47], 16, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 16, 2, 21, 4, 29, 6, 42, 8, 60]],
    'circle-opacity': ['interpolate', ['linear'], ['get', 'magnitude'], -2, .22, 3, .3, 6, .42], 'circle-blur': .34,
  } as never });
  map.addLayer({ id: 'earthquake-rings', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': 'rgba(0,0,0,0)',
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 8, 2, 11, 4, 15, 6, 21, 8, 29], 10, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 10, 2, 14, 4, 20, 6, 29, 8, 40], 20, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 12, 2, 17, 4, 24, 6, 36, 8, 50]],
    'circle-stroke-color': ['step', ['get', 'depth'], '#f06157', 35, '#f1a43c', 70, '#4caad6', 300, '#856bc6'],
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 10, 2.8, 20, 3.6],
    'circle-stroke-opacity': .96,
  } as never });
  map.addLayer({ id: 'earthquake-selected', type: 'circle', source: 'earthquakes', filter: ['==', ['get', 'eventId'], ''], paint: { 'circle-color': 'rgba(255,255,255,.08)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 9, 8, 18, 15, 26], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.2 } as never });
  map.addLayer({ id: 'earthquake-points', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': ['step', ['get', 'magnitude'], '#4aa9cf', 1, '#60bf81', 3, '#e7c449', 5, '#f08a3f', 6, '#e65348', 7, '#aa2c50'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 5.5, 1, 7, 4, 10, 6, 15, 8, 22], 8, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 7.5, 1, 10, 4, 15, 6, 22, 8, 32], 16, ['interpolate', ['linear'], ['get', 'magnitude'], -2, 9, 1, 13, 4, 19, 6, 29, 8, 42]],
    'circle-stroke-width': 0, 'circle-opacity': 1,
  } as never });
  map.addLayer({ id: 'earthquake-labels', type: 'symbol', source: 'earthquakes', minzoom: 3.6, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'magnitudeText'], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3.6, 7.5, 9, 9.5, 16, 12], 'text-anchor': 'center', 'text-optional': true, 'text-allow-overlap': false }, paint: { 'text-color': ['case', ['<', ['get', 'magnitude'], 5], '#132326', '#ffffff'], 'text-halo-color': 'rgba(255,255,255,.16)', 'text-halo-width': .5 } as never });

  map.addLayer({ id: 'p-wave-halo', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 'p'], paint: { 'line-color': '#4db9ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 7, 8, 10, 16, 14], 'line-blur': 5, 'line-opacity': 0 } as never });
  map.addLayer({ id: 's-wave-halo', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 's'], paint: { 'line-color': '#ff6659', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 8, 8, 11, 16, 15], 'line-blur': 5, 'line-opacity': 0 } as never });
  map.addLayer({ id: 'surface-wave-halo', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 'surface'], paint: { 'line-color': '#ffd05a', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 7, 8, 10, 16, 14], 'line-blur': 5, 'line-opacity': 0 } as never });
  map.addLayer({ id: 'p-wave', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 'p'], paint: { 'line-color': '#a8e2ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2.4, 8, 3.3, 16, 4.2], 'line-opacity': 0 } as never });
  map.addLayer({ id: 's-wave', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 's'], paint: { 'line-color': '#ff8a80', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2.6, 8, 3.6, 16, 4.5], 'line-opacity': 0 } as never });
  map.addLayer({ id: 'surface-wave', type: 'line', source: 'wave', filter: ['==', ['get', 'waveType'], 'surface'], paint: { 'line-color': '#ffe08a', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 8, 3.2, 16, 4.2], 'line-dasharray': [2, 1.4], 'line-opacity': 0 } as never });

  map.addLayer({ id: 'country-labels', type: 'symbol', source: 'countries', minzoom: 0, maxzoom: 9, layout: { 'text-field': ['coalesce', ['get', 'NAME_ES'], ['get', 'ADMIN'], ['get', 'NAME']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 0, 8, 5, 12, 8, 15], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-allow-overlap': false }, paint: { 'text-color': '#253534', 'text-halo-color': 'rgba(244,244,226,.88)', 'text-halo-width': 1.4 } as never });
  map.addLayer({ id: 'place-labels', type: 'symbol', source: 'places', minzoom: 3, filter: ['<=', ['to-number', ['get', 'scalerank']], 7], layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'nameascii']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 12, 14, 15], 'text-allow-overlap': false }, paint: { 'text-color': '#eaf6f5', 'text-halo-color': 'rgba(2,9,12,.95)', 'text-halo-width': 1.6 } as never });
}

export function GlobeView({
  events, stations, volcanoes, layers, mapStyle, selectedEvent, selectedStation,
  focusTarget, pulseEvent, waveSpeed, wavePaused, onSelectEvent, onSelectStation,
}: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const eventsRef = useRef(events);
  const stationsByIdRef = useRef(new Map(stations.map((station) => [station.id, station])));
  const onSelectEventRef = useRef(onSelectEvent);
  const onSelectStationRef = useRef(onSelectStation);
  const cameraTimersRef = useRef<number[]>([]);
  const contextLostRef = useRef(false);
  const recoveryTimerRef = useRef(0);
  const waveClockRef = useRef({ eventId: '', simulatedSeconds: 0, fadeStartedAt: 0, restartAt: 0 });
  const compactRendererRef = useRef(window.matchMedia('(max-width: 900px), (pointer: coarse)').matches);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!hasWebGL());
  const [contextLost, setContextLost] = useState(false);
  const [rendererRevision, setRendererRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(currentResolvedTheme);
  eventsRef.current = events;
  onSelectEventRef.current = onSelectEvent;
  onSelectStationRef.current = onSelectStation;

  useEffect(() => {
    stationsByIdRef.current = new Map(stations.map((station) => [station.id, station]));
  }, [stations]);

  useEffect(() => {
    const observer = new MutationObserver(() => setResolvedTheme(currentResolvedTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    setResolvedTheme(currentResolvedTheme());
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hostRef.current || failed || mapRef.current) return;
    try {
      const compactRenderer = compactRendererRef.current;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, compactRenderer ? 1.35 : 2);
      const map = new maplibregl.Map({
        container: hostRef.current, style: createStyle(GLOBE_THEME[currentResolvedTheme()].space), center: [3, 27], zoom: 1.05,
        minZoom: 0.15, maxZoom: 20, maxPitch: 76, pitch: 0, bearing: 0,
        renderWorldCopies: false, attributionControl: false, cooperativeGestures: false, fadeDuration: 0,
        pixelRatio,
        maxCanvasSize: compactRenderer ? [2048, 2048] : [4096, 4096],
        maxTileCacheSize: compactRenderer ? 120 : 320,
        cancelPendingTileRequestsWhileZooming: false,
        trackResize: false,
        canvasContextAttributes: {
          antialias: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
          desynchronized: false,
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      const collapseAttribution = () => {
        const attribution = hostRef.current?.querySelector('.maplibregl-ctrl-attrib');
        if (attribution instanceof HTMLDetailsElement) attribution.open = false;
        attribution?.classList.remove('maplibregl-compact-show');
        attribution?.querySelector('button, summary')?.setAttribute('aria-expanded', 'false');
      };
      window.requestAnimationFrame(collapseAttribution);
      map.scrollZoom.setWheelZoomRate(1 / 290);
      map.on('load', () => {
        map.setProjection({ type: 'globe' });
        addSourceAndLayers(map);
        collapseAttribution();
        setReady(true);
        setZoom(map.getZoom());
        map.on('zoomend', () => setZoom(map.getZoom()));
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
          const content = document.createElement('div');
          content.className = 'map-popup volcano-popup';
          const weeklyActivity = String(feature.properties?.weeklyActivity || '');
          const heading = document.createElement('div');
          heading.className = 'volcano-popup-heading';
          const symbol = document.createElement('i');
          if (weeklyActivity) symbol.className = 'reported';
          const identity = document.createElement('div');
          const title = document.createElement('b');
          title.textContent = String(feature.properties?.name || 'Volcán catalogado');
          const location = document.createElement('span');
          location.textContent = [feature.properties?.region, feature.properties?.country].filter(Boolean).map(String).join(' · ');
          identity.append(title, location);
          heading.append(symbol, identity);
          const activity = document.createElement('div');
          activity.className = `volcano-popup-activity ${weeklyActivity ? 'reported' : 'catalogued'}`;
          const activityMark = document.createElement('i');
          const activityCopy = document.createElement('span');
          const activityTitle = document.createElement('strong');
          activityTitle.textContent = weeklyActivity ? ({
            'new-eruption': 'NUEVA ACTIVIDAD ERUPTIVA',
            'continuing-eruption': 'ACTIVIDAD ERUPTIVA CONTINUADA',
            'new-unrest': 'NUEVA INESTABILIDAD VOLCÁNICA',
            'continuing-unrest': 'INESTABILIDAD VOLCÁNICA CONTINUADA',
            other: 'ACTIVIDAD VOLCÁNICA REPORTADA',
          }[weeklyActivity] || 'ACTIVIDAD VOLCÁNICA REPORTADA') : 'SIN ACTIVIDAD SEMANAL REPORTADA';
          const activityPeriod = document.createElement('small');
          activityPeriod.textContent = weeklyActivity ? `Smithsonian/USGS · ${String(feature.properties?.weeklyReportPeriod || 'informe semanal')}` : 'Volcán holoceno del catálogo GVP';
          activityCopy.append(activityTitle, activityPeriod);
          activity.append(activityMark, activityCopy);
          const facts = document.createElement('div');
          facts.className = 'volcano-popup-facts';
          const addFact = (label: string, value: string) => {
            const row = document.createElement('span');
            const key = document.createElement('small'); key.textContent = label;
            const fact = document.createElement('strong'); fact.textContent = value;
            row.append(key, fact); facts.append(row);
          };
          addFact('TIPO', String(feature.properties?.volcanoType || 'Sin clasificar'));
          addFact('ELEVACIÓN', `${Number(feature.properties?.elevationM || 0).toLocaleString('es-ES')} m`);
          addFact('ÚLTIMA ERUPCIÓN', feature.properties?.lastEruptionYear ? String(feature.properties.lastEruptionYear) : 'Sin fecha catalogada');
          const source = document.createElement(weeklyActivity ? 'a' : 'small');
          source.className = 'volcano-popup-source';
          source.textContent = weeklyActivity ? 'Abrir informe semanal Smithsonian/USGS ↗' : 'Smithsonian Global Volcanism Program · volcán holoceno catalogado';
          if (source instanceof HTMLAnchorElement) {
            source.href = String(feature.properties?.weeklyReportUrl || 'https://volcano.si.edu/reports_weekly.cfm');
            source.target = '_blank';
            source.rel = 'noreferrer';
          }
          content.append(heading, activity, facts, source);
          new maplibregl.Popup({ closeButton: true, offset: 8, maxWidth: '250px', className: 'volcano-card-popup' })
            .setLngLat(coordinates)
            .setDOMContent(content)
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
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        contextLostRef.current = true;
        setReady(false);
        setContextLost(true);
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = window.setTimeout(() => {
          if (!contextLostRef.current) return;
          setContextLost(false);
          setRendererRevision((revision) => revision + 1);
        }, 4_500);
      };
      const handleContextRestored = () => {
        contextLostRef.current = false;
        window.clearTimeout(recoveryTimerRef.current);
        setContextLost(false);
        setReady(true);
        window.requestAnimationFrame(() => { map.resize(); map.triggerRepaint(); });
      };
      const canvas = map.getCanvas();
      let lastRightClickAt = 0;
      let northTimer = 0;
      const resetNorth = () => map.easeTo({ bearing: 0, pitch: 0, duration: 650, essential: true });
      const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        if (compactRenderer) return;
        const now = performance.now();
        if (now - lastRightClickAt <= 450) {
          lastRightClickAt = 0;
          resetNorth();
        } else lastRightClickAt = now;
      };
      const clearNorthTimer = () => window.clearTimeout(northTimer);
      const scheduleMobileNorth = () => {
        clearNorthTimer();
        if (!compactRenderer) return;
        northTimer = window.setTimeout(() => {
          if (Math.abs(map.getBearing()) > .1 || Math.abs(map.getPitch()) > .1) resetNorth();
        }, 10_000);
      };
      canvas.addEventListener('contextmenu', handleContextMenu);
      if (compactRenderer) {
        map.on('movestart', clearNorthTimer);
        map.on('moveend', scheduleMobileNorth);
      }
      canvas.addEventListener('webglcontextlost', handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
      let resizeFrame = 0;
      let previousWidth = Math.round(hostRef.current!.getBoundingClientRect().width);
      let previousHeight = Math.round(hostRef.current!.getBoundingClientRect().height);
      const observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (Math.abs(width - previousWidth) < 2 && Math.abs(height - previousHeight) < 2) return;
        previousWidth = width;
        previousHeight = height;
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          if (!contextLostRef.current) map.resize();
        });
      });
      observer.observe(hostRef.current);
      const resumeRenderer = () => {
        if (document.hidden || contextLostRef.current) return;
        window.requestAnimationFrame(() => { map.resize(); map.triggerRepaint(); collapseAttribution(); });
      };
      document.addEventListener('visibilitychange', resumeRenderer);
      window.addEventListener('pageshow', resumeRenderer);
      window.addEventListener('orientationchange', resumeRenderer);
      return () => {
        observer.disconnect();
        window.cancelAnimationFrame(resizeFrame);
        window.clearTimeout(recoveryTimerRef.current);
        clearNorthTimer();
        cameraTimersRef.current.forEach(window.clearTimeout);
        cameraTimersRef.current = [];
        contextLostRef.current = false;
        document.removeEventListener('visibilitychange', resumeRenderer);
        window.removeEventListener('pageshow', resumeRenderer);
        window.removeEventListener('orientationchange', resumeRenderer);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        canvas.removeEventListener('contextmenu', handleContextMenu);
        if (compactRenderer) {
          map.off('movestart', clearNorthTimer);
          map.off('moveend', scheduleMobileNorth);
        }
        try { map.remove(); } catch { /* El navegador puede haber invalidado ya el contexto. */ }
        mapRef.current = null;
      };
    } catch { setFailed(true); }
  }, [failed, rendererRevision]);

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
    const palette = GLOBE_THEME[resolvedTheme];
    map.setPaintProperty('space', 'background-color', palette.space);
    map.setPaintProperty('political-fill', 'fill-color', palette.politicalFill);
    map.setPaintProperty('political-border', 'line-color', palette.politicalBorder);
    const flat = mapStyle === 'political';
    map.setSky({ 'atmosphere-blend': 0 });
    map.setPaintProperty('globe-outline-line', 'line-color', palette.globeOutline);
    map.setPaintProperty('volcano-clusters', 'circle-color', palette.volcanoFill);
    map.setPaintProperty('volcano-clusters', 'circle-stroke-color', palette.volcanoStroke);
    map.setPaintProperty('volcano-points', 'circle-color', palette.volcanoFill);
    map.setPaintProperty('volcano-points', 'circle-stroke-color', palette.volcanoStroke);
    map.setPaintProperty('volcano-weekly-rings', 'circle-stroke-color', palette.volcanoActivity);
    map.setPaintProperty('volcano-new-activity-rings', 'circle-stroke-color', palette.volcanoActivity);
    map.setPaintProperty('volcano-labels', 'text-color', palette.volcanoLabel);
    map.setPaintProperty('volcano-labels', 'text-halo-color', palette.volcanoLabelHalo);
    map.setPaintProperty('country-labels', 'text-color', flat ? palette.label : '#f4f7f5');
    map.setPaintProperty('country-labels', 'text-halo-color', flat ? palette.labelHalo : 'rgba(2,9,12,.95)');
    map.setPaintProperty('place-labels', 'text-color', flat ? palette.label : '#eaf6f5');
    map.setPaintProperty('place-labels', 'text-halo-color', flat ? palette.labelHalo : 'rgba(2,9,12,.95)');
  }, [mapStyle, ready, resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('globe-outline') as GeoJSONSource;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => source.setData(globeOutlineGeoJson(map.getCenter()) as never));
    };
    if (mapStyle === 'political' && layers.atmosphere) {
      update();
      map.on('move', update);
    } else source.setData(asCollection([]) as never);
    return () => {
      map.off('move', update);
      window.cancelAnimationFrame(frame);
    };
  }, [layers.atmosphere, mapStyle, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setVisibility(map, ['earthquake-clusters', 'earthquake-cluster-count', 'earthquake-halos', 'earthquake-rings', 'earthquake-points', 'earthquake-labels', 'earthquake-selected', 'p-wave-halo', 's-wave-halo', 'surface-wave-halo', 'p-wave', 's-wave', 'surface-wave'], layers.earthquakes);
    setVisibility(map, ['shakemap-fill', 'shakemap-outline'], layers.shakeMap);
    setVisibility(map, ['station-cluster-halo', 'station-clusters', 'station-cluster-count', 'station-points', 'station-icons', 'station-labels', 'station-selected'], layers.stations || layers.secondaryStations);
    setVisibility(map, ['plate-lines', 'orogen-lines'], layers.plates);
    setVisibility(map, ['volcano-clusters', 'volcano-cluster-count', 'volcano-weekly-rings', 'volcano-new-activity-rings', 'volcano-points', 'volcano-labels'], layers.volcanoes);
    setVisibility(map, ['globe-outline-line'], layers.atmosphere && mapStyle === 'political');
    setVisibility(map, ['reference-label-layer'], layers.labels && (mapStyle === 'political' || mapStyle === 'satellite'));
    setVisibility(map, ['ocean-label-layer'], layers.labels && mapStyle === 'bathymetry');
    setVisibility(map, ['country-labels', 'place-labels'], false);
    setVisibility(map, ['graticule-lines'], layers.graticule);
  }, [layers, mapStyle, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusTarget) return;
    const targetZoom = focusTarget.altitude !== undefined && focusTarget.altitude <= 1 ? 10 : focusTarget.altitude !== undefined && focusTarget.altitude <= 1.4 ? 7.8 : 1.05;
    cameraTimersRef.current.forEach(window.clearTimeout);
    cameraTimersRef.current = [];
    map.stop();
    if (focusTarget.cinematic) {
      const cruiseZoom = Math.min(map.getZoom(), compactRendererRef.current ? 1.75 : 2.1);
      map.easeTo({ zoom: cruiseZoom, pitch: 0, duration: 720, essential: true });
      cameraTimersRef.current.push(window.setTimeout(() => {
        map.flyTo({
          center: [focusTarget.lng, focusTarget.lat],
          zoom: Math.min(targetZoom, compactRendererRef.current ? 5.8 : 6.5),
          pitch: 24,
          bearing: 0,
          curve: 1.45,
          speed: .72,
          duration: 2_850,
          essential: true,
        });
      }, 680));
      return () => {
        cameraTimersRef.current.forEach(window.clearTimeout);
        cameraTimersRef.current = [];
      };
    }
    map.easeTo({ center: [focusTarget.lng, focusTarget.lat], zoom: targetZoom, pitch: targetZoom > 5 ? 28 : 0, duration: 1350, essential: true });
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
    (map.getSource('shakemap') as GeoJSONSource).setData(shakeMapCollection(layers.shakeMap ? selectedEvent : null) as never);
  }, [layers.shakeMap, ready, selectedEvent]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const wave = pulseEvent;
    const source = map.getSource('wave') as GeoJSONSource;
    if (!wave) {
      waveClockRef.current = { eventId: '', simulatedSeconds: 0, fadeStartedAt: 0, restartAt: 0 };
      source.setData(asCollection([]) as never);
      map.setPaintProperty('p-wave', 'line-opacity', 0);
      map.setPaintProperty('s-wave', 'line-opacity', 0);
      map.setPaintProperty('surface-wave', 'line-opacity', 0);
      map.setPaintProperty('p-wave-halo', 'line-opacity', 0);
      map.setPaintProperty('s-wave-halo', 'line-opacity', 0);
      map.setPaintProperty('surface-wave-halo', 'line-opacity', 0);
      return;
    }
    if (waveClockRef.current.eventId !== wave.id) waveClockRef.current = { eventId: wave.id, simulatedSeconds: 0, fadeStartedAt: 0, restartAt: 0 };
    if (wavePaused) return;
    let frame = 0;
    let lastUpdate = 0;
    let previousTime = performance.now();
    const updateInterval = compactRendererRef.current ? 110 : 70;
    const maxRadiusKm = Math.max(220, Math.min(4200, 240 + Math.max(0, wave.magnitude) * 430));
    const animate = (time: number) => {
      const deltaSeconds = Math.min(.25, (time - previousTime) / 1000);
      previousTime = time;
      if (waveClockRef.current.restartAt > time) {
        frame = requestAnimationFrame(animate);
        return;
      }
      waveClockRef.current.simulatedSeconds += deltaSeconds * waveSpeed;
      if (time - lastUpdate >= updateInterval) {
        const seconds = waveClockRef.current.simulatedSeconds;
        const pRadius = Math.min(maxRadiusKm, waveRadiusKm('P', seconds, wave.depthKm));
        const sRadius = Math.min(maxRadiusKm, waveRadiusKm('S', seconds, wave.depthKm));
        const surfaceRadius = Math.min(maxRadiusKm, waveRadiusKm('SURFACE', seconds, wave.depthKm));
        source.setData(waveCollection(wave, pRadius, sRadius, surfaceRadius) as never);
        if (surfaceRadius >= maxRadiusKm && waveClockRef.current.fadeStartedAt === 0) waveClockRef.current.fadeStartedAt = time;
        const fade = waveClockRef.current.fadeStartedAt > 0 ? Math.max(0, 1 - (time - waveClockRef.current.fadeStartedAt) / 1_150) : 1;
        map.setPaintProperty('p-wave', 'line-opacity', pRadius >= maxRadiusKm ? 0 : .8 * fade);
        map.setPaintProperty('s-wave', 'line-opacity', sRadius >= maxRadiusKm ? 0 : .9 * fade);
        map.setPaintProperty('surface-wave', 'line-opacity', .86 * fade);
        map.setPaintProperty('p-wave-halo', 'line-opacity', pRadius >= maxRadiusKm ? 0 : .25 * fade);
        map.setPaintProperty('s-wave-halo', 'line-opacity', sRadius >= maxRadiusKm ? 0 : .28 * fade);
        map.setPaintProperty('surface-wave-halo', 'line-opacity', .3 * fade);
        lastUpdate = time;
        if (fade === 0) {
          source.setData(asCollection([]) as never);
          waveClockRef.current.simulatedSeconds = 0;
          waveClockRef.current.fadeStartedAt = 0;
          waveClockRef.current.restartAt = time + 450;
        }
      }
      if (contextLostRef.current) {
        source.setData(asCollection([]) as never);
        map.setPaintProperty('p-wave', 'line-opacity', 0);
        map.setPaintProperty('s-wave', 'line-opacity', 0);
        map.setPaintProperty('surface-wave', 'line-opacity', 0);
        map.setPaintProperty('p-wave-halo', 'line-opacity', 0);
        map.setPaintProperty('s-wave-halo', 'line-opacity', 0);
        map.setPaintProperty('surface-wave-halo', 'line-opacity', 0);
        return;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pulseEvent, ready, wavePaused, waveSpeed]);

  if (failed) return <div className="webgl-fallback" role="status"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><p className="eyebrow">MODO DE COMPATIBILIDAD</p><h2>El globo 3D necesita WebGL</h2><p>Los datos y el historial siguen disponibles. Activa la aceleración gráfica para abrir la cartografía científica.</p></div>;

  return <div className="globe-host" aria-label="Globo sísmico tridimensional">
    <div ref={hostRef} className="maplibre-host" />
    {contextLost && <div className="renderer-recovery" role="status">
      <LoaderCircle size={17} className="spin" />
      <span>RECUPERANDO CARTOGRAFÍA</span>
      <button onClick={() => { setContextLost(false); setRendererRevision((revision) => revision + 1); }}><RefreshCw size={14} /> Reiniciar</button>
    </div>}
    {layers.legend && <aside className="globe-legend" aria-label="Leyenda de la cartografía sísmica">
      <header><strong>LEYENDA SÍSMICA</strong><span>ZOOM {zoom.toFixed(1)}</span></header>
      <section>
        <span>INTERIOR · MAGNITUD</span>
        <div className="magnitude-legend">
          <i style={{ background: '#4aa9cf' }} />&lt;1
          <i style={{ background: '#60bf81' }} />1–3
          <i style={{ background: '#e7c449' }} />3–5
          <i style={{ background: '#f08a3f' }} />5–6
          <i style={{ background: '#e65348' }} />6–7
          <i style={{ background: '#aa2c50' }} />7+
        </div>
        <small>El diámetro también aumenta con la magnitud. El valor aparece dentro al acercarse.</small>
      </section>
      <section>
        <span>BORDE · PROFUNDIDAD</span>
        <div className="depth-legend">
          <i style={{ borderColor: '#f06157' }} />0–35 km
          <i style={{ borderColor: '#f1a43c' }} />35–70
          <i style={{ borderColor: '#4caad6' }} />70–300
          <i style={{ borderColor: '#856bc6' }} />300+
        </div>
      </section>
      <section>
        <span>VOLCANES · INFORME SEMANAL</span>
        <div className="volcano-legend"><i className="volcano-catalogued" />Catálogo holoceno<i className="volcano-reported" />Actividad reportada<i className="volcano-new" />Nueva actividad</div>
      </section>
      <section className="tectonic-legend"><i className="plate-solid" />Límite de placa<i className="plate-diffuse" />Zona tectónica difusa</section>
    </aside>}
  </div>;
}
