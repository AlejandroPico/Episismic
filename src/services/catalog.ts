import type { Earthquake, TimeWindow } from '../types';
import { normalizeUsgsFeature, type UsgsCollection } from './usgs';

const USGS_FEEDS: Record<TimeWindow, string> = {
  hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
};

const WINDOW_MS: Record<TimeWindow, number> = {
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
  month: 30 * 24 * 60 * 60_000,
};

interface EmscFeature {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: {
    auth?: string; depth?: number; flynn_region?: string; lastupdate?: string;
    mag?: number; magtype?: string; source_catalog?: string; time?: string;
  };
}

interface EmscCollection { features: EmscFeature[] }

function eventLimit(window: TimeWindow) {
  return window === 'month' ? 20000 : window === 'week' ? 12000 : window === 'day' ? 5000 : 1000;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`${new URL(url).hostname} respondió ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchUsgs(window: TimeWindow, signal?: AbortSignal): Promise<Earthquake[]> {
  const collection = await fetchJson<UsgsCollection>(USGS_FEEDS[window], signal);
  return collection.features.filter((feature) => feature.geometry?.coordinates?.length >= 3).map(normalizeUsgsFeature);
}

async function fetchEmsc(window: TimeWindow, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({
    format: 'json', orderby: 'time', limit: String(eventLimit(window)),
    starttime: new Date(Date.now() - WINDOW_MS[window]).toISOString(),
  });
  const collection = await fetchJson<EmscCollection>(`https://www.seismicportal.eu/fdsnws/event/1/query?${query}`, signal);
  return collection.features.map((feature) => {
    const properties = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const time = Date.parse(properties.time || '') || Date.now();
    const updated = Date.parse(properties.lastupdate || '') || time;
    const authority = properties.auth?.toUpperCase() || 'EMSC';
    return {
      id: `emsc:${feature.id}`, magnitude: Number(properties.mag) || 0,
      depthKm: Math.max(0, Number(properties.depth) || 0), place: properties.flynn_region || 'Localización por revisar',
      lat, lng, time, updated, source: `EMSC · ${authority}`,
      sourceUrl: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(feature.id)}`,
      felt: null, tsunami: false, alert: null, status: 'automatic', significance: Math.round((Number(properties.mag) || 0) * 70),
      magnitudeType: properties.magtype || '—', catalogs: ['EMSC'], intensity: null, reviewCode: 'A', kind: 'earthquake',
    } satisfies Earthquake;
  }).filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));
}

async function fetchGeofon(window: TimeWindow, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({
    format: 'text', orderby: 'time', limit: String(eventLimit(window)),
    starttime: new Date(Date.now() - WINDOW_MS[window]).toISOString(),
  });
  const response = await fetch(`https://geofon.gfz-potsdam.de/fdsnws/event/1/query?${query}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`GEOFON respondió ${response.status}`);
  const text = await response.text();
  return text.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => line.split('|')).filter((columns) => columns.length >= 14).map((columns) => {
    const [id, originTime, latitude, longitude, depth, , , contributor, , magnitudeType, magnitude, , place] = columns;
    const time = Date.parse(originTime);
    return {
      id: `gfz:${id}`, magnitude: Number(magnitude) || 0, depthKm: Math.max(0, Number(depth) || 0),
      place: place || 'Localización por revisar', lat: Number(latitude), lng: Number(longitude), time, updated: time,
      source: 'GEOFON', sourceUrl: `https://geofon.gfz-potsdam.de/eqexplorer/events/${encodeURIComponent(id)}/general`,
      felt: null, tsunami: false, alert: null, status: 'automatic', significance: Math.round((Number(magnitude) || 0) * 70),
      magnitudeType: magnitudeType || '—', catalogs: [contributor || 'GEOFON'], intensity: null, reviewCode: 'A', kind: 'earthquake',
    } satisfies Earthquake;
  }).filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng) && Number.isFinite(event.time));
}

function distanceKm(a: Earthquake, b: Earthquake) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function mergeEarthquakeCatalogs(events: Earthquake[]): Earthquake[] {
  const merged: Earthquake[] = [];
  for (const candidate of [...events].sort((a, b) => b.time - a.time)) {
    const duplicate = merged.find((event) => Math.abs(event.time - candidate.time) <= 90_000 && Math.abs(event.magnitude - candidate.magnitude) <= 1.2 && distanceKm(event, candidate) <= 65);
    if (!duplicate) { merged.push(candidate); continue; }
    duplicate.catalogs = [...new Set([...duplicate.catalogs, ...candidate.catalogs])];
    duplicate.source = duplicate.catalogs.join(' · ');
    duplicate.updated = Math.max(duplicate.updated, candidate.updated);
    if (candidate.status === 'reviewed') { duplicate.status = 'reviewed'; duplicate.reviewCode = 'R'; }
    if (!duplicate.felt && candidate.felt) duplicate.felt = candidate.felt;
    if (!duplicate.alert && candidate.alert) duplicate.alert = candidate.alert;
    if (!duplicate.intensity && candidate.intensity) duplicate.intensity = candidate.intensity;
    duplicate.tsunami ||= candidate.tsunami;
  }
  return merged.sort((a, b) => b.time - a.time);
}

export async function fetchCombinedEarthquakes(window: TimeWindow, signal?: AbortSignal): Promise<{ events: Earthquake[]; sources: string[] }> {
  const results = await Promise.allSettled([fetchUsgs(window, signal), fetchEmsc(window, signal), fetchGeofon(window, signal)]);
  const labels = ['USGS', 'EMSC', 'GEOFON'];
  const sources = labels.filter((_, index) => results[index].status === 'fulfilled');
  const events = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!events.length) throw new Error('Ninguno de los catálogos sísmicos respondió');
  return { events: mergeEarthquakeCatalogs(events), sources };
}
