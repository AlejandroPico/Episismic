import { useEffect, useState } from 'react';
import { ExternalLink, LocateFixed, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { SeismicStation } from '../types';
import { Waveform } from './Waveform';

export function StationInspector({ station, onClose, onFocus }: { station: SeismicStation; onClose: () => void; onFocus: () => void }) {
  const [minFrequency, setMinFrequency] = useState(.5);
  const [maxFrequency, setMaxFrequency] = useState(5);
  const [timeWindowSeconds, setTimeWindowSeconds] = useState(120);
  const [gain, setGain] = useState(1);

  useEffect(() => {
    setMinFrequency(.5);
    setMaxFrequency(5);
    setTimeWindowSeconds(120);
    setGain(1);
  }, [station.id]);

  return (
    <section className="station-inspector">
      <header>
        <div className="station-code"><span>{station.network}</span><strong>{station.code}</strong></div>
        <div className="event-heading">
          <p className="eyebrow">ESTACIÓN SÍSMICA · {station.status.toUpperCase()}</p>
          <h2>{station.name}</h2>
          <p>{station.country} · {station.source}</p>
        </div>
        <div className="panel-actions">
          <button className="icon-button" onClick={onFocus} title="Centrar estación"><LocateFixed size={18} /></button>
          <button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button>
        </div>
      </header>
      <div className="station-inspector-scroll">
        <div className="waveform-wrap">
          <div className="waveform-sticky">
            <div className="waveform-title"><span>BHZ · 20 MUESTRAS/S · COUNTS</span><em>MONITOR SINTÉTICO · NO ES SEEDLINK</em></div>
            <Waveform seed={station.id} minFrequency={minFrequency} maxFrequency={maxFrequency} timeWindowSeconds={timeWindowSeconds} gain={gain} />
          </div>
          <div className="waveform-controls">
            <div className="waveform-zoom-control">
              <span>VENTANA TEMPORAL</span>
              <button onClick={() => setTimeWindowSeconds((value) => Math.min(300, value + 30))} title="Alejar sismograma"><Minus size={14} /></button>
              <strong>{timeWindowSeconds} s</strong>
              <button onClick={() => setTimeWindowSeconds((value) => Math.max(30, value - 30))} title="Acercar sismograma"><Plus size={14} /></button>
            </div>
            <label><span>Frecuencia inferior <strong>{minFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.1" max="9.5" step="0.1" value={minFrequency} onChange={(event) => setMinFrequency(Math.min(Number(event.target.value), maxFrequency - .1))} /></label>
            <label><span>Frecuencia superior <strong>{maxFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.2" max="10" step="0.1" value={maxFrequency} onChange={(event) => setMaxFrequency(Math.max(Number(event.target.value), minFrequency + .1))} /></label>
            <label><span>Ganancia visual <strong>{gain.toFixed(1)}×</strong></span><input type="range" min="0.4" max="3" step="0.1" value={gain} onChange={(event) => setGain(Number(event.target.value))} /></label>
            <button className="waveform-reset" onClick={() => { setMinFrequency(.5); setMaxFrequency(5); setTimeWindowSeconds(120); setGain(1); }} title="Restablecer monitor"><RotateCcw size={15} /></button>
          </div>
        </div>
        <div className="metric-grid compact">
          <article><span>Elevación</span><strong>{station.elevationM.toLocaleString('es-ES')} m</strong></article>
          <article><span>Coordenadas</span><strong>{station.lat.toFixed(3)}°, {station.lng.toFixed(3)}°</strong></article>
          <article><span>Banda aplicada</span><strong>{minFrequency.toFixed(1)}–{maxFrequency.toFixed(1)} Hz</strong></article>
          <article><span>Fuente de metadatos</span><strong>{station.source}</strong></article>
        </div>
        <footer>
          <p>La traza es una previsualización local y está identificada como tal. La integración miniSEED/SeedLink en directo se añadirá en el servicio de ingesta.</p>
          <a href={station.dataUrl} target="_blank" rel="noreferrer">Consultar metadatos FDSN <ExternalLink size={14} /></a>
        </footer>
      </div>
    </section>
  );
}
