import type { Earthquake } from '../types';

export interface UsgsFeature {
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
    cdi?: number | null;
    mmi?: number | null;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

export interface UsgsCollection {
  metadata: { generated: number; count: number; title: string };
  features: UsgsFeature[];
}

export function normalizeUsgsFeature(feature: UsgsFeature): Earthquake {
  const [lng, lat, depth] = feature.geometry.coordinates;
  const properties = feature.properties;
  return {
    id: `usgs:${feature.id}`,
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
    catalogs: ['USGS'],
    intensity: properties.mmi ?? properties.cdi ?? null,
    reviewCode: properties.status === 'reviewed' ? 'R' : 'A',
    kind: 'earthquake',
  };
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
