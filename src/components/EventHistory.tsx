import { AlertTriangle, ChevronRight, Radio, RefreshCw, X } from 'lucide-react';
import type { DataStatus, Earthquake, TimeWindow } from '../types';
import { formatRelativeTime, magnitudeColor, toRomanIntensity } from '../utils/format';

interface EventHistoryProps {
  events: Earthquake[];
  selected: Earthquake | null;
  status: DataStatus;
  timeWindow: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
  onSelect: (event: Earthquake) => void;
  onRefresh: () => void;
  onClose: () => void;
}

const windows: { id: TimeWindow; label: string }[] = [
  { id: 'hour', label: '1 h' }, { id: 'day', label: '24 h' },
  { id: 'week', label: '7 d' }, { id: 'month', label: '30 d' },
];

export function EventHistory({ events, selected, status, timeWindow, onWindowChange, onSelect, onRefresh, onClose }: EventHistoryProps) {
  const renderedEvents = events.slice(0, 900);
  return (
    <aside className="history-panel" aria-label="Historial sísmico">
      <header className="panel-header">
        <div>
          <p className="eyebrow">FLUJO DE EVENTOS</p>
          <h2>Historial sísmico</h2>
        </div>
        <div className="panel-actions">
          <button className="icon-button" onClick={onRefresh} title="Actualizar catálogo"><RefreshCw size={17} /></button>
          <button className="icon-button mobile-only" onClick={onClose} title="Cerrar historial"><X size={18} /></button>
        </div>
      </header>
      <div className="status-strip">
        <span className={`live-dot ${status.state}`} />
        <strong>{status.state === 'live' ? 'CATÁLOGOS ACTUALIZADOS' : status.state === 'loading' ? 'ACTUALIZANDO' : status.state === 'cached' ? 'CACHÉ LOCAL' : 'SIN CONEXIÓN'}</strong>
        <span>{events.length.toLocaleString('es-ES')} eventos</span>
      </div>
      <div className="segmented" aria-label="Ventana temporal">
        {windows.map((item) => (
          <button key={item.id} className={timeWindow === item.id ? 'active' : ''} onClick={() => onWindowChange(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="history-list">
        {renderedEvents.map((event) => (
          <button key={event.id} className={`event-row ${selected?.id === event.id ? 'selected' : ''}`} onClick={() => onSelect(event)}>
            <span className="magnitude-badge" style={{ '--magnitude-color': magnitudeColor(event.magnitude) } as React.CSSProperties}>
              {event.magnitude.toFixed(1)}
            </span>
            <span className="event-copy">
              <span className="event-row-heading"><strong>{event.place}</strong><i className={`review-code ${event.reviewCode.toLowerCase()}`}>{event.reviewCode}</i></span>
              <small>{formatRelativeTime(event.time)} · {event.depthKm.toFixed(1)} km · {event.magnitudeType.toUpperCase()} · INT {toRomanIntensity(event.intensity)}</small>
              <em>{event.source}</em>
            </span>
            {event.tsunami ? <AlertTriangle size={15} className="tsunami-icon" aria-label="Aviso de tsunami" /> : event.magnitude >= 5 ? <Radio size={15} /> : <ChevronRight size={15} />}
          </button>
        ))}
        {events.length > renderedEvents.length && <div className="list-limit">Mapa completo agrupado · listado limitado a los {renderedEvents.length.toLocaleString('es-ES')} eventos más recientes</div>}
        {!events.length && <div className="empty-state"><Radio size={28} /><p>No hay eventos para los filtros actuales.</p></div>}
      </div>
      <footer className="history-footer">
        <span>Fuentes activas</span>
        <a href="https://www.seismicportal.eu/" target="_blank" rel="noreferrer">{status.sources?.join(' · ') || 'USGS · EMSC · GEOFON'}</a>
      </footer>
    </aside>
  );
}
