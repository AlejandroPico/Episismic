import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RadioTower, RotateCcw, X } from 'lucide-react';
import type { Earthquake, SeismicStation } from '../types';
import { formatTravelTime, nearestStationArrivals, waveRadiusKm } from '../services/travelTimes';
import { formatMagnitude } from '../utils/format';

interface WaveSimulatorProps {
  embedded?: boolean;
  event: Earthquake;
  stations: SeismicStation[];
  speed: number;
  paused: boolean;
  showInterior: boolean;
  onSpeed: (speed: number) => void;
  onPaused: (paused: boolean) => void;
  onInterior: (visible: boolean) => void;
  onClose?: () => void;
}

const SPEEDS = [1, 10, 30, 60, 120];

function WaveCrossSection({ event, elapsedSeconds }: { event: Earthquake; elapsedSeconds: number }) {
  const pRadius = waveRadiusKm('P', elapsedSeconds, event.depthKm);
  const sRadius = waveRadiusKm('S', elapsedSeconds, event.depthKm);
  const surfaceRadius = waveRadiusKm('SURFACE', elapsedSeconds, event.depthKm);
  const scaleRadius = (radiusKm: number) => Math.min(150, Math.sqrt(Math.max(0, radiusKm) / 6371) * 150);
  const sourceY = 24 + Math.min(52, Math.sqrt(event.depthKm / 700) * 52);
  return <div className="wave-cross-section">
    <svg viewBox="0 0 360 220" role="img" aria-label="Corte de la propagación de ondas por el interior terrestre">
      <defs><clipPath id="earth-section-clip"><circle cx="180" cy="110" r="98" /></clipPath></defs>
      <circle cx="180" cy="110" r="98" className="earth-mantle" />
      <circle cx="180" cy="110" r="54" className="earth-core-outer" />
      <circle cx="180" cy="110" r="27" className="earth-core-inner" />
      <circle cx="180" cy={sourceY} r="4" className="wave-source" />
      <g clipPath="url(#earth-section-clip)" fill="none">
        <circle cx="180" cy={sourceY} r={scaleRadius(pRadius)} className="wave-shell wave-shell-p" />
        <circle cx="180" cy={sourceY} r={scaleRadius(sRadius)} className="wave-shell wave-shell-s" />
        <circle cx="180" cy={sourceY} r={scaleRadius(surfaceRadius)} className="wave-shell wave-shell-surface" />
      </g>
      <path d="M82 110 A98 98 0 0 1 278 110" className="earth-crust" />
      <text x="12" y="22">SECCIÓN TERRESTRE</text><text x="12" y="38">PROFUNDIDAD × AMPLIFICADA</text>
      <text x="250" y="198">P</text><text x="278" y="198">S</text><text x="306" y="198">L</text>
      <circle cx="242" cy="194" r="4" className="legend-p" /><circle cx="270" cy="194" r="4" className="legend-s" /><circle cx="298" cy="194" r="4" className="legend-surface" />
    </svg>
    <div><span>P<strong>{pRadius.toFixed(0)} km</strong></span><span>S<strong>{sRadius.toFixed(0)} km</strong></span><span>Superficial<strong>{surfaceRadius.toFixed(0)} km</strong></span></div>
  </div>;
}

export function WaveSimulator({ embedded = false, event, stations, speed, paused, showInterior, onSpeed, onPaused, onInterior, onClose }: WaveSimulatorProps) {
  const [simulatedSeconds, setSimulatedSeconds] = useState(0);
  const lastTickRef = useRef(performance.now());
  const arrivals = useMemo(() => nearestStationArrivals(event, stations, 8), [event, stations]);

  useEffect(() => {
    setSimulatedSeconds(0);
    lastTickRef.current = performance.now();
  }, [event.id]);

  useEffect(() => {
    lastTickRef.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (!paused) setSimulatedSeconds((current) => current + deltaSeconds * speed);
    }, 100);
    return () => window.clearInterval(timer);
  }, [paused, speed]);

  const reset = () => {
    setSimulatedSeconds(0);
    lastTickRef.current = performance.now();
    onPaused(false);
  };

  const Root = embedded ? 'div' : 'aside';
  return <Root className={`wave-simulator ${embedded ? 'embedded' : ''} ${showInterior ? 'interior-open' : ''}`} aria-label="Simulador de propagación sísmica">
    {!embedded && <header><div><span>PROPAGACIÓN P / S / SUPERFICIAL</span><strong>{formatMagnitude(event.magnitude)} · {event.place}</strong></div>{onClose && <button className="icon-button" onClick={onClose} title="Cerrar simulación"><X size={16} /></button>}</header>}
    <div className="wave-simulator-controls">
      <button onClick={() => onPaused(!paused)} title={paused ? 'Continuar simulación' : 'Pausar simulación'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      <button onClick={reset} title="Reiniciar propagación"><RotateCcw size={14} /></button>
      <div className="wave-speed-options" aria-label="Velocidad de simulación">{SPEEDS.map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => onSpeed(value)}>{value}×</button>)}</div>
      <button className={showInterior ? 'active' : ''} onClick={() => onInterior(!showInterior)}>INTERIOR</button>
      <span>T+ {formatTravelTime(simulatedSeconds)}</span>
    </div>
    {showInterior && <WaveCrossSection event={event} elapsedSeconds={simulatedSeconds} />}
    <div className="station-arrival-list">
      <div className="station-arrival-heading"><RadioTower size={13} /><span>LLEGADAS PREVISTAS · MODELO TERRESTRE SIMPLIFICADO</span></div>
      {arrivals.map((arrival) => <article key={arrival.station.id}>
        <strong>{arrival.station.network}.{arrival.station.code}</strong><span>{arrival.distanceKm.toFixed(0)} km</span>
        <span className={simulatedSeconds >= arrival.pSeconds ? 'arrived' : ''}>P {simulatedSeconds >= arrival.pSeconds ? 'RECIBIDA' : formatTravelTime(arrival.pSeconds)}</span>
        <span className={simulatedSeconds >= arrival.sSeconds ? 'arrived' : ''}>S {simulatedSeconds >= arrival.sSeconds ? 'RECIBIDA' : formatTravelTime(arrival.sSeconds)}</span>
      </article>)}
    </div>
    <footer>Los tiempos son predicciones educativas calculadas con velocidades por profundidad; no sustituyen boletines de fase de las redes FDSN.</footer>
  </Root>;
}
