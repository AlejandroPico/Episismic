import { useEffect, useState } from 'react';
import { volcanoes as fallbackVolcanoes } from '../data/volcanoes';
import { upsertStations } from '../services/database';
import type { SeismicStation, Volcano } from '../types';

const secondaryStationFiles = Array.from({ length: 16 }, (_, index) => `stations-secondary-${String(index).padStart(2, '0')}.json.gz`);

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

export function useGeodata(requestStations = false, requestSecondaryStations = false) {
  const [stations, setStations] = useState<SeismicStation[]>([]);
  const [secondaryStations, setSecondaryStations] = useState<SeismicStation[]>([]);
  const [volcanoes, setVolcanoes] = useState<Volcano[]>(fallbackVolcanoes);
  const [stationsRequested, setStationsRequested] = useState(requestStations);
  const [stationsReady, setStationsReady] = useState(false);
  const [secondaryStationsRequested, setSecondaryStationsRequested] = useState(requestSecondaryStations);
  const [secondaryStationsReady, setSecondaryStationsReady] = useState(false);
  const [volcanoesReady, setVolcanoesReady] = useState(false);

  useEffect(() => {
    if (requestStations) setStationsRequested(true);
  }, [requestStations]);

  useEffect(() => {
    if (requestSecondaryStations) setSecondaryStationsRequested(true);
  }, [requestSecondaryStations]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCompressedJson<Volcano[]>('volcanoes.json.gz', controller.signal).then((volcanoCatalog) => {
      setVolcanoes(volcanoCatalog);
    }).catch(() => undefined).finally(() => setVolcanoesReady(true));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!stationsRequested) return;
    const controller = new AbortController();
    void loadCompressedJson<SeismicStation[]>('stations.json.gz', controller.signal).then((stationCatalog) => {
      setStations(stationCatalog);
      const version = `fdsn-live-v2:${stationCatalog.length}`;
      if (localStorage.getItem('episismic:station-catalog-version') !== version) {
        const persist = () => void persistStationsInBatches(stationCatalog, version);
        const requestIdle = (window as unknown as { requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number }).requestIdleCallback;
        if (requestIdle) requestIdle(persist, { timeout: 5000 });
        else window.setTimeout(persist, 1200);
      }
    }).catch(() => undefined).finally(() => setStationsReady(true));
    return () => controller.abort();
  }, [stationsRequested]);

  useEffect(() => {
    if (!secondaryStationsRequested) return;
    const controller = new AbortController();
    void Promise.all(secondaryStationFiles.map((filename) => loadCompressedJson<SeismicStation[]>(filename, controller.signal))).then((stationCatalogs) => {
      setSecondaryStations(stationCatalogs.flat());
    }).catch(() => undefined).finally(() => setSecondaryStationsReady(true));
    return () => controller.abort();
  }, [secondaryStationsRequested]);

  return {
    stations,
    secondaryStations,
    volcanoes,
    ready: volcanoesReady && (!stationsRequested || stationsReady) && (!secondaryStationsRequested || secondaryStationsReady),
    stationsReady,
    stationsRequested,
    secondaryStationsReady,
    secondaryStationsRequested,
  };
}
