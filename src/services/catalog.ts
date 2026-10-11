import type { Earthquake, TimeWindow } from '../types';
import { normalizeUsgsFeature, type UsgsCollection } from './usgs';
import { windowStart } from '../utils/format';

const USGS_FEEDS: Record<Exclude<TimeWindow, 'quarter'>, string> = {
  hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
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
  return window === 'month' || window === 'quarter' ? 20000 : window === 'week' ? 12000 : window === 'day' ? 5000 : 1000;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`${new URL(url).hostname} respondió ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchUsgs(window: TimeWindow, start: string, end: string, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({ format: 'geojson', orderby: 'time', limit: String(eventLimit(window)), starttime: start, endtime: end });
  const url = window === 'quarter' ? `https://earthquake.usgs.gov/fdsnws/event/1/query?${query}` : USGS_FEEDS[window];
  const collection = await fetchJson<UsgsCollection>(url, signal);
  return collection.features.filter((feature) => feature.geometry?.coordinates?.length >= 3).map(normalizeUsgsFeature);
}

async function fetchEmsc(window: TimeWindow, start: string, end: string, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({
    format: 'json', orderby: 'time', limit: String(eventLimit(window)),
    starttime: start, endtime: end,
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
      lat, lng, time, updated, source: authority === 'EMSC' ? 'EMSC' : `EMSC · ${authority}`,
      sourceUrl: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(feature.id)}`,
      felt: null, tsunami: false, alert: null, status: 'automatic', significance: Math.round((Number(properties.mag) || 0) * 70),
      magnitudeType: properties.magtype || '—', catalogs: ['EMSC'], intensity: null,
      reportedIntensity: null, estimatedIntensity: null, eventType: 'earthquake',
      solutions: [{ agency: authority, magnitude: Number(properties.mag) || 0, magnitudeType: properties.magtype || '—', depthKm: Math.max(0, Number(properties.depth) || 0), time, status: 'automatic' }],
      reviewCode: 'A', kind: 'earthquake',
    } satisfies Earthquake;
  }).filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));
}

async function fetchGeofon(window: TimeWindow, start: string, end: string, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({
    format: 'text', orderby: 'time', limit: String(eventLimit(window)),
    starttime: start, endtime: end,
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
      magnitudeType: magnitudeType || '—', catalogs: [contributor || 'GEOFON'], intensity: null,
      reportedIntensity: null, estimatedIntensity: null, eventType: 'earthquake',
      solutions: [{ agency: contributor || 'GEOFON', magnitude: Number(magnitude) || 0, magnitudeType: magnitudeType || '—', depthKm: Math.max(0, Number(depth) || 0), time, status: 'automatic' }],
      reviewCode: 'A', kind: 'earthquake',
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
  let recentStart = 0;
  for (const candidate of [...events].sort((a, b) => b.time - a.time)) {
    // Sorted origins let us discard old comparison candidates permanently.
    // Only events within 90 seconds can match, even in the 90-day catalog.
    while (recentStart < merged.length && merged[recentStart].time - candidate.time > 90_000) recentStart++;
    let duplicate: Earthquake | undefined;
    for (let index = recentStart; index < merged.length; index++) {
      const event = merged[index];
      if (Math.abs(event.magnitude - candidate.magnitude) <= 1.2 && distanceKm(event, candidate) <= 65) {
        duplicate = event;
        break;
      }
    }
    if (!duplicate) { merged.push(candidate); continue; }
    duplicate.catalogs = [...new Set([...duplicate.catalogs, ...candidate.catalogs])];
    duplicate.solutions = [...(duplicate.solutions ?? []), ...(candidate.solutions ?? [])].filter((solution, index, all) =>
      all.findIndex((item) => `${item.agency}:${item.magnitude.toFixed(2)}:${item.time}` === `${solution.agency}:${solution.magnitude.toFixed(2)}:${solution.time}`) === index);
    duplicate.source = duplicate.catalogs.join(' · ');
    duplicate.updated = Math.max(duplicate.updated, candidate.updated);
    if (candidate.status === 'reviewed') { duplicate.status = 'reviewed'; duplicate.reviewCode = 'R'; }
    if (!duplicate.felt && candidate.felt) duplicate.felt = candidate.felt;
    if (!duplicate.alert && candidate.alert) duplicate.alert = candidate.alert;
    if (!duplicate.intensity && candidate.intensity) duplicate.intensity = candidate.intensity;
    if (!duplicate.reportedIntensity && candidate.reportedIntensity) duplicate.reportedIntensity = candidate.reportedIntensity;
    if (!duplicate.estimatedIntensity && candidate.estimatedIntensity) duplicate.estimatedIntensity = candidate.estimatedIntensity;
    duplicate.tsunami ||= candidate.tsunami;
  }
  return merged.sort((a, b) => b.time - a.time);
}

export async function fetchCombinedEarthquakes(window: TimeWindow, signal?: AbortSignal): Promise<{ events: Earthquake[]; sources: string[] }> {
  const now = Date.now();
  const start = windowStart(window, now);
  // Query 90 days in three 30-day blocks so a provider's per-query event cap
  // does not truncate the entire interval to only its newest events.
  const ranges = window === 'quarter' ? Array.from({ length: 3 }, (_, index) => ({
    start: new Date(start + index * 2_592_000_000).toISOString(),
    end: new Date(start + (index + 1) * 2_592_000_000).toISOString(),
  })) : [{ start: new Date(start).toISOString(), end: new Date(now).toISOString() }];
  const fetchSource = async (fetcher: typeof fetchUsgs) => {
    const chunks = await Promise.all(ranges.map((range) => fetcher(window, range.start, range.end, signal)));
    return chunks.flat();
  };
  const results = await Promise.allSettled([fetchSource(fetchUsgs), fetchSource(fetchEmsc), fetchSource(fetchGeofon)]);
  const labels = ['USGS', 'EMSC', 'GEOFON'];
  const sources = labels.filter((_, index) => results[index].status === 'fulfilled');
  const events = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).filter((event) => event.time >= start && event.time <= now);
  if (!events.length) throw new Error('Ninguno de los catálogos sísmicos respondió');
  return { events: mergeEarthquakeCatalogs(events), sources };
}
