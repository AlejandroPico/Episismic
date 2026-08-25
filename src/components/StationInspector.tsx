import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, Download, ExternalLink, LocateFixed, Minus, Plus, RadioTower, RotateCcw, X } from 'lucide-react';
import type { Earthquake, SeismicStation } from '../types';
import { elevationContext, fdsnStationLinks, geographicContext, nearestStation, networkMembership, operationalSpan, stationAzimuthCoverage, stationDensity, stationGeoJson } from '../services/stationAnalysis';
import { stationAssociationsCsv, stationEventSummary } from '../services/stationEventAnalysis';
import { formatTravelTime } from '../services/travelTimes';
import { formatDateTime, formatRelativeTime, magnitudeColor } from '../utils/format';
import { RealStationMonitor } from './RealStationMonitor';

type StationTab = 'monitor' | 'events' | 'network' | 'metadata' | 'data';

const tabs: Array<{ id: StationTab; label: string }> = [
  { id: 'monitor', label: 'Telemetría real' }, { id: 'events', label: 'Eventos relacionados' }, { id: 'network', label: 'Red y cobertura' },
  { id: 'metadata', label: 'Metadatos' }, { id: 'data', label: 'Datos FDSN' },
];

function downloadText(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const phaseLabels = { 'before-p': 'Esperando P', p: 'P recibida', s: 'S recibida', surface: 'Ondas superficiales', complete: 'Paso completado' } as const;

export function StationInspector({ station, stations, events, onClose, onFocus, onSelectEvent }: { station: SeismicStation; stations: SeismicStation[]; events: Earthquake[]; onClose: () => void; onFocus: () => void; onSelectEvent: (event: Earthquake) => void }) {
  const [activeTab, setActiveTab] = useState<StationTab>('monitor');
  const [associationFocusId, setAssociationFocusId] = useState<string | null>(null);
  const [minFrequency, setMinFrequency] = useState(.5);
  const [maxFrequency, setMaxFrequency] = useState(5);
  const [timeWindowSeconds, setTimeWindowSeconds] = useState(600);

  useEffect(() => {
    setActiveTab('monitor');
    setAssociationFocusId(null);
    setMinFrequency(.5);
    setMaxFrequency(5);
    setTimeWindowSeconds(600);
  }, [station.id]);

  const membership = useMemo(() => networkMembership(station, stations), [station, stations]);
  const nearest = useMemo(() => nearestStation(station, stations), [station, stations]);
  const density = useMemo(() => stationDensity(station, stations), [station, stations]);
  const coverage = useMemo(() => stationAzimuthCoverage(station, stations), [station, stations]);
  const elevation = useMemo(() => elevationContext(station, stations), [station, stations]);
  const operation = useMemo(() => operationalSpan(station), [station]);
  const geography = useMemo(() => geographicContext(station), [station]);
  const links = useMemo(() => fdsnStationLinks(station), [station]);
  const eventSummary = useMemo(() => stationEventSummary(station, events), [station, events]);
  const focusedAssociation = eventSummary.associations.find((item) => item.event.id === associationFocusId) ?? eventSummary.associations[0] ?? null;

  return <section className="station-inspector compact-station-inspector">
    <header>
      <div className="station-code"><span>{station.network}</span><strong>{station.code}</strong></div>
      <div className="event-heading"><p className="eyebrow">ESTACIÓN SÍSMICA · {station.status.toUpperCase()}</p><h2>{station.name}</h2><p>{station.country} · {station.source}</p></div>
      <div className="panel-actions"><button className="icon-button" onClick={onFocus} title="Centrar estación"><LocateFixed size={18} /></button><button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button></div>
    </header>
    <nav className="event-inspector-tabs station-inspector-tabs" role="tablist" aria-label="Secciones de la estación">{tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
    <div className="station-inspector-scroll">
      {activeTab === 'monitor' && <section className="station-tab-panel station-monitor-tab" role="tabpanel">
        <RealStationMonitor station={station} minFrequency={minFrequency} maxFrequency={maxFrequency} timeWindowSeconds={timeWindowSeconds} />
        <div className="waveform-controls station-waveform-controls">
          <div className="waveform-zoom-control"><span>VENTANA REAL</span><button onClick={() => setTimeWindowSeconds((value) => Math.min(1800, value + 120))} title="Ampliar ventana"><Minus size={14} /></button><strong>{Math.round(timeWindowSeconds / 60)} min</strong><button onClick={() => setTimeWindowSeconds((value) => Math.max(120, value - 120))} title="Reducir ventana"><Plus size={14} /></button></div>
          <label><span>Frecuencia inferior <strong>{minFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.1" max="9.5" step="0.1" value={minFrequency} onChange={(event) => setMinFrequency(Math.min(Number(event.target.value), maxFrequency - .1))} /></label>
          <label><span>Frecuencia superior <strong>{maxFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.2" max="10" step="0.1" value={maxFrequency} onChange={(event) => setMaxFrequency(Math.max(Number(event.target.value), minFrequency + .1))} /></label>
          <button className="waveform-reset" onClick={() => { setMinFrequency(.5); setMaxFrequency(5); setTimeWindowSeconds(600); }} title="Restablecer monitor"><RotateCcw size={15} /></button>
        </div>
        <p className="station-synthetic-note real"><Activity size={13} /> Episismic no genera trazas sintéticas. El monitor recibe paquetes MiniSEED por SeedLink WebSocket cuando la red está federada en EarthScope y completa las interrupciones con muestras FDSN reales del proveedor.</p>
      </section>}

      {activeTab === 'network' && <section className="station-tab-panel station-network-tab" role="tabpanel">
        <div className="station-network-grid">
          <article><RadioTower size={17} /><span>RED {station.network}</span><strong>{membership.memberCount.toLocaleString('es-ES')} estaciones cargadas</strong><small>{membership.onlineCount} activas · {membership.countryCount} países</small></article>
          <article><LocateFixed size={17} /><span>VECINA MÁS PRÓXIMA</span><strong>{nearest ? `${nearest.station.id} · ${nearest.distanceKm.toFixed(0)} km` : '—'}</strong><small>{nearest?.station.name ?? 'Sin otra estación cargada'}</small></article>
          <article><Database size={17} /><span>DENSIDAD LOCAL</span><strong>{density.within500Km} estaciones en 500 km</strong><small>{density.within100Km} a 100 km · {density.within1000Km} a 1.000 km</small></article>
          <article><Activity size={17} /><span>CONTEXTO DE ELEVACIÓN</span><strong>Percentil {elevation.percentile.toFixed(0)}</strong><small>{elevation.label} · {station.elevationM.toLocaleString('es-ES')} m</small></article>
        </div>
        <div className="station-coverage-card"><header><div><span>COBERTURA AZIMUTAL · 1.000 KM</span><strong>{coverage.label} · {(coverage.coverage * 100).toFixed(0)}%</strong></div><small>8 sectores de 45°</small></header><div className="station-coverage-rose">{coverage.sectors.map((count, index) => <i key={index} title={`${index * 45}–${(index + 1) * 45}°: ${count} estaciones`} style={{ '--sector': index, '--strength': Math.min(1, count / Math.max(1, ...coverage.sectors)) } as React.CSSProperties} />)}<strong>{(coverage.coverage * 100).toFixed(0)}%</strong></div></div>
      </section>}

      {activeTab === 'events' && <section className="station-tab-panel station-events-tab" role="tabpanel">
        <p className="station-event-method-note"><Activity size={13} /> Esta sección cruza la estación con el catálogo sísmico y calcula si la señal podría ser apreciable. Un terremoto lejano puede aparecer si su magnitud es suficiente, pero solo la telemetría real permite confirmar que la estación lo registró.</p>
        <div className="station-event-summary">
          <article><span>EVENTO MÁS PRÓXIMO</span><strong>{eventSummary.nearest ? `${eventSummary.nearest.distanceKm.toFixed(0)} km` : '—'}</strong><small>{eventSummary.nearest?.event.place ?? 'Sin catálogo'}</small></article>
          <article><span>MAYOR MAGNITUD</span><strong style={{ color: eventSummary.strongest ? magnitudeColor(eventSummary.strongest.event.magnitude) : undefined }}>{eventSummary.strongest ? `M${eventSummary.strongest.event.magnitude.toFixed(1)}` : '—'}</strong><small>{eventSummary.strongest?.event.place ?? 'Sin catálogo'}</small></article>
          <article><span>RADIO DE 1.000 KM</span><strong>{eventSummary.within1000Km}</strong><small>{eventSummary.within500Km} dentro de 500 km</small></article>
          <article><span>CANDIDATOS COMPATIBLES</span><strong>{eventSummary.probableDetections}</strong><small>estimación ≥ 40/100</small></article>
        </div>
        {focusedAssociation && <div className="station-event-detail">
          <header><div><span>ASOCIACIÓN TEÓRICA SELECCIONADA</span><strong>M{focusedAssociation.event.magnitude.toFixed(1)} · {focusedAssociation.event.place}</strong><small>{formatRelativeTime(focusedAssociation.event.time)} · llegada calculada: {phaseLabels[focusedAssociation.phase]}</small></div><button onClick={() => onSelectEvent(focusedAssociation.event)}>ABRIR TERREMOTO</button></header>
          <div className="station-event-metrics">
            <span>Distancia<strong>{focusedAssociation.distanceKm.toFixed(1)} km</strong></span><span>Azimut / back-azimut<strong>{focusedAssociation.azimuthDeg.toFixed(0)}° / {focusedAssociation.backAzimuthDeg.toFixed(0)}°</strong></span>
            <span>Llegada P<strong>{formatTravelTime(focusedAssociation.pSeconds)}</strong><small>{formatDateTime(focusedAssociation.pArrivalTime)}</small></span><span>Llegada S<strong>{formatTravelTime(focusedAssociation.sSeconds)}</strong><small>{formatDateTime(focusedAssociation.sArrivalTime)}</small></span>
            <span>Superficiales<strong>{formatTravelTime(focusedAssociation.surfaceSeconds)}</strong><small>{formatDateTime(focusedAssociation.surfaceArrivalTime)}</small></span><span>Desfase P–S<strong>{formatTravelTime(focusedAssociation.psLagSeconds)}</strong></span>
            <span>Intensidad estimada<strong>MMI {focusedAssociation.estimatedIntensity}</strong></span><span>Compatibilidad teórica<strong>{focusedAssociation.detectionScore}/100 · {focusedAssociation.detectionLabel}</strong></span>
          </div>
        </div>}
        {!focusedAssociation && <div className="station-event-empty"><strong>Sin candidatos compatibles</strong><span>No se muestran eventos globales débiles o demasiado lejanos para esta estación.</span></div>}
        <div className="station-event-list">{eventSummary.associations.slice(0, 20).map((item) => <button key={item.event.id} className={focusedAssociation?.event.id === item.event.id ? 'active' : ''} onClick={() => setAssociationFocusId(item.event.id)}><i style={{ background: magnitudeColor(item.event.magnitude) }} /><strong>M{item.event.magnitude.toFixed(1)}</strong><span>{item.event.place}</span><small>{item.distanceKm.toFixed(0)} km</small><em>{phaseLabels[item.phase]}</em></button>)}</div>
        <div className="station-event-footer"><span>{eventSummary.associations.length} candidatos por distancia o señal estimada · no son detecciones instrumentales confirmadas</span><button onClick={() => downloadText(`${station.id}-eventos.csv`, stationAssociationsCsv(station, events), 'text/csv;charset=utf-8')}><Download size={13} /> EXPORTAR CSV</button></div>
      </section>}

      {activeTab === 'metadata' && <section className="station-tab-panel station-metadata-tab" role="tabpanel">
        <div className="station-metadata-grid">
          <span>Identificador FDSN<strong>{station.id}</strong></span><span>Red / estación<strong>{station.network} / {station.code}</strong></span>
          <span>Latitud<strong>{station.lat.toFixed(5)}°</strong></span><span>Longitud<strong>{station.lng.toFixed(5)}°</strong></span>
          <span>Elevación<strong>{station.elevationM.toLocaleString('es-ES')} m</strong></span><span>Zona geográfica<strong>{geography.zone}</strong></span>
          <span>Hemisferio latitudinal<strong>{geography.latitude}</strong></span><span>Hemisferio longitudinal<strong>{geography.longitude}</strong></span>
          <span>Inicio operativo<strong>{operation.start?.toLocaleDateString('es-ES') ?? 'No publicado'}</strong></span><span>Fin operativo<strong>{operation.end?.toLocaleDateString('es-ES') ?? (operation.active ? 'En servicio' : 'No publicado')}</strong></span>
          <span>Antigüedad conocida<strong>{operation.years == null ? '—' : `${operation.years.toFixed(1)} años`}</strong></span><span>Estado interpretado<strong>{operation.active ? 'Operativa' : station.status}</strong></span>
        </div>
      </section>}

      {activeTab === 'data' && <section className="station-tab-panel station-data-tab" role="tabpanel">
        <div className="station-data-actions">
          <a href={links.stationXml} target="_blank" rel="noreferrer"><Database size={17} /><span><strong>StationXML</strong><small>Respuesta instrumental y metadatos de canal</small></span><ExternalLink size={14} /></a>
          <a href={links.miniSeed} target="_blank" rel="noreferrer"><Activity size={17} /><span><strong>miniSEED real · última hora</strong><small>{links.provider} FDSN Dataselect · canales disponibles</small></span><ExternalLink size={14} /></a>
          <a href={links.channelInventory} target="_blank" rel="noreferrer"><RadioTower size={17} /><span><strong>Inventario de canales</strong><small>Ubicación, componente, frecuencia y periodo operativo</small></span><ExternalLink size={14} /></a>
          <button onClick={() => downloadText(`${station.id}.geojson`, stationGeoJson(station), 'application/geo+json')}><Download size={17} /><span><strong>Descargar GeoJSON</strong><small>Punto 3D y propiedades de la estación</small></span></button>
          <button onClick={() => downloadText(`${station.id}.json`, JSON.stringify({ station, network: membership, nearest, density, coverage, elevation, operation, geography, links }, null, 2), 'application/json')}><Download size={17} /><span><strong>Descargar informe JSON</strong><small>Metadatos y diagnóstico de red</small></span></button>
        </div>
        <p className="station-data-warning">Las solicitudes se dirigen al proveedor real de la estación: {links.provider}. Un error 404 o una respuesta vacía significa que ese centro no conserva muestras para el canal o la ventana solicitada; Episismic no las sustituye por datos inventados.</p>
        <a className="station-source-link" href={station.dataUrl} target="_blank" rel="noreferrer">Abrir fuente original de metadatos <ExternalLink size={14} /></a>
      </section>}
    </div>
  </section>;
}
