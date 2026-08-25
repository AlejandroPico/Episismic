import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Database, ExternalLink, LocateFixed, Play, RadioTower, Ruler, Timer, X } from 'lucide-react';
import { fetchEventTechnicalDetails, type EventTechnicalDetails, type FocalMechanism } from '../services/eventDetails';
import type { Earthquake, EarthquakeSolution, SeismicStation } from '../types';
import { formatDateTime, formatMagnitude, haversineKm, intensityLabel, magnitudeColor, toRomanIntensity } from '../utils/format';
import { WaveSimulator } from './WaveSimulator';
import { SeismicAnalysis } from './SeismicAnalysis';

type InspectorTab = 'summary' | 'data' | 'focal' | 'sequence' | 'analysis' | 'waves' | 'revisions' | 'compare';

interface EventInspectorProps {
  event: Earthquake;
  events: Earthquake[];
  stations: SeismicStation[];
  comparisonEvents: Earthquake[];
  waveSpeed: number;
  wavePaused: boolean;
  waveInterior: boolean;
  onClose: () => void;
  onFocus: () => void;
  onStartWave: (event: Earthquake) => void;
  onWaveSpeed: (speed: number) => void;
  onWavePaused: (paused: boolean) => void;
  onWaveInterior: (visible: boolean) => void;
  onPlaySequence: (event: Earthquake) => void;
  onToggleComparison: (event: Earthquake) => void;
  onClearComparison: () => void;
}

const magnitudeDescriptions: Record<string, string> = {
  mw: 'Magnitud de momento', mww: 'Magnitud de momento W-phase', mwc: 'Momento sísmico de centroide',
  mwr: 'Momento sísmico regional', ml: 'Magnitud local (Richter)', mb: 'Magnitud de ondas de cuerpo',
  ms: 'Magnitud de ondas superficiales', md: 'Magnitud de duración', mi: 'Magnitud de intensidad',
};

function magnitudeDescription(type: string) { return magnitudeDescriptions[type.toLowerCase()] ?? 'Escala indicada por la agencia de origen'; }
function energyJoules(magnitude: number) { return 10 ** (1.5 * magnitude + 4.8); }
function formatScientific(value: number | null, digits = 2) { return value === null || !Number.isFinite(value) ? '—' : value.toExponential(digits).replace('e+', ' × 10^'); }
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
    <g clipPath="url(#focal-clip)" fill="none" stroke="#071318" strokeWidth="3"><path d={`M 4 50 Q 50 ${bend1} 96 50`} transform={`rotate(${strike1} 50 50)`} /><path d={`M 4 50 Q 50 ${100 - bend2} 96 50`} transform={`rotate(${strike2} 50 50)`} /></g>
  </svg>;
}

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: 'summary', label: 'Resumen' }, { id: 'data', label: 'Datos' }, { id: 'focal', label: 'Focal' },
  { id: 'sequence', label: 'Secuencia' }, { id: 'analysis', label: 'Análisis' }, { id: 'waves', label: 'Ondas' }, { id: 'revisions', label: 'Revisiones' }, { id: 'compare', label: 'Comparar' },
];

export function EventInspector({
  event, events, stations, comparisonEvents, waveSpeed, wavePaused, waveInterior, onClose, onFocus, onStartWave,
  onWaveSpeed, onWavePaused, onWaveInterior, onPlaySequence, onToggleComparison, onClearComparison,
}: EventInspectorProps) {
  const [details, setDetails] = useState<EventTechnicalDetails | null>(null);
  const [detailState, setDetailState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [activeTab, setActiveTab] = useState<InspectorTab>('summary');

  useEffect(() => { setActiveTab('summary'); }, [event.id]);

  useEffect(() => {
    const controller = new AbortController();
    setDetails(null);
    setDetailState(event.detailUrl ? 'loading' : 'unavailable');
    if (!event.detailUrl) return () => controller.abort();
    void fetchEventTechnicalDetails(event, controller.signal).then((result) => { setDetails(result); setDetailState(result ? 'ready' : 'unavailable'); }).catch((error) => {
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
    const candidates = events.filter((candidate) => candidate.id !== event.id && Math.abs(candidate.time - event.time) <= 14 * 86_400_000 && haversineKm(event, candidate) <= radiusKm);
    const precursors = candidates.filter((candidate) => candidate.time < event.time);
    const aftershocks = candidates.filter((candidate) => candidate.time > event.time);
    const strongestNeighbour = candidates.reduce((maximum, candidate) => Math.max(maximum, candidate.magnitude), -Infinity);
    return { radiusKm, candidates, precursors, aftershocks, swarm: candidates.length >= 8 && strongestNeighbour >= event.magnitude - 0.7 };
  }, [event, events]);
  const classification = eventClassification(details?.eventType ?? event.eventType);
  const duration = details?.sourceDurationSeconds ?? empirical.durationSeconds;
  const strike = details?.focalMechanism?.strike1;
  const compared = comparisonEvents.some((item) => item.id === event.id);
  const chooseTab = (tab: InspectorTab) => { setActiveTab(tab); if (tab === 'waves') onStartWave(event); };

  return <section className="event-inspector scientific-event-inspector compact-event-inspector" aria-label={`Detalles de ${event.place}`}>
    <div className="inspector-accent" style={{ background: magnitudeColor(event.magnitude) }} />
    <header><div className="event-mag-large" style={{ color: magnitudeColor(event.magnitude) }}><span>{formatMagnitude(event.magnitude)}</span><small>{event.magnitudeType.toUpperCase()}</small></div><div className="event-heading"><p className="eyebrow">{intensityLabel(event.magnitude)} · {event.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO'}</p><h2>{event.place}</h2><p>{formatDateTime(event.time)}</p></div><div className="panel-actions"><button className={`icon-button compare-pin ${compared ? 'active' : ''}`} onClick={() => onToggleComparison(event)} title={compared ? 'Quitar de comparación' : 'Añadir a comparación'}>±</button><button className="icon-button" onClick={onFocus} title="Centrar en el epicentro"><LocateFixed size={18} /></button><button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button></div></header>
    <nav className="event-inspector-tabs" role="tablist" aria-label="Secciones del terremoto">{tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => chooseTab(tab.id)}>{tab.label}{tab.id === 'compare' && comparisonEvents.length > 0 ? ` ${comparisonEvents.length}` : ''}</button>)}</nav>
    <div className="event-inspector-content">
      {activeTab === 'summary' && <section className="event-tab-panel summary-tab" role="tabpanel"><div className="metric-grid"><article><span>Profundidad</span><strong>{event.depthKm.toFixed(1)} km</strong></article><article><span>Coordenadas</span><strong>{event.lat.toFixed(3)}°, {event.lng.toFixed(3)}°</strong></article><article><span>Intensidad estimada / observada</span><strong>{toRomanIntensity(event.estimatedIntensity ?? event.intensity)} / {toRomanIntensity(event.reportedIntensity ?? null)}</strong></article><article><span>Estado / sig.</span><strong>{event.reviewCode} · {event.significance}</strong></article></div><div className="inspector-flags"><span><RadioTower size={15} /> {event.catalogs.join(' + ')}</span><span>{magnitudeDescription(event.magnitudeType)}</span>{event.felt !== null && <span>Sentido por {event.felt.toLocaleString('es-ES')} personas</span>}{event.alert && <span className={`alert-${event.alert}`}><AlertTriangle size={15} /> Alerta {event.alert}</span>}{event.tsunami && <span className="alert-orange"><AlertTriangle size={15} /> Tsunami</span>}</div><div className="scientific-summary-grid"><article><Activity size={15} /><span>CLASIFICACIÓN</span><strong>{classification}</strong><small>Clasificación automática.</small></article><article><Database size={15} /><span>ENERGÍA ESTIMADA</span><strong>{formatEnergy(energy)}</strong><small>{formatScientific(energy)} J</small></article><article><Ruler size={15} /><span>RUPTURA ESTIMADA</span><strong>≈ {empirical.lengthKm.toFixed(1)} km</strong><small>{strike != null ? `Nodal ${strike.toFixed(0)}°` : 'Sin orientación focal'}</small></article><article><Timer size={15} /><span>DURACIÓN DE FUENTE</span><strong>≈ {duration.toFixed(1)} s</strong><small>{details?.sourceDurationSeconds ? 'Producto técnico' : 'Estimación empírica'}</small></article></div><div className="summary-actions"><button onClick={() => chooseTab('waves')}>Abrir propagación P / S</button><button onClick={() => chooseTab('sequence')}>Explorar secuencia</button><a href={event.sourceUrl} target="_blank" rel="noreferrer">Registro original <ExternalLink size={13} /></a></div></section>}
      {activeTab === 'data' && <section className="event-tab-panel" role="tabpanel"><div className="scientific-detail-state" data-state={detailState}>{detailState === 'loading' && 'Consultando mecanismo focal, tensor e incertidumbres…'}{detailState === 'unavailable' && 'La agencia no ofrece un producto técnico ampliado compatible.'}{detailState === 'error' && 'No se pudo recuperar el producto ampliado; se mantienen los datos del catálogo.'}{detailState === 'ready' && `Producto técnico cargado · ${details?.originAgency} · ${details?.reviewStatus}`}</div><div className="scientific-section-body"><div className="solution-table" role="table"><div className="solution-row solution-header"><span>Agencia</span><span>Magnitud</span><span>Prof.</span><span>Estado</span></div>{solutions.map((solution, index) => <div className="solution-row" key={`${solution.agency}:${index}`}><strong>{solution.agency}</strong><span>M{solution.magnitude.toFixed(1)} {solution.magnitudeType.toUpperCase()}</span><span>{solution.depthKm.toFixed(1)} km</span><span>{solution.status}</span></div>)}</div><div className="uncertainty-grid"><span>Error horizontal<strong>{details?.uncertainty.horizontalKm != null ? `±${details.uncertainty.horizontalKm.toFixed(1)} km` : '—'}</strong></span><span>Error profundidad<strong>{details?.uncertainty.depthKm != null ? `±${details.uncertainty.depthKm.toFixed(1)} km` : '—'}</strong></span><span>Error magnitud<strong>{details?.uncertainty.magnitude != null ? `±${details.uncertainty.magnitude.toFixed(2)}` : '—'}</strong></span><span>Fases<strong>{details?.uncertainty.phases ?? '—'}</strong></span><span>Brecha azimutal<strong>{details?.uncertainty.azimuthalGapDeg != null ? `${details.uncertainty.azimuthalGapDeg.toFixed(0)}°` : '—'}</strong></span><span>Distancia mínima<strong>{details?.uncertainty.minimumDistanceDeg != null ? `${details.uncertainty.minimumDistanceDeg.toFixed(2)}°` : '—'}</strong></span></div></div></section>}
      {activeTab === 'focal' && <section className="event-tab-panel scientific-section-body" role="tabpanel">{details?.focalMechanism ? <><div className="focal-layout"><FocalBall mechanism={details.focalMechanism} /><div className="focal-values"><span>Plano nodal 1<strong>{details.focalMechanism.strike1 ?? '—'}° / {details.focalMechanism.dip1 ?? '—'}° / {details.focalMechanism.rake1 ?? '—'}°</strong><small>rumbo / buzamiento / rake</small></span><span>Plano nodal 2<strong>{details.focalMechanism.strike2 ?? '—'}° / {details.focalMechanism.dip2 ?? '—'}° / {details.focalMechanism.rake2 ?? '—'}°</strong><small>plano auxiliar</small></span><span>Método<strong>{details.focalMechanism.method}</strong></span><span>Momento escalar<strong>{formatScientific(details.momentTensor?.scalarMomentNm ?? null)} N·m</strong></span></div></div>{details.momentTensor && <div className="tensor-grid">{(['mrr', 'mtt', 'mpp', 'mrt', 'mrp', 'mtp'] as const).map((component) => <span key={component}>{component.toUpperCase()}<strong>{formatScientific(details.momentTensor?.[component] ?? null)}</strong></span>)}</div>}</> : <p className="scientific-empty">Todavía no se ha publicado una solución focal para este evento.</p>}</section>}
      {activeTab === 'sequence' && <section className="event-tab-panel scientific-section-body sequence-summary" role="tabpanel"><div className="section-lead"><div><strong>Secuencia local provisional</strong><p>Eventos dentro de {sequence.radiusKm.toFixed(0)} km y ±14 días, limitada al catálogo cargado.</p></div><button className="primary-button" onClick={() => onPlaySequence(event)} disabled={sequence.candidates.length === 0}><Play size={13} /> REPRODUCIR</button></div><div><span>Posibles precursores<strong>{sequence.precursors.length}</strong></span><span>Posibles réplicas<strong>{sequence.aftershocks.length}</strong></span><span>Patrón de enjambre<strong>{sequence.swarm ? 'Posible' : 'No detectado'}</strong></span></div><div className="sequence-event-list">{[...sequence.candidates].sort((a, b) => a.time - b.time).slice(0, 12).map((candidate) => <article key={candidate.id}><time>{formatDateTime(candidate.time)}</time><strong>M{candidate.magnitude.toFixed(1)}</strong><span>{candidate.place}</span></article>)}</div></section>}
      {activeTab === 'analysis' && <section className="event-tab-panel scientific-section-body analysis-tab" role="tabpanel"><SeismicAnalysis event={event} events={events} /></section>}
      {activeTab === 'waves' && <section className="event-tab-panel wave-tab" role="tabpanel"><WaveSimulator embedded event={event} stations={stations} speed={waveSpeed} paused={wavePaused} showInterior={waveInterior} onSpeed={onWaveSpeed} onPaused={onWavePaused} onInterior={onWaveInterior} /></section>}
      {activeTab === 'revisions' && <section className="event-tab-panel scientific-section-body revision-timeline" role="tabpanel"><article><Clock size={14} /><div><span>ORIGEN DEL EVENTO</span><strong>{formatDateTime(event.time)}</strong></div></article>{(details?.revisions ?? []).slice(0, 12).map((revision) => <article key={revision.id}><Database size={14} /><div><span>{revision.kind.toUpperCase()} · {revision.agency}</span><strong>{formatDateTime(revision.updated)} · {revision.status}</strong></div></article>)}<article><Clock size={14} /><div><span>ÚLTIMA ACTUALIZACIÓN</span><strong>{formatDateTime(event.updated)}</strong></div></article></section>}
      {activeTab === 'compare' && <section className="event-tab-panel scientific-section-body compare-panel" role="tabpanel"><div className="section-lead"><div><strong>Comparación de terremotos</strong><p>Añade hasta cuatro eventos desde el botón ± de cada ficha.</p></div>{comparisonEvents.length > 0 && <button onClick={onClearComparison}>LIMPIAR</button>}</div>{comparisonEvents.length === 0 ? <p className="scientific-empty">Todavía no hay eventos en la comparación.</p> : <div className="comparison-table"><div className="comparison-row comparison-header"><span>Evento</span><span>M</span><span>Prof.</span><span>Int.</span><span>Energía</span><span /></div>{comparisonEvents.map((item) => <div className="comparison-row" key={item.id}><span>{item.place}</span><strong style={{ color: magnitudeColor(item.magnitude) }}>{item.magnitude.toFixed(1)}</strong><span>{item.depthKm.toFixed(1)} km</span><span>{toRomanIntensity(item.estimatedIntensity ?? item.intensity)}</span><span>{formatEnergy(energyJoules(item.magnitude))}</span><button onClick={() => onToggleComparison(item)} title="Quitar">×</button></div>)}</div>}</section>}
    </div>
  </section>;
}
