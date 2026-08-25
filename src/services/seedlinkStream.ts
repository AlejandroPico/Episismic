import { luxon, miniseed, seedlink } from 'seisplotjs/nodeonly';
import type { SeismicStation } from '../types';
import { fdsnServiceRoot, type FdsnChannel } from './fdsnWaveforms';

export const EARTHSCOPE_SEEDLINK_WEBSOCKET = 'wss://rtserve.earthscope.org/seedlink';

export interface WaveformBlock {
  id: string;
  network: string;
  station: string;
  location: string;
  channel: string;
  startMs: number;
  sampleRate: number;
  samples: Float64Array;
  transport: 'seedlink' | 'fdsn';
}

export type SeedlinkState = 'connecting' | 'connected' | 'closed' | 'error';

export function seedlink3Commands(channel: FdsnChannel) {
  const location = channel.location.trim();
  return [
    `STATION ${channel.station} ${channel.network}`,
    `SELECT ${location}${channel.channel}.D`,
  ];
}

function recordToBlock(record: miniseed.DataRecord, transport: WaveformBlock['transport']): WaveformBlock {
  const { header } = record;
  const samples = Float64Array.from(record.decompress());
  const startMs = header.startTime.toMillis();
  return {
    id: `${header.netCode}.${header.staCode}.${header.locCode}.${header.chanCode}:${startMs}:${samples.length}`,
    network: header.netCode,
    station: header.staCode,
    location: header.locCode,
    channel: header.chanCode,
    startMs,
    sampleRate: header.sampleRate,
    samples,
    transport,
  };
}

export function openSeedlinkStream(
  channel: FdsnChannel,
  backfillSeconds: number,
  onBlock: (block: WaveformBlock) => void,
  onState: (state: SeedlinkState, error?: Error) => void,
) {
  const connection = new seedlink.SeedlinkConnection(
    EARTHSCOPE_SEEDLINK_WEBSOCKET,
    seedlink3Commands(channel),
    (packet) => {
      try {
        onBlock(recordToBlock(packet.miniseed, 'seedlink'));
        onState('connected');
      } catch (error) {
        onState('error', error instanceof Error ? error : new Error(String(error)));
      }
    },
    (error) => onState('error', error),
  );
  connection.setTimeCommand(luxon.DateTime.utc().minus({ seconds: Math.min(900, Math.max(30, backfillSeconds)) }));
  connection.setOnClose(() => onState('closed'));
  onState('connecting');
  void connection.connect();
  return { close: () => connection.close() };
}

export async function queryFdsnWaveformBlocks(
  station: SeismicStation,
  channel: FdsnChannel,
  start: Date,
  end: Date,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    net: channel.network,
    sta: channel.station,
    loc: channel.location || '--',
    cha: channel.channel,
    starttime: start.toISOString(),
    endtime: end.toISOString(),
    format: 'miniseed',
    nodata: '204',
  });
  const response = await fetch(`${fdsnServiceRoot(station)}/fdsnws/dataselect/1/query?${query}`, {
    signal,
    headers: { Accept: 'application/vnd.fdsn.mseed' },
  });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`FDSN DataSelect respondió ${response.status}`);
  const records = miniseed.parseDataRecords(await response.arrayBuffer());
  return records.map((record) => recordToBlock(record, 'fdsn'));
}

export function mergeWaveformBlocks(current: WaveformBlock[], incoming: WaveformBlock[], cutoffMs: number) {
  const byId = new Map<string, WaveformBlock>();
  for (const block of [...current, ...incoming]) {
    const endMs = block.startMs + block.samples.length / Math.max(1, block.sampleRate) * 1000;
    if (endMs >= cutoffMs) byId.set(block.id, block);
  }
  return [...byId.values()].sort((a, b) => a.startMs - b.startMs);
}
