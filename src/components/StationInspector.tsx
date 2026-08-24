import { ExternalLink, LocateFixed, X } from 'lucide-react';
import type { SeismicStation } from '../types';
import { Waveform } from './Waveform';

export function StationInspector({ station, onClose, onFocus }: { station: SeismicStation; onClose: () => void; onFocus: () => void }) {
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
      <div className="waveform-wrap">
        <div className="waveform-title"><span>BHZ · 20 Hz</span><em>VISTA PREVIA SINTÉTICA</em></div>
        <Waveform seed={station.id} />
      </div>
      <div className="metric-grid compact">
        <article><span>Elevación</span><strong>{station.elevationM.toLocaleString('es-ES')} m</strong></article>
        <article><span>Coordenadas</span><strong>{station.lat.toFixed(3)}°, {station.lng.toFixed(3)}°</strong></article>
      </div>
      <footer>
        <p>La traza es una previsualización local y está identificada como tal. La integración miniSEED/SeedLink en directo se añadirá en el servicio de ingesta.</p>
        <a href={station.dataUrl} target="_blank" rel="noreferrer">Consultar metadatos FDSN <ExternalLink size={14} /></a>
      </footer>
    </section>
  );
}
