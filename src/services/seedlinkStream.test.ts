import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WaveformBlock } from './seedlinkStream';

let seedlink3Commands: typeof import('./seedlinkStream').seedlink3Commands;
let mergeWaveformBlocks: typeof import('./seedlinkStream').mergeWaveformBlocks;

beforeAll(async () => {
  vi.stubGlobal('HTMLElement', class HTMLElementStub {});
  vi.stubGlobal('customElements', { define: () => undefined, get: () => undefined });
  ({ seedlink3Commands, mergeWaveformBlocks } = await import('./seedlinkStream'));
});

describe('SeedLink en tiempo real', () => {
  it('construye la suscripción exacta NSLC', () => {
    expect(seedlink3Commands({ network: 'FR', station: 'MERIC', location: '00', channel: 'HHZ', sampleRate: 100, startTime: null, endTime: null }))
      .toEqual(['STATION MERIC FR', 'SELECT 00HHZ.D']);
  });

  it('deduplica los paquetes y descarta los anteriores a la ventana', () => {
    const block = (id: string, startMs: number): WaveformBlock => ({ id, startMs, network: 'XX', station: 'AAA', location: '', channel: 'HHZ', sampleRate: 1, samples: new Float64Array([1, 2]), transport: 'seedlink' });
    expect(mergeWaveformBlocks([block('old', 0), block('same', 20_000)], [block('same', 20_000), block('new', 21_000)], 10_000).map((item) => item.id))
      .toEqual(['same', 'new']);
  });
});
