import { useEffect, useRef, useState } from 'react';
import { Activity, LoaderCircle, Radio, RefreshCw, WifiOff } from 'lucide-react';
import type { SeismicStation } from '../types';
import { discoverStationMonitorChannels, type FdsnChannel } from '../services/fdsnWaveforms';
import { mergeWaveformBlocks, openSeedlinkStream, queryFdsnWaveformBlocks, type SeedlinkState, type WaveformBlock } from '../services/seedlinkStream';

interface MonitorProps {
  station: SeismicStation;
  minFrequency: number;
  maxFrequency: number;
  timeWindowSeconds: number;
  onFrequencyChange: (minimum: number, maximum: number) => void;
  onTimeWindowChange: (seconds: number) => void;
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function coefficients(type: 'lowpass' | 'highpass', cutoff: number, sampleRate: number): Biquad {
  const omega = 2 * Math.PI * cutoff / sampleRate;
  const cos = Math.cos(omega);
  const alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha;
  const low = type === 'lowpass';
  const b0 = low ? (1 - cos) / 2 : (1 + cos) / 2;
  const b1 = low ? 1 - cos : -(1 + cos);
  const b2 = b0;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cos / a0, a2: (1 - alpha) / a0 };
}

function applyBiquad(input: Float64Array, filter: Biquad) {
  const output = new Float64Array(input.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let index = 0; index < input.length; index += 1) {
    const x0 = input[index];
    const y0 = filter.b0 * x0 + filter.b1 * x1 + filter.b2 * x2 - filter.a1 * y1 - filter.a2 * y2;
    output[index] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return output;
}

function bandPassForDisplay(input: Float64Array, sampleRate: number, minFrequency: number, maxFrequency: number) {
  if (!input.length || sampleRate <= 0) return input;
  const nyquist = sampleRate / 2;
  const high = Math.min(maxFrequency, nyquist * .96);
  const low = Math.min(minFrequency, high * .85);
  let output = input;
  if (low > .0001) output = applyBiquad(output, coefficients('highpass', low, sampleRate));
  if (high > low && high < nyquist) output = applyBiquad(output, coefficients('lowpass', high, sampleRate));
  return output;
}

function frequencyY(value: number, top: number, height: number) {
  const clamped = Math.max(.001, Math.min(100, value));
  return top + (2 - Math.log10(clamped)) / 5 * height;
}

function frequencyAtY(value: number, top: number, height: number) {
  const ratio = Math.max(0, Math.min(1, (value - top) / height));
  return 10 ** (2 - ratio * 5);
}

function drawMonitor(canvas: HTMLCanvasElement, blocks: WaveformBlock[], now: number, windowSeconds: number, minFrequency: number, maxFrequency: number) {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.round(bounds.width * pixelRatio));
  const height = Math.max(220, Math.round(bounds.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const cssWidth = width / pixelRatio;
  const cssHeight = height / pixelRatio;
  const left = 48; const right = 96; const top = 30; const bottom = 34;
  const plotWidth = cssWidth - left - right;
  const plotHeight = cssHeight - top - bottom;
  const startMs = now - windowSeconds * 1000;

  context.fillStyle = '#373737';
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#ffe600';
  context.font = '600 12px IBM Plex Mono, monospace';
  context.textAlign = 'center';
  context.fillText('UTC · EN VIVO', left + plotWidth / 2, 20);

  context.save();
  context.beginPath();
  context.rect(left, top, plotWidth, plotHeight);
  context.clip();
  context.fillStyle = '#414141';
  context.fillRect(left, top, plotWidth, plotHeight);
  context.setLineDash([4, 4]);
  context.lineWidth = 1;
  context.strokeStyle = '#858585';
  for (let step = 0; step <= 10; step += 1) {
    const y = top + step / 10 * plotHeight;
    context.beginPath(); context.moveTo(left, y); context.lineTo(left + plotWidth, y); context.stroke();
  }
  const verticals = 8;
  for (let step = 0; step <= verticals; step += 1) {
    const x = left + step / verticals * plotWidth;
    context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + plotHeight); context.stroke();
  }
  context.setLineDash([]);

  const visible = blocks.filter((block) => block.startMs + block.samples.length / Math.max(1, block.sampleRate) * 1000 >= startMs && block.startMs <= now);
  const plotPixels = Math.max(1, Math.floor(plotWidth));
  const minima = new Float64Array(plotPixels); minima.fill(Number.POSITIVE_INFINITY);
  const maxima = new Float64Array(plotPixels); maxima.fill(Number.NEGATIVE_INFINITY);
  const amplitudeSample: number[] = [];
  for (const block of visible) {
    const filtered = bandPassForDisplay(block.samples, block.sampleRate, minFrequency, maxFrequency);
    const stride = Math.max(1, Math.floor(filtered.length / 3000));
    for (let index = 0; index < filtered.length; index += 1) {
      const sampleTime = block.startMs + index / block.sampleRate * 1000;
      if (sampleTime < startMs || sampleTime > now) continue;
      const value = filtered[index];
      const bucket = Math.min(plotPixels - 1, Math.max(0, Math.floor((sampleTime - startMs) / (now - startMs) * plotPixels)));
      minima[bucket] = Math.min(minima[bucket], value);
      maxima[bucket] = Math.max(maxima[bucket], value);
      if (index % stride === 0 && Number.isFinite(value)) amplitudeSample.push(Math.abs(value));
    }
  }
  amplitudeSample.sort((a, b) => a - b);
  const robustPeak = amplitudeSample[Math.floor(amplitudeSample.length * .985)] || 1;
  const centerY = top + plotHeight / 2;
  const amplitudeScale = plotHeight * .46 / robustPeak;
  context.strokeStyle = '#ffe600';
  context.lineWidth = .85;
  context.beginPath();
  let drew = false;
  for (let xIndex = 0; xIndex < plotPixels; xIndex += 1) {
    if (!Number.isFinite(minima[xIndex]) || !Number.isFinite(maxima[xIndex])) continue;
    const x = left + xIndex;
    const y1 = Math.max(top, Math.min(top + plotHeight, centerY - maxima[xIndex] * amplitudeScale));
    const y2 = Math.max(top, Math.min(top + plotHeight, centerY - minima[xIndex] * amplitudeScale));
    context.moveTo(x, y1); context.lineTo(x, y2); drew = true;
  }
  if (drew) context.stroke();
  context.restore();

  context.strokeStyle = '#8c8c8c';
  context.lineWidth = 1;
  context.strokeRect(left, top, plotWidth, plotHeight);
  context.fillStyle = '#d7d7d7';
  context.font = '600 10px IBM Plex Mono, monospace';
  context.textAlign = 'right';
  for (let step = -100; step <= 100; step += 20) {
    const y = centerY - step / 100 * plotHeight / 2;
    context.fillText(step.toFixed(0), left - 7, y + 3);
  }
  context.textAlign = 'center';
  for (let step = 0; step <= 4; step += 1) {
    const time = new Date(startMs + step / 4 * (now - startMs));
    context.fillText(time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), left + step / 4 * plotWidth, cssHeight - 10);
  }
  context.fillStyle = '#ff3a31';
  context.textAlign = 'left';
  context.fillText(`${minFrequency.toLocaleString('es-ES')} – ${maxFrequency.toLocaleString('es-ES')} Hz`, left + 5, top + plotHeight - 7);

  const frequencyLeft = left + plotWidth + 42;
  context.fillStyle = '#d0d0d0';
  context.font = '600 11px IBM Plex Mono, monospace';
  context.fillText('FRECUENCIA', left + plotWidth + 12, 20);
  context.strokeStyle = '#a8a8a8';
  const frequencyTop = top + 10;
  const frequencyHeight = plotHeight - 20;
  context.beginPath(); context.moveTo(frequencyLeft, frequencyTop); context.lineTo(frequencyLeft, frequencyTop + frequencyHeight); context.stroke();
  for (const frequency of [100, 10, 1, .1, .01, .001]) {
    const y = frequencyY(frequency, frequencyTop, frequencyHeight);
    context.beginPath(); context.moveTo(frequencyLeft, y); context.lineTo(frequencyLeft + 18, y); context.stroke();
    context.fillText(`${String(frequency).replace('.', ',')} Hz`, frequencyLeft + 24, y + 4);
  }
  const bandTop = frequencyY(maxFrequency, frequencyTop, frequencyHeight);
  const bandBottom = frequencyY(minFrequency, frequencyTop, frequencyHeight);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3;
  context.beginPath(); context.moveTo(frequencyLeft, bandTop); context.lineTo(frequencyLeft, bandBottom); context.stroke();
  context.fillStyle = '#ffffff';
  context.fillRect(frequencyLeft - 4, bandTop - 3, 8, 6);
  context.fillRect(frequencyLeft - 4, bandBottom - 3, 8, 6);
  context.fillStyle = '#fff200';
  context.textAlign = 'right';
  context.font = '600 10px IBM Plex Mono, monospace';
  context.fillText(`${maxFrequency.toFixed(1)} Hz`, frequencyLeft - 9, bandTop + 4);
  context.fillText(`${minFrequency.toFixed(1)} Hz`, frequencyLeft - 9, bandBottom + 4);
}

function WaveformCanvas({ blocks, windowSeconds, minFrequency, maxFrequency, onFrequencyChange, onTimeWindowChange }: {
  blocks: WaveformBlock[];
  windowSeconds: number;
  minFrequency: number;
  maxFrequency: number;
  onFrequencyChange: (minimum: number, maximum: number) => void;
  onTimeWindowChange: (seconds: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<'minimum' | 'maximum' | null>(null);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (canvasRef.current) drawMonitor(canvasRef.current, blocks, clock, windowSeconds, minFrequency, maxFrequency);
  }, [blocks, clock, maxFrequency, minFrequency, windowSeconds]);
  const frequencyFromPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const top = 40;
    const height = bounds.height - 84;
    return Math.max(.1, Math.min(10, frequencyAtY(event.clientY - bounds.top, top, height)));
  };
  const startDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width - 108) return;
    const frequency = frequencyFromPointer(event);
    dragRef.current = Math.abs(Math.log10(frequency) - Math.log10(minFrequency)) < Math.abs(Math.log10(frequency) - Math.log10(maxFrequency)) ? 'minimum' : 'maximum';
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const frequency = Math.round(frequencyFromPointer(event) * 10) / 10;
    if (dragRef.current === 'minimum') onFrequencyChange(Math.min(frequency, maxFrequency - .1), maxFrequency);
    else onFrequencyChange(minFrequency, Math.max(frequency, minFrequency + .1));
  };
  return <canvas
    ref={canvasRef}
    className="live-seismogram-canvas interactive"
    aria-label="Sismograma instrumental en tiempo real. Arrastra los extremos de la banda lateral para filtrar frecuencias."
    onPointerDown={startDrag}
    onPointerMove={moveDrag}
    onPointerUp={() => { dragRef.current = null; }}
    onPointerCancel={() => { dragRef.current = null; }}
    onWheel={(event) => {
      event.preventDefault();
      onTimeWindowChange(Math.max(120, Math.min(1800, windowSeconds + (event.deltaY > 0 ? 120 : -120))));
    }}
  />;
}

export function RealStationMonitor({ station, minFrequency, maxFrequency, timeWindowSeconds, onFrequencyChange, onTimeWindowChange }: MonitorProps) {
  const [channels, setChannels] = useState<FdsnChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<FdsnChannel | null>(null);
  const [inventoryState, setInventoryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [blocks, setBlocks] = useState<WaveformBlock[]>([]);
  const [streamState, setStreamState] = useState<SeedlinkState>('connecting');
  const [archiveState, setArchiveState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [lastPacketAt, setLastPacketAt] = useState(0);
  const livePacketRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setInventoryState('loading');
    setChannels([]);
    setSelectedChannel(null);
    void discoverStationMonitorChannels(station, controller.signal).then((items) => {
      setChannels(items);
      setSelectedChannel(items[0] ?? null);
      setInventoryState(items.length ? 'ready' : 'empty');
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setInventoryState('error');
    });
    return () => controller.abort();
  }, [inventoryRevision, station]);

  useEffect(() => {
    if (!selectedChannel) return;
    const controller = new AbortController();
    let disposed = false;
    livePacketRef.current = 0;
    setBlocks([]);
    setStreamState('connecting');
    setArchiveState('loading');
    setLastPacketAt(0);
    const cutoff = () => Date.now() - timeWindowSeconds * 1000;
    const addBlocks = (incoming: WaveformBlock[]) => {
      if (!disposed) setBlocks((current) => mergeWaveformBlocks(current, incoming, cutoff()));
    };
    const loadArchive = () => {
      const end = new Date();
      const start = new Date(end.getTime() - timeWindowSeconds * 1000);
      setArchiveState('loading');
      void queryFdsnWaveformBlocks(station, selectedChannel, start, end, controller.signal).then((items) => {
        if (disposed) return;
        addBlocks(items);
        setArchiveState(items.length ? 'ready' : 'idle');
      }).catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!disposed) setArchiveState('error');
      });
    };
    loadArchive();
    const stream = openSeedlinkStream(selectedChannel, timeWindowSeconds, (block) => {
      livePacketRef.current = Date.now();
      setLastPacketAt(livePacketRef.current);
      addBlocks([block]);
    }, (state) => { if (!disposed) setStreamState(state); });
    const firstPacketTimeout = window.setTimeout(() => {
      if (!livePacketRef.current) {
        stream.close();
        if (!disposed) setStreamState('closed');
        loadArchive();
      }
    }, 12_000);
    const archivePoll = window.setInterval(() => {
      if (Date.now() - livePacketRef.current > 20_000) loadArchive();
    }, 30_000);
    return () => {
      disposed = true;
      controller.abort();
      stream.close();
      window.clearTimeout(firstPacketTimeout);
      window.clearInterval(archivePoll);
    };
  }, [selectedChannel, station, timeWindowSeconds]);

  const latestBlock = blocks.at(-1);
  const lastSampleTime = latestBlock ? latestBlock.startMs + latestBlock.samples.length / Math.max(1, latestBlock.sampleRate) * 1000 : 0;
  const latency = lastSampleTime ? Math.max(0, Math.round((Date.now() - lastSampleTime) / 1000)) : null;
  const status = lastPacketAt ? 'SEEDLINK EN DIRECTO' : blocks.length ? 'DATOS FDSN RECIENTES' : streamState === 'connecting' ? 'CONECTANDO DIRECTO' : archiveState === 'loading' ? 'CONSULTANDO FDSN' : 'SIN MUESTRAS';

  if (inventoryState === 'loading') return <div className="real-waveform-state"><LoaderCircle className="spin" size={18} /><strong>Localizando canales instrumentales y SeedLink…</strong><span>{station.source} · {station.id}</span></div>;
  if (inventoryState === 'empty' || inventoryState === 'error') return <div className="real-waveform-state unavailable"><Activity size={18} /><strong>No hay un canal instrumental accesible</strong><span>Los inventarios de EarthScope, ORFEUS, GEOFON, NCEDC y BMKG no publican ahora un canal vertical abierto para esta estación.</span><button onClick={() => setInventoryRevision((value) => value + 1)}><RefreshCw size={13} /> Reintentar</button></div>;

  return <div className="live-station-monitor">
    <header className="live-monitor-toolbar">
      <div className="live-channel-tabs" role="tablist" aria-label="Canales instrumentales">
        {channels.map((channel) => <button key={`${channel.location}.${channel.channel}`} className={selectedChannel === channel ? 'active' : ''} onClick={() => setSelectedChannel(channel)}>{channel.channel}</button>)}
      </div>
      <div className="live-window-options" aria-label="Ventana temporal">
        {[120, 300, 600, 1200, 1800].map((seconds) => <button key={seconds} className={timeWindowSeconds === seconds ? 'active' : ''} onClick={() => onTimeWindowChange(seconds)}>{seconds / 60}m</button>)}
      </div>
      <div className={`live-stream-state ${lastPacketAt ? 'online' : ''}`}>{lastPacketAt ? <Radio size={13} /> : streamState === 'connecting' || archiveState === 'loading' ? <LoaderCircle className="spin" size={13} /> : <WifiOff size={13} />}<strong>{status}</strong></div>
      <button className="live-monitor-refresh" onClick={() => setInventoryRevision((value) => value + 1)} title="Reconectar y recargar inventario"><RefreshCw size={13} /></button>
    </header>
    <div className="live-monitor-identity">
      <strong>{selectedChannel ? `${selectedChannel.network}.${selectedChannel.station}.${selectedChannel.location || '--'}.${selectedChannel.channel}` : station.id}</strong>
      <span>{selectedChannel?.provider ?? station.source}</span>
      <span>{selectedChannel?.sampleRate || latestBlock?.sampleRate || '—'} muestras/s</span>
      <span>{latency === null ? 'Latencia pendiente' : `Latencia ${latency} s`}</span>
      <span>{blocks.reduce((total, block) => total + block.samples.length, 0).toLocaleString('es-ES')} muestras reales</span>
    </div>
    {blocks.length ? <WaveformCanvas blocks={blocks} windowSeconds={timeWindowSeconds} minFrequency={minFrequency} maxFrequency={maxFrequency} onFrequencyChange={onFrequencyChange} onTimeWindowChange={onTimeWindowChange} /> : <div className="live-monitor-empty">
      {streamState === 'connecting' || archiveState === 'loading' ? <><LoaderCircle className="spin" size={19} /><strong>Buscando la primera muestra instrumental</strong><span>Se prueba el directo disponible y, como máximo a los 12 segundos, se continúa únicamente con el archivo FDSN del mismo proveedor.</span></> : <><Activity size={19} /><strong>Sin muestras para esta ventana</strong><span>El canal existe, pero su centro de datos no ha entregado muestras recientes. Puedes ampliar la ventana o reconectar.</span></>}
    </div>}
    <footer className="live-monitor-provenance">
      <span><i className={lastPacketAt ? 'online' : ''} /> {lastPacketAt ? `Directo ${selectedChannel?.provider ?? ''}` : `Archivo ${selectedChannel?.provider ?? ''} FDSN`}</span>
      <span>Arrastra la escala derecha: {minFrequency.toFixed(1)}–{maxFrequency.toFixed(1)} Hz · rueda: {Math.round(timeWindowSeconds / 60)} min</span>
    </footer>
  </div>;
}
