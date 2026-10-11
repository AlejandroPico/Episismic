import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCombinedEarthquakes, mergeEarthquakeCatalogs } from './catalog';
import { normalizeUsgsFeature, type UsgsFeature } from './usgs';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function feature(id: string, time: number, coordinates: [number, number, number] = [0, 0, 10]): UsgsFeature {
  return {
    id, geometry: { coordinates },
    properties: { mag: 3, place: id, time, updated: time,
      url: 'https://example.test', felt: null, tsunami: 0, alert: null, status: 'reviewed', sig: 10, magType: 'mb', net: 'us' },
  };
}

describe('90-day catalog', () => {
  it('requests all 90 days in three blocks from each source and deduplicates the boundaries', async () => {
    vi.useFakeTimers();
    const now = Date.parse('2026-10-11T02:00:00Z');
    vi.setSystemTime(now);
    const start = now - 90 * 86_400_000;
    const requests: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input);
      requests.push(url);
      if (url.hostname === 'earthquake.usgs.gov') {
        const blockStart = Date.parse(url.searchParams.get('starttime')!);
        const blockEnd = Date.parse(url.searchParams.get('endtime')!);
        return new Response(JSON.stringify({ features: [
          feature(`boundary-${blockStart}`, blockStart), feature(`boundary-${blockEnd}`, blockEnd),
          feature('before-window', start - 1), feature('future', now + 1),
        ] }));
      }
      if (url.hostname === 'www.seismicportal.eu') return new Response(JSON.stringify({ features: [] }));
      return new Response('#EventID|Time|Latitude|Longitude|Depth');
    }));
    const result = await fetchCombinedEarthquakes('quarter');
    expect(requests).toHaveLength(9);
    for (const hostname of ['earthquake.usgs.gov', 'www.seismicportal.eu', 'geofon.gfz-potsdam.de']) {
      const ranges = requests.filter((url) => url.hostname === hostname).sort((a, b) => a.searchParams.get('starttime')!.localeCompare(b.searchParams.get('starttime')!));
      expect(ranges).toHaveLength(3);
      ranges.forEach((url, index) => {
        expect(url.pathname).toBe('/fdsnws/event/1/query');
        expect(Date.parse(url.searchParams.get('starttime')!)).toBe(start + index * 30 * 86_400_000);
        expect(Date.parse(url.searchParams.get('endtime')!)).toBe(start + (index + 1) * 30 * 86_400_000);
        expect(url.searchParams.get('limit')).toBe('20000');
      });
    }
    expect(result.events).toHaveLength(4);
    expect(result.events.at(-1)?.time).toBe(start);
    expect(result.sources).toEqual(['USGS', 'EMSC', 'GEOFON']);
  });

  it('keeps existing 30-day feed requests and tolerates a failed provider', async () => {
    vi.useFakeTimers();
    const now = Date.parse('2026-10-11T02:00:00Z');
    vi.setSystemTime(now);
    const requests: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input);
      requests.push(url);
      if (url.hostname === 'earthquake.usgs.gov') return new Response(JSON.stringify({ features: [feature('recent', now - 1000)] }));
      if (url.hostname === 'www.seismicportal.eu') return new Response('Unavailable', { status: 503 });
      return new Response('');
    }));
    const result = await fetchCombinedEarthquakes('month');
    expect(requests).toHaveLength(3);
    expect(requests[0].pathname).toBe('/earthquakes/feed/v1.0/summary/all_month.geojson');
    expect(Date.parse(requests[1].searchParams.get('starttime')!)).toBe(now - 30 * 86_400_000);
    expect(result.sources).toEqual(['USGS', 'GEOFON']);
  });
});

describe('catalog merging with a large history', () => {
  it('merges nearby solutions while keeping distant origins and separate times', () => {
    const events = [
      normalizeUsgsFeature(feature('newest', 10_000_000)),
      normalizeUsgsFeature(feature('nearby', 9_910_000, [0.1, 0.1, 12])),
      normalizeUsgsFeature(feature('far-away', 9_930_000, [50, 50, 10])),
      normalizeUsgsFeature(feature('older', 9_909_999)),
    ];
    events[1].catalogs = ['EMSC'];
    expect(mergeEarthquakeCatalogs(events).map((event) => event.id)).toEqual(['usgs:newest', 'usgs:far-away', 'usgs:older']);
    expect(events[0].catalogs).toEqual(['USGS', 'EMSC']);
  });

  it('keeps all distinct origins in a 40,000-event history', () => {
    const events = Array.from({ length: 40_000 }, (_, index) => normalizeUsgsFeature(feature(String(index), index * 100_000)));
    const merged = mergeEarthquakeCatalogs(events);
    expect(merged).toHaveLength(40_000);
    expect(merged[0].id).toBe('usgs:39999');
    expect(merged.at(-1)?.id).toBe('usgs:0');
  });
});
