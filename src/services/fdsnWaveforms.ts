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

function activeChannels(channels: FdsnChannel[], now: number) {
  return channels.filter((item) => {
    const start = item.startTime ? new Date(item.startTime).getTime() : Number.NEGATIVE_INFINITY;
    const end = item.endTime ? new Date(item.endTime).getTime() : Number.POSITIVE_INFINITY;
    return start <= now && end >= now - 86_400_000;
  });
}

const CHANNEL_PRIORITY = ['HH', 'BH', 'EH', 'HN', 'LH', 'SH'];

function channelRank(channel: string) {
  const index = CHANNEL_PRIORITY.indexOf(channel.slice(0, 2));
  return index < 0 ? CHANNEL_PRIORITY.length : index;
}

export function selectThreeComponentChannels(channels: FdsnChannel[], now = Date.now()) {
  const active = activeChannels(channels, now);
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
      return channelRank(a[0].channel) - channelRank(b[0].channel);
    })
    .map((items) => ['Z', 'N', 'E'].map((axis) => items.find((item) => component(item.channel) === axis)!))[0] ?? [];
}

export function selectMonitorChannels(channels: FdsnChannel[], now = Date.now()) {
  const groups = new Map<string, FdsnChannel[]>();
  for (const item of activeChannels(channels, now)) {
    const key = `${item.location}|${item.channel.slice(0, 2)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const axes = ['Z', 'N', '1', 'E', '2'];
  const best = [...groups.values()]
    .filter((items) => items.some((item) => component(item.channel) === 'Z'))
    .sort((a, b) => {
      const componentDifference = new Set(b.map((item) => component(item.channel))).size - new Set(a.map((item) => component(item.channel))).size;
      return componentDifference || channelRank(a[0].channel) - channelRank(b[0].channel);
    })[0] ?? [];
  return best
    .filter((item, index, items) => items.findIndex((candidate) => component(candidate.channel) === component(item.channel)) === index)
    .sort((a, b) => axes.indexOf(component(a.channel) || '') - axes.indexOf(component(b.channel) || ''))
    .slice(0, 3);
}

async function queryChannelInventory(station: SeismicStation, root: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ net: station.network, sta: station.code, level: 'channel', format: 'text', includerestricted: 'false' });
  const response = await fetch(`${root}/fdsnws/station/1/query?${query}`, { signal, headers: { Accept: 'text/plain' } });
  if (!response.ok) throw new Error(`Inventario FDSN respondió ${response.status}`);
  return parseFdsnChannels(await response.text());
}

export async function discoverStationChannels(station: SeismicStation, signal?: AbortSignal) {
  return selectThreeComponentChannels(await queryChannelInventory(station, fdsnServiceRoot(station), signal));
}

export async function discoverStationMonitorChannels(station: SeismicStation, signal?: AbortSignal) {
  const roots = [...new Set([fdsnServiceRoot(station), SERVICE_ROOTS.EarthScope])];
  let lastError: unknown;
  for (const root of roots) {
    try {
      const selected = selectMonitorChannels(await queryChannelInventory(station, root, signal));
      if (selected.length) return selected;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
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
