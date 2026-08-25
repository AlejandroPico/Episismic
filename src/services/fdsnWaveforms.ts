import type { SeismicStation } from '../types';

export interface FdsnChannel {
  network: string;
  station: string;
  location: string;
  channel: string;
  sampleRate: number;
  startTime: string | null;
  endTime: string | null;
}

const SERVICE_ROOTS: Record<string, string> = {
  EarthScope: 'https://service.earthscope.org',
  GEOFON: 'https://geofon.gfz.de',
  NCEDC: 'https://service.ncedc.org',
  BMKG: 'https://geof.bmkg.go.id',
};

export function fdsnServiceRoot(station: Pick<SeismicStation, 'source'>) {
  return SERVICE_ROOTS[station.source] ?? SERVICE_ROOTS.EarthScope;
}

export function parseFdsnChannels(text: string): FdsnChannel[] {
  return text.split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|'))
    .filter((columns) => columns.length >= 15)
    .map((columns) => ({
      network: columns[0], station: columns[1], location: columns[2] || '', channel: columns[3],
      sampleRate: Number(columns[14]) || 0, startTime: columns[15] || null, endTime: columns[16] || null,
    }));
}

function component(channel: string) {
  const value = channel.at(-1)?.toUpperCase();
  return value === '1' ? 'N' : value === '2' ? 'E' : value;
}

export function selectThreeComponentChannels(channels: FdsnChannel[], now = Date.now()) {
  const active = channels.filter((item) => {
    const start = item.startTime ? new Date(item.startTime).getTime() : Number.NEGATIVE_INFINITY;
    const end = item.endTime ? new Date(item.endTime).getTime() : Number.POSITIVE_INFINITY;
    return start <= now && end >= now - 86_400_000;
  });
  const priority = ['HH', 'BH', 'EH', 'HN', 'LH', 'SH'];
  const groups = new Map<string, FdsnChannel[]>();
  for (const item of active) {
    const key = `${item.location}|${item.channel.slice(0, 2)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()]
    .filter((items) => {
      const components = new Set(items.map((item) => component(item.channel)));
      return components.has('Z') && components.has('N') && components.has('E');
    })
    .sort((a, b) => {
      const rank = (value: string) => { const index = priority.indexOf(value); return index < 0 ? priority.length : index; };
      return rank(a[0].channel.slice(0, 2)) - rank(b[0].channel.slice(0, 2));
    })
    .map((items) => ['Z', 'N', 'E'].map((axis) => items.find((item) => component(item.channel) === axis)!))[0] ?? [];
}

export async function discoverStationChannels(station: SeismicStation, signal?: AbortSignal) {
  const query = new URLSearchParams({ net: station.network, sta: station.code, level: 'channel', format: 'text', includerestricted: 'false' });
  const response = await fetch(`${fdsnServiceRoot(station)}/fdsnws/station/1/query?${query}`, { signal, headers: { Accept: 'text/plain' } });
  if (!response.ok) throw new Error(`Inventario FDSN respondió ${response.status}`);
  return selectThreeComponentChannels(parseFdsnChannels(await response.text()));
}

export function fdsnStationLinks(station: SeismicStation, now = new Date(), channels: FdsnChannel[] = []) {
  const root = fdsnServiceRoot(station);
  const end = now.toISOString();
  const start = new Date(now.getTime() - 3_600_000).toISOString();
  const stationQuery = new URLSearchParams({ net: station.network, sta: station.code, level: 'response', format: 'xml' });
  const selectedLocation = channels[0]?.location || '*';
  const selectedChannels = channels.length ? channels.map((item) => item.channel).join(',') : 'HH?,BH?,EH?,HN?,LH?';
  const dataQuery = new URLSearchParams({ net: station.network, sta: station.code, loc: selectedLocation || '--', cha: selectedChannels, starttime: start, endtime: end, nodata: '404' });
  return {
    provider: station.source,
    stationXml: `${root}/fdsnws/station/1/query?${stationQuery}`,
    channelInventory: `${root}/fdsnws/station/1/query?${new URLSearchParams({ net: station.network, sta: station.code, level: 'channel', format: 'text' })}`,
    miniSeed: `${root}/fdsnws/dataselect/1/query?${dataQuery}`,
  };
}

export function earthScopeWaveformPlotUrl(channel: FdsnChannel, start: Date, end: Date, minFrequency: number, maxFrequency: number) {
  const query = new URLSearchParams({
    net: channel.network, sta: channel.station, loc: channel.location || '--', cha: channel.channel,
    starttime: start.toISOString(), endtime: end.toISOString(), width: '1000', height: '260',
    showtitle: 'true', showscale: 'true', earthunits: 'false', demean: 'true',
    bp: `${minFrequency.toFixed(2)}-${maxFrequency.toFixed(2)}`, format: 'png',
  });
  return `https://service.earthscope.org/irisws/timeseriesplot/1/query?${query}`;
}
