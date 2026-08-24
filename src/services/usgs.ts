import type { Earthquake, TimeWindow } from '../types';

const FEEDS: Record<TimeWindow, string> = {
  hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
};

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url: string;
    detail?: string;
    felt: number | null;
    tsunami: number;
    alert: Earthquake['alert'];
    status: string;
    sig: number;
    magType: string | null;
    net: string;
    type?: string;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

interface UsgsCollection {
  metadata: { generated: number; count: number; title: string };
  features: UsgsFeature[];
}

export function normalizeUsgsFeature(feature: UsgsFeature): Earthquake {
  const [lng, lat, depth] = feature.geometry.coordinates;
  const properties = feature.properties;
  return {
    id: feature.id,
    magnitude: Number.isFinite(properties.mag) ? Number(properties.mag) : 0,
    depthKm: Number.isFinite(depth) ? Math.max(0, depth) : 0,
    place: properties.place || 'Localización por revisar',
    lat,
    lng,
    time: properties.time,
    updated: properties.updated,
    source: properties.net?.toUpperCase() || 'USGS',
    sourceUrl: properties.url,
    detailUrl: properties.detail,
    felt: properties.felt,
    tsunami: Boolean(properties.tsunami),
    alert: properties.alert,
    status: properties.status || 'automatic',
    significance: properties.sig || 0,
    magnitudeType: properties.magType || '—',
    kind: 'earthquake',
  };
}

export async function fetchEarthquakes(window: TimeWindow, signal?: AbortSignal): Promise<Earthquake[]> {
  const response = await fetch(FEEDS[window], {
    signal,
    headers: { Accept: 'application/geo+json, application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`USGS respondió ${response.status}`);
  const collection = (await response.json()) as UsgsCollection;
  return collection.features
    .filter((feature) => feature.geometry?.coordinates?.length >= 3)
    .map(normalizeUsgsFeature)
    .sort((a, b) => b.time - a.time);
}

export async function searchHistoricalEarthquakes(params: {
  start: Date;
  end: Date;
  minMagnitude: number;
  limit?: number;
}, signal?: AbortSignal): Promise<Earthquake[]> {
  const query = new URLSearchParams({
    format: 'geojson',
    starttime: params.start.toISOString(),
    endtime: params.end.toISOString(),
    minmagnitude: String(params.minMagnitude),
    orderby: 'time',
    limit: String(params.limit ?? 5000),
  });
  const response = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${query}`, {
    signal,
    headers: { Accept: 'application/geo+json, application/json' },
  });
  if (!response.ok) throw new Error(`Catálogo USGS respondió ${response.status}`);
  const collection = (await response.json()) as UsgsCollection;
  return collection.features.map(normalizeUsgsFeature);
}
