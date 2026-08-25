import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Database, ExternalLink, LocateFixed, RadioTower, Ruler, Timer, X } from 'lucide-react';
import { fetchEventTechnicalDetails, type EventTechnicalDetails, type FocalMechanism } from '../services/eventDetails';
import type { Earthquake, EarthquakeSolution } from '../types';
import { formatDateTime, formatMagnitude, haversineKm, intensityLabel, magnitudeColor, toRomanIntensity } from '../utils/format';

const magnitudeDescriptions: Record<string, string> = {
  mw: 'Magnitud de momento', mww: 'Magnitud de momento W-phase', mwc: 'Momento sísmico de centroide',
  mwr: 'Momento sísmico regional', ml: 'Magnitud local (Richter)', mb: 'Magnitud de ondas de cuerpo',
  ms: 'Magnitud de ondas superficiales', md: 'Magnitud de duración', mi: 'Magnitud de intensidad',
};

function magnitudeDescription(type: string) {
  return magnitudeDescriptions[type.toLowerCase()] ?? 'Escala indicada por la agencia de origen';
}

function energyJoules(magnitude: number) { return 10 ** (1.5 * magnitude + 4.8); }

function formatScientific(value: number | null, digits = 2) {
  return value === null || !Number.isFinite(value) ? '—' : value.toExponential(digits).replace('e+', ' × 10^');
}

function formatEnergy(value: number) {
  if (value >= 1e15) return `${(value / 1e15).toFixed(2)} PJ`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} TJ`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GJ`;
  return `${(value / 1e6).toFixed(2)} MJ`;
}

function empiricalRupture(magnitude: number) {
  const lengthKm = 10 ** (0.5 * magnitude - 1.8);
  return { lengthKm, durationSeconds: Math.max(0.5, lengthKm / 2.8) };
}

function eventClassification(type: string | undefined) {
  const normalized = (type || 'earthquake').toLowerCase();
  if (/quarry|blast|explosion/.test(normalized)) return 'Explosión o voladura';
  if (/ice|rock burst|mine/.test(normalized)) return 'Evento no tectónico';
  if (/volcan/.test(normalized)) return 'Evento volcánico';
  if (/earthquake/.test(normalized)) return 'Terremoto tectónico probable';
  return type || 'Evento sísmico sin clasificar';
}

function mergeSolutions(event: Earthquake, details: EventTechnicalDetails | null) {
  const base: EarthquakeSolution[] = event.solutions?.length ? event.solutions : [{
    agency: event.catalogs[0] || event.source, magnitude: event.magnitude, magnitudeType: event.magnitudeType,
    depthKm: event.depthKm, time: event.time, status: event.status,
  }];
  return [...base, ...(details?.solutions ?? [])].filter((solution, index, all) =>
    all.findIndex((item) => `${item.agency}:${item.magnitude.toFixed(2)}:${item.magnitudeType}` === `${solution.agency}:${solution.magnitude.toFixed(2)}:${solution.magnitudeType}`) === index);
}

function FocalBall({ mechanism }: { mechanism: FocalMechanism }) {
  if (mechanism.beachballUrl) return <img className="focal-ball" src={mechanism.beachballUrl} alt="Diagrama oficial del mecanismo focal" />;
  const strike1 = mechanism.strike1 ?? 0;
  const strike2 = mechanism.strike2 ?? strike1 + 90;
  const bend1 = Math.max(12, Math.min(44, mechanism.dip1 ?? 45));
  const bend2 = Math.max(12, Math.min(44, mechanism.dip2 ?? 45));
  return <svg className="focal-ball" viewBox="0 0 100 100" role="img" aria-label="Proyección de los planos nodales">
    <defs><clipPath id="focal-clip"><circle cx="50" cy="50" r="46" /></clipPath></defs>
    <circle cx="50" cy="50" r="46" fill="#f3f8f7" stroke="#53d6c7" strokeWidth="3" />
    <g clipPath="url(#focal-clip)" fill="none" stroke="#071318" strokeWidth="3">
      <path d={`M 4 50 Q 50 ${bend1} 96 50`} transform={`rotate(${strike1} 50 50)`} />
      <path d={`M 4 50 Q 50 ${100 - bend2} 96 50`} transform={`rotate(${strike2} 50 50)`} />
    </g>
  </svg>;
}

export function EventInspector({ event, events, onClose, onFocus }: { event: Earthquake; events: Earthquake[]; onClose: () => void; onFocus: () => void }) {
  const [details, setDetails] = useState<EventTechnicalDetails | null>(null);
  const [detailState, setDetailState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setDetails(null);
    setDetailState(event.detailUrl ? 'loading' : 'unavailable');
    if (!event.detailUrl) return () => controller.abort();
    void fetchEventTechnicalDetails(event, controller.signal).then((result) => {
      setDetails(result);
      setDetailState(result ? 'ready' : 'unavailable');
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setDetailState('error');
    });
    return () => controller.abort();
  }, [event]);

  const empirical = useMemo(() => empiricalRupture(event.magnitude), [event.magnitude]);
  const energy = useMemo(() => energyJoules(event.magnitude), [event.magnitude]);
  const solutions = useMemo(() => mergeSolutions(event, details), [details, event]);
  const sequence = useMemo(() => {
    const radiusKm = Math.min(350, Math.max(45, 12 * 2 ** Math.max(0, event.magnitude - 3)));
    const candidates = events.filter((candidate) => candidate.id !== event.id
      && Math.abs(candidate.time - event.time) <= 14 * 86_400_000
      && haversineKm(event, candidate) <= radiusKm);
    const precursors = candidates.filter((candidate) => candidate.time < event.time);
    const aftershocks = candidates.filter((candidate) => candidate.time > event.time);
    const strongestNeighbour = candidates.reduce((maximum, candidate) => Math.max(maximum, candidate.magnitude), -Infinity);
    return { radiusKm, precursors, aftershocks, swarm: candidates.length >= 8 && strongestNeighbour >= event.magnitude - 0.7 };
  }, [event, events]);
  const classification = eventClassification(details?.eventType ?? event.eventType);
  const duration = details?.sourceDurationSeconds ?? empirical.durationSeconds;
  const strike = details?.focalMechanism?.strike1;

  return (
    <section className="event-inspector scientific-event-inspector" aria-label={`Detalles de ${event.place}`}>
      <div className="inspector-accent" style={{ background: magnitudeColor(event.magnitude) }} />
      <header>
        <div className="event-mag-large" style={{ color: magnitudeColor(event.magnitude) }}><span>{formatMagnitude(event.magnitude)}</span><small>{event.magnitudeType.toUpperCase()}</small></div>
        <div className="event-heading"><p className="eyebrow">{intensityLabel(event.magnitude)} · {event.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO'}</p><h2>{event.place}</h2><p>{formatDateTime(event.time)}</p></div>
        <div className="panel-actions"><button className="icon-button" onClick={onFocus} title="Centrar en el epicentro"><LocateFixed size={18} /></button><button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button></div>
      </header>

      <div className="metric-grid">
        <article><span>Profundidad</span><strong>{event.depthKm.toFixed(1)} km</strong></article><article><span>Coordenadas</span><strong>{event.lat.toFixed(3)}°, {event.lng.toFixed(3)}°</strong></article>
        <article><span>Intensidad estimada / observada</span><strong>{toRomanIntensity(event.estimatedIntensity ?? event.intensity)} / {toRomanIntensity(event.reportedIntensity ?? null)}</strong></article><article><span>Estado / sig.</span><strong>{event.reviewCode} · {event.significance}</strong></article>
      </div>
      <div className="inspector-flags">
        <span><RadioTower size={15} /> {event.catalogs.join(' + ')}</span><span>{magnitudeDescription(event.magnitudeType)}</span>
        {event.felt !== null && <span>Sentido por {event.felt.toLocaleString('es-ES')} personas</span>}{event.alert && <span className={`alert-${event.alert}`}><AlertTriangle size={15} /> Alerta {event.alert}</span>}{event.tsunami && <span className="alert-orange"><AlertTriangle size={15} /> Bandera de tsunami</span>}
      </div>

      <div className="scientific-summary-grid">
        <article><Activity size={15} /><span>CLASIFICACIÓN</span><strong>{classification}</strong><small>Automática; pendiente de confirmación especializada.</small></article>
        <article><Database size={15} /><span>ENERGÍA ESTIMADA</span><strong>{formatEnergy(energy)}</strong><small>{formatScientific(energy)} J · relación magnitud–energía.</small></article>
        <article><Ruler size={15} /><span>RUPTURA ESTIMADA</span><strong>≈ {empirical.lengthKm.toFixed(1)} km</strong><small>{strike !== null && strike !== undefined ? `Orientación nodal ${strike.toFixed(0)}°` : 'Sin orientación focal publicada'}.</small></article>
        <article><Timer size={15} /><span>DURACIÓN DE FUENTE</span><strong>≈ {duration.toFixed(1)} s</strong><small>{details?.sourceDurationSeconds ? 'Producto técnico publicado' : 'Estimación empírica, no medición'}.</small></article>
      </div>

      <div className="scientific-detail-state" data-state={detailState}>
        {detailState === 'loading' && <>Consultando mecanismo focal, tensor e incertidumbres…</>}{detailState === 'unavailable' && <>La agencia de origen no ofrece un producto técnico ampliado compatible.</>}{detailState === 'error' && <>No se pudo recuperar el producto ampliado; se mantienen los datos del catálogo.</>}{detailState === 'ready' && <>Producto técnico cargado · {details?.originAgency} · {details?.reviewStatus}</>}
      </div>

      <div className="scientific-accordions">
        <details open><summary>Soluciones e incertidumbre <span>{solutions.length} agencias/productos</span></summary><div className="scientific-section-body">
          <div className="solution-table" role="table" aria-label="Comparación de soluciones sísmicas"><div className="solution-row solution-header" role="row"><span>Agencia</span><span>Magnitud</span><span>Prof.</span><span>Estado</span></div>{solutions.map((solution, index) => <div className="solution-row" role="row" key={`${solution.agency}:${solution.magnitude}:${index}`}><strong>{solution.agency}</strong><span>M{solution.magnitude.toFixed(1)} {solution.magnitudeType.toUpperCase()}</span><span>{solution.depthKm.toFixed(1)} km</span><span>{solution.status}</span></div>)}</div>
          <div className="uncertainty-grid">
            <span>Error horizontal<strong>{details?.uncertainty.horizontalKm != null ? `±${details.uncertainty.horizontalKm.toFixed(1)} km` : '—'}</strong></span><span>Error de profundidad<strong>{details?.uncertainty.depthKm != null ? `±${details.uncertainty.depthKm.toFixed(1)} km` : '—'}</strong></span><span>Error de magnitud<strong>{details?.uncertainty.magnitude != null ? `±${details.uncertainty.magnitude.toFixed(2)}` : '—'}</strong></span>
            <span>Fases utilizadas<strong>{details?.uncertainty.phases ?? '—'}</strong></span><span>Brecha azimutal<strong>{details?.uncertainty.azimuthalGapDeg != null ? `${details.uncertainty.azimuthalGapDeg.toFixed(0)}°` : '—'}</strong></span><span>Distancia mínima<strong>{details?.uncertainty.minimumDistanceDeg != null ? `${details.uncertainty.minimumDistanceDeg.toFixed(2)}°` : '—'}</strong></span>
          </div>
        </div></details>

        <details><summary>Mecanismo focal y tensor de momento <span>{details?.focalMechanism ? 'disponible' : 'sin publicar'}</span></summary><div className="scientific-section-body">
          {details?.focalMechanism ? <div className="focal-layout"><FocalBall mechanism={details.focalMechanism} /><div className="focal-values"><span>Plano nodal 1<strong>{details.focalMechanism.strike1 ?? '—'}° / {details.focalMechanism.dip1 ?? '—'}° / {details.focalMechanism.rake1 ?? '—'}°</strong><small>rumbo / buzamiento / rake</small></span><span>Plano nodal 2<strong>{details.focalMechanism.strike2 ?? '—'}° / {details.focalMechanism.dip2 ?? '—'}° / {details.focalMechanism.rake2 ?? '—'}°</strong><small>plano auxiliar</small></span><span>Método<strong>{details.focalMechanism.method}</strong></span><span>Momento escalar<strong>{formatScientific(details.momentTensor?.scalarMomentNm ?? null)} N·m</strong></span></div></div> : <p className="scientific-empty">Todavía no se ha publicado una solución focal para este evento.</p>}
          {details?.momentTensor && <div className="tensor-grid">{(['mrr', 'mtt', 'mpp', 'mrt', 'mrp', 'mtp'] as const).map((component) => <span key={component}>{component.toUpperCase()}<strong>{formatScientific(details.momentTensor?.[component] ?? null)}</strong></span>)}</div>}
        </div></details>

        <details><summary>Secuencia asociada <span>{sequence.precursors.length} precursores · {sequence.aftershocks.length} réplicas</span></summary><div className="scientific-section-body sequence-summary"><p>Detección provisional dentro de {sequence.radiusKm.toFixed(0)} km y ±14 días, limitada al catálogo cargado.</p><div><span>Posibles precursores<strong>{sequence.precursors.length}</strong></span><span>Posibles réplicas<strong>{sequence.aftershocks.length}</strong></span><span>Patrón de enjambre<strong>{sequence.swarm ? 'Posible' : 'No detectado'}</strong></span></div></div></details>

        <details><summary>Línea temporal y revisiones <span>{details?.revisions.length ?? 0} productos</span></summary><div className="scientific-section-body revision-timeline"><article><Clock size={14} /><div><span>ORIGEN DEL EVENTO</span><strong>{formatDateTime(event.time)}</strong></div></article>{(details?.revisions ?? []).slice(0, 12).map((revision) => <article key={revision.id}><Database size={14} /><div><span>{revision.kind.toUpperCase()} · {revision.agency}</span><strong>{formatDateTime(revision.updated)} · {revision.status}</strong></div></article>)}<article><Clock size={14} /><div><span>ÚLTIMA ACTUALIZACIÓN</span><strong>{formatDateTime(event.updated)}</strong></div></article></div></details>
      </div>

      <footer><p>Los valores marcados como estimación son orientativos. Para decisiones de seguridad deben utilizarse organismos oficiales.</p><a href={event.sourceUrl} target="_blank" rel="noreferrer">Abrir registro de origen <ExternalLink size={14} /></a></footer>
    </section>
  );
}
