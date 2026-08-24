import { AlertTriangle, ExternalLink, LocateFixed, RadioTower, X } from 'lucide-react';
import type { Earthquake } from '../types';
import { formatDateTime, formatMagnitude, intensityLabel, magnitudeColor, toRomanIntensity } from '../utils/format';

export function EventInspector({ event, onClose, onFocus }: { event: Earthquake; onClose: () => void; onFocus: () => void }) {
  return (
    <section className="event-inspector" aria-label={`Detalles de ${event.place}`}>
      <div className="inspector-accent" style={{ background: magnitudeColor(event.magnitude) }} />
      <header>
        <div className="event-mag-large" style={{ color: magnitudeColor(event.magnitude) }}>
          <span>{formatMagnitude(event.magnitude)}</span>
          <small>{event.magnitudeType.toUpperCase()}</small>
        </div>
        <div className="event-heading">
          <p className="eyebrow">{intensityLabel(event.magnitude)} · {event.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO'}</p>
          <h2>{event.place}</h2>
          <p>{formatDateTime(event.time)}</p>
        </div>
        <div className="panel-actions">
          <button className="icon-button" onClick={onFocus} title="Centrar en el epicentro"><LocateFixed size={18} /></button>
          <button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button>
        </div>
      </header>
      <div className="metric-grid">
        <article><span>Profundidad</span><strong>{event.depthKm.toFixed(1)} km</strong></article>
        <article><span>Coordenadas</span><strong>{event.lat.toFixed(3)}°, {event.lng.toFixed(3)}°</strong></article>
        <article><span>Intensidad</span><strong>{toRomanIntensity(event.intensity)}</strong></article>
        <article><span>Estado / sig.</span><strong>{event.reviewCode} · {event.significance}</strong></article>
      </div>
      <div className="inspector-flags">
        <span><RadioTower size={15} /> Fuente {event.source}</span>
        <span>Magnitud {event.magnitudeType.toUpperCase()} · {event.status === 'reviewed' ? 'Revisada' : 'Automática'}</span>
        {event.felt !== null && <span>Sentido por {event.felt.toLocaleString('es-ES')} personas</span>}
        {event.alert && <span className={`alert-${event.alert}`}><AlertTriangle size={15} /> Alerta {event.alert}</span>}
        {event.tsunami && <span className="alert-orange"><AlertTriangle size={15} /> Bandera de tsunami</span>}
      </div>
      <footer>
        <p>Los círculos azul y cálido representan frentes P y S de forma visual. No constituyen una alerta oficial.</p>
        <a href={event.sourceUrl} target="_blank" rel="noreferrer">Abrir registro de origen <ExternalLink size={14} /></a>
      </footer>
    </section>
  );
}
