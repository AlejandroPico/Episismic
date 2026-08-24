import { useEffect, useState } from 'react';
import { stations as fallbackStations } from '../data/stations';
import { volcanoes as fallbackVolcanoes } from '../data/volcanoes';
import { upsertStations } from '../services/database';
import type { SeismicStation, Volcano } from '../types';

async function loadCompressedJson<T>(filename: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${filename}`, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar ${filename}`);
  if (response.headers.get('content-encoding')?.includes('gzip')) return response.json() as Promise<T>;
  if (!response.body || typeof DecompressionStream === 'undefined') throw new Error('El navegador no puede descomprimir el catálogo');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json() as Promise<T>;
}

function waitForIdle() {
  return new Promise<void>((resolve) => {
    const requestIdle = (window as unknown as { requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number }).requestIdleCallback;
    if (requestIdle) requestIdle(resolve, { timeout: 1200 });
    else window.setTimeout(resolve, 20);
  });
}

async function persistStationsInBatches(stations: SeismicStation[], version: string) {
  const batchSize = 2000;
  for (let index = 0; index < stations.length; index += batchSize) {
    await waitForIdle();
    await upsertStations(stations.slice(index, index + batchSize));
  }
  localStorage.setItem('episismic:station-catalog-version', version);
}

export function useGeodata() {
  const [stations, setStations] = useState<SeismicStation[]>(fallbackStations);
  const [volcanoes, setVolcanoes] = useState<Volcano[]>(fallbackVolcanoes);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      loadCompressedJson<SeismicStation[]>('stations.json.gz', controller.signal),
      loadCompressedJson<Volcano[]>('volcanoes.json.gz', controller.signal),
    ]).then(([stationCatalog, volcanoCatalog]) => {
      setStations(stationCatalog);
      setVolcanoes(volcanoCatalog);
      setReady(true);
      const version = `fdsn-full-v1:${stationCatalog.length}`;
      if (localStorage.getItem('episismic:station-catalog-version') !== version) {
        const persist = () => void persistStationsInBatches(stationCatalog, version);
        const requestIdle = (window as unknown as { requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number }).requestIdleCallback;
        if (requestIdle) requestIdle(persist, { timeout: 5000 });
        else window.setTimeout(persist, 1200);
      }
    }).catch(() => setReady(true));
    return () => controller.abort();
  }, []);

  return { stations, volcanoes, ready };
}
