import type { SeismicStation } from '../types';

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export async function fetchEarthScopeStations(bounds: Bounds, signal?: AbortSignal): Promise<SeismicStation[]> {
  const query = new URLSearchParams({
    format: 'text',
    level: 'station',
    includerestricted: 'false',
    minlatitude: bounds.minLat.toFixed(3),
    maxlatitude: bounds.maxLat.toFixed(3),
    minlongitude: bounds.minLng.toFixed(3),
    maxlongitude: bounds.maxLng.toFixed(3),
  });
  const response = await fetch(`https://service.earthscope.org/fdsnws/station/1/query?${query}`, { signal });
  if (!response.ok) throw new Error(`EarthScope respondió ${response.status}`);
  const text = await response.text();
  return text.split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|'))
    .filter((columns) => columns.length >= 8)
    .map(([network, code, latitude, longitude, elevation, siteName]) => ({
      id: `${network}.${code}`,
      network,
      code,
      name: siteName || `${network}.${code}`,
      country: '—',
      lat: Number(latitude),
      lng: Number(longitude),
      elevationM: Number(elevation),
      status: 'online' as const,
      dataUrl: 'https://service.earthscope.org/fdsnws/station/1/',
      source: 'EarthScope' as const,
    }))
    .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng));
}
