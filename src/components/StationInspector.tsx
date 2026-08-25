import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, Download, ExternalLink, LocateFixed, Minus, Plus, RadioTower, RotateCcw, X } from 'lucide-react';
import type { SeismicStation } from '../types';
import { elevationContext, fdsnStationLinks, geographicContext, nearestStation, networkMembership, operationalSpan, stationAzimuthCoverage, stationDensity, stationGeoJson } from '../services/stationAnalysis';
import { Waveform } from './Waveform';

type StationTab = 'monitor' | 'network' | 'metadata' | 'data';

const tabs: Array<{ id: StationTab; label: string }> = [
  { id: 'monitor', label: 'Monitor 3C' }, { id: 'network', label: 'Red y cobertura' },
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

export function StationInspector({ station, stations, onClose, onFocus }: { station: SeismicStation; stations: SeismicStation[]; onClose: () => void; onFocus: () => void }) {
  const [activeTab, setActiveTab] = useState<StationTab>('monitor');
  const [minFrequency, setMinFrequency] = useState(.5);
  const [maxFrequency, setMaxFrequency] = useState(5);
  const [timeWindowSeconds, setTimeWindowSeconds] = useState(120);
  const [gain, setGain] = useState(1);

  useEffect(() => {
    setActiveTab('monitor');
    setMinFrequency(.5);
    setMaxFrequency(5);
    setTimeWindowSeconds(120);
    setGain(1);
  }, [station.id]);

  const membership = useMemo(() => networkMembership(station, stations), [station, stations]);
  const nearest = useMemo(() => nearestStation(station, stations), [station, stations]);
  const density = useMemo(() => stationDensity(station, stations), [station, stations]);
  const coverage = useMemo(() => stationAzimuthCoverage(station, stations), [station, stations]);
  const elevation = useMemo(() => elevationContext(station, stations), [station, stations]);
  const operation = useMemo(() => operationalSpan(station), [station]);
  const geography = useMemo(() => geographicContext(station), [station]);
  const links = useMemo(() => fdsnStationLinks(station), [station]);

  return <section className="station-inspector compact-station-inspector">
    <header>
      <div className="station-code"><span>{station.network}</span><strong>{station.code}</strong></div>
      <div className="event-heading"><p className="eyebrow">ESTACIÓN SÍSMICA · {station.status.toUpperCase()}</p><h2>{station.name}</h2><p>{station.country} · {station.source}</p></div>
      <div className="panel-actions"><button className="icon-button" onClick={onFocus} title="Centrar estación"><LocateFixed size={18} /></button><button className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button></div>
    </header>
    <nav className="event-inspector-tabs station-inspector-tabs" role="tablist" aria-label="Secciones de la estación">{tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
    <div className="station-inspector-scroll">
      {activeTab === 'monitor' && <section className="station-tab-panel station-monitor-tab" role="tabpanel">
        <div className="station-components">
          {(['BHZ', 'BHN', 'BHE'] as const).map((channel) => <article key={channel}><div className="waveform-title"><span>{channel} · 20 MUESTRAS/S · COUNTS</span><em>TRAZA SINTÉTICA</em></div><Waveform seed={`${station.id}:${channel}`} minFrequency={minFrequency} maxFrequency={maxFrequency} timeWindowSeconds={timeWindowSeconds} gain={gain} /></article>)}
        </div>
        <div className="waveform-controls station-waveform-controls">
          <div className="waveform-zoom-control"><span>VENTANA TEMPORAL</span><button onClick={() => setTimeWindowSeconds((value) => Math.min(300, value + 30))} title="Alejar sismograma"><Minus size={14} /></button><strong>{timeWindowSeconds} s</strong><button onClick={() => setTimeWindowSeconds((value) => Math.max(30, value - 30))} title="Acercar sismograma"><Plus size={14} /></button></div>
          <label><span>Frecuencia inferior <strong>{minFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.1" max="9.5" step="0.1" value={minFrequency} onChange={(event) => setMinFrequency(Math.min(Number(event.target.value), maxFrequency - .1))} /></label>
          <label><span>Frecuencia superior <strong>{maxFrequency.toFixed(1)} Hz</strong></span><input type="range" min="0.2" max="10" step="0.1" value={maxFrequency} onChange={(event) => setMaxFrequency(Math.max(Number(event.target.value), minFrequency + .1))} /></label>
          <label><span>Ganancia visual <strong>{gain.toFixed(1)}×</strong></span><input type="range" min="0.4" max="3" step="0.1" value={gain} onChange={(event) => setGain(Number(event.target.value))} /></label>
          <button className="waveform-reset" onClick={() => { setMinFrequency(.5); setMaxFrequency(5); setTimeWindowSeconds(120); setGain(1); }} title="Restablecer monitor"><RotateCcw size={15} /></button>
        </div>
        <p className="station-synthetic-note"><Activity size={13} /> Las tres componentes están sincronizadas y claramente identificadas como simulación local; no representan una transmisión SeedLink.</p>
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
          <a href={links.miniSeed} target="_blank" rel="noreferrer"><Activity size={17} /><span><strong>miniSEED · última hora</strong><small>Solicitud BH? preparada en FDSN Dataselect</small></span><ExternalLink size={14} /></a>
          <button onClick={() => downloadText(`${station.id}.geojson`, stationGeoJson(station), 'application/geo+json')}><Download size={17} /><span><strong>Descargar GeoJSON</strong><small>Punto 3D y propiedades de la estación</small></span></button>
          <button onClick={() => downloadText(`${station.id}.json`, JSON.stringify({ station, network: membership, nearest, density, coverage, elevation, operation, geography, links }, null, 2), 'application/json')}><Download size={17} /><span><strong>Descargar informe JSON</strong><small>Metadatos y diagnóstico de red</small></span></button>
        </div>
        <p className="station-data-warning">Las solicitudes FDSN dependen de la disponibilidad pública de EarthScope y de que la red mantenga canales BH activos. Episismic no presenta la traza sintética como dato instrumental real.</p>
        <a className="station-source-link" href={station.dataUrl} target="_blank" rel="noreferrer">Abrir fuente original de metadatos <ExternalLink size={14} /></a>
      </section>}
    </div>
  </section>;
}
