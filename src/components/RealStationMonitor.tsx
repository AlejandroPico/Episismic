import { useEffect, useMemo, useState } from 'react';
import { Activity, LoaderCircle, RefreshCw } from 'lucide-react';
import type { SeismicStation } from '../types';
import { discoverStationChannels, earthScopeWaveformPlotUrl, type FdsnChannel } from '../services/fdsnWaveforms';

export function RealStationMonitor({ station, minFrequency, maxFrequency, timeWindowSeconds }: { station: SeismicStation; minFrequency: number; maxFrequency: number; timeWindowSeconds: number }) {
  const [channels, setChannels] = useState<FdsnChannel[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [plotEnd, setPlotEnd] = useState(() => new Date(Date.now() - 60_000));
  const [failedChannels, setFailedChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setChannels([]);
    setFailedChannels(new Set());
    void discoverStationChannels(station, controller.signal).then((items) => {
      setChannels(items);
      setState(items.length ? 'ready' : 'empty');
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState('error');
    });
    return () => controller.abort();
  }, [inventoryRevision, station]);

  useEffect(() => {
    const interval = window.setInterval(() => setPlotEnd(new Date(Date.now() - 60_000)), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => setFailedChannels(new Set()), [plotEnd]);

  const range = useMemo(() => {
    return { end: plotEnd, start: new Date(plotEnd.getTime() - timeWindowSeconds * 1000) };
  }, [plotEnd, timeWindowSeconds]);

  if (state === 'loading') return <div className="real-waveform-state"><LoaderCircle className="spin" size={18} /><strong>Consultando inventario instrumental FDSN…</strong><span>{station.source} · {station.id}</span></div>;
  if (state === 'empty' || state === 'error') return <div className="real-waveform-state unavailable"><Activity size={18} /><strong>No hay una terna instrumental accesible</strong><span>{state === 'error' ? 'El proveedor no permitió consultar el inventario desde el navegador.' : 'El centro de datos no publica ahora tres componentes compatibles para esta estación.'} Episismic no generará una señal sustitutiva.</span><button onClick={() => setInventoryRevision((value) => value + 1)}><RefreshCw size={13} /> Reintentar</button></div>;

  return <>
    <div className="real-station-components">
      {channels.map((channel) => {
        const id = `${channel.location}.${channel.channel}`;
        const failed = failedChannels.has(id);
        return <article key={id}>
          <div className="waveform-title"><span>{channel.network}.{channel.station}.{channel.location || '--'}.{channel.channel} · {channel.sampleRate || '—'} MUESTRAS/S</span><em>DATOS INSTRUMENTALES</em></div>
          {!failed ? <img src={earthScopeWaveformPlotUrl(channel, range.start, range.end, minFrequency, maxFrequency)} onError={() => setFailedChannels((current) => new Set(current).add(id))} alt={`Registro instrumental real ${id}`} /> : <div className="real-channel-unavailable"><Activity size={15} /><span>Sin muestras públicas para esta ventana</span></div>}
        </article>;
      })}
    </div>
    <div className="real-waveform-provenance"><span><i /> DATOS REALES · archivo FDSN de {station.source}</span><span>Render oficial EarthScope · actualización cada 60 s · ventana terminada hace 1 min</span><button onClick={() => setPlotEnd(new Date(Date.now() - 60_000))}><RefreshCw size={13} /> Actualizar</button></div>
  </>;
}
