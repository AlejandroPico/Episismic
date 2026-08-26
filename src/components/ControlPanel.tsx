import { useEffect, useMemo, useState } from 'react';
import {
  BellRing, Database, Download, ExternalLink, Layers3, LoaderCircle, LockKeyhole,
  Map, MonitorDown, RadioTower, Search, SlidersHorizontal, Volume2, X,
} from 'lucide-react';
import { getDatabaseStats, upsertEarthquakes } from '../services/database';
import {
  APP_VERSION, RELEASES_URL, assetForPlatform, detectDesktopPlatform, isNewerVersion, platformLabel,
  type LatestRelease,
} from '../services/releases';
import { searchHistoricalEarthquakes } from '../services/usgs';
import type {
  DataStatus, Earthquake, Filters, MapLayerState, MapStyle, SeismicStation, ThemeMode, TimeWindow,
} from '../types';
import { formatMagnitude, magnitudeColor } from '../utils/format';
import type { PanelId } from './TopBar';
import { Encyclopedia } from './Encyclopedia';

interface ControlPanelProps {
  panel: Exclude<PanelId, null>;
  layers: MapLayerState;
  filters: Filters;
  mapStyle: MapStyle;
  theme: ThemeMode;
  autoFocus: boolean;
  autoFocusMagnitude: number;
  soundEnabled: boolean;
  soundMinimumMagnitude: number;
  cinematicPlayback: boolean;
  waveSpeed: number;
  stations: SeismicStation[];
  operationalStationCount: number;
  secondaryStationCount: number;
  secondaryGeodataReady: boolean;
  status: DataStatus;
  timeWindow: TimeWindow;
  isHistorical: boolean;
  historicalEventCount: number | null;
  visibleEventCount: number;
  strongestEvent: Earthquake | null;
  geodataReady: boolean;
  latestRelease: LatestRelease | null;
  onClose: () => void;
  onLayers: (layers: MapLayerState) => void;
  onFilters: (filters: Filters) => void;
  onMapStyle: (style: MapStyle) => void;
  onTheme: (theme: ThemeMode) => void;
  onAutoFocus: (active: boolean) => void;
  onAutoFocusMagnitude: (magnitude: number) => void;
  onSoundEnabled: (active: boolean) => void;
  onSoundMinimumMagnitude: (magnitude: number) => void;
  onCinematicPlayback: (active: boolean) => void;
  onWaveSpeed: (speed: number) => void;
  onSelectStation: (station: SeismicStation) => void;
  onHistoricalResults: (events: Earthquake[]) => void;
  onReturnToLive: () => void;
}

const mapStyles: { id: MapStyle; name: string; description: string }[] = [
  { id: 'political', name: 'Político plano', description: 'Fronteras y lectura clara' },
  { id: 'satellite', name: 'Satélite', description: 'Color natural global' },
  { id: 'relief', name: 'Relieve', description: 'Topografía sombreada' },
  { id: 'bathymetry', name: 'Batimetría', description: 'Lectura del fondo oceánico' },
];

const layerDefinitions: { id: keyof MapLayerState; label: string; detail: string }[] = [
  { id: 'earthquakes', label: 'Terremotos', detail: 'Epicentros por profundidad' },
  { id: 'stations', label: 'Estaciones sísmicas', detail: 'Redes FDSN públicas' },
  { id: 'plates', label: 'Límites tectónicos', detail: 'Trazas de placas y dorsales' },
  { id: 'volcanoes', label: 'Volcanes', detail: 'Sistemas volcánicos activos' },
  { id: 'labels', label: 'Nombres geográficos', detail: 'Ciudades de referencia' },
  { id: 'atmosphere', label: 'Atmósfera', detail: 'Halo de lectura del globo' },
  { id: 'graticule', label: 'Retícula geográfica', detail: 'Latitud y longitud' },
  { id: 'legend', label: 'Leyenda sísmica', detail: 'Magnitud, profundidad y tectónica' },
  { id: 'shakeMap', label: 'Mapa de intensidad', detail: 'Estimación espacial del movimiento' },
];

function LayersPanel({ layers, mapStyle, onLayers, onMapStyle }: Pick<ControlPanelProps, 'layers' | 'mapStyle' | 'onLayers' | 'onMapStyle'>) {
  return <>
    <section className="control-section">
      <h3><Map size={16} /> Cartografía base</h3>
      <div className="map-style-grid">
        {mapStyles.map((style) => (
          <button key={style.id} className={mapStyle === style.id ? 'active' : ''} onClick={() => onMapStyle(style.id)}>
            <i className={`map-swatch ${style.id}`} />
            <span><strong>{style.name}</strong><small>{style.description}</small></span>
          </button>
        ))}
      </div>
    </section>
    <section className="control-section">
      <h3><Layers3 size={16} /> Capas superpuestas</h3>
      <div className="switch-list">
        {layerDefinitions.map((layer) => {
          const labelsLocked = layer.id === 'labels' && mapStyle === 'relief';
          return <label key={layer.id} className={labelsLocked ? 'disabled' : ''}>
            <span><strong>{layer.label}{labelsLocked && <LockKeyhole size={12} />}</strong><small>{labelsLocked ? 'Incluidos en las teselas de relieve' : layer.detail}</small></span>
            <input type="checkbox" checked={labelsLocked || layers[layer.id]} disabled={labelsLocked} onChange={() => onLayers({ ...layers, [layer.id]: !layers[layer.id] })} />
            <i />
          </label>;
        })}
      </div>
    </section>
  </>;
}

function FiltersPanel({ filters, onFilters }: Pick<ControlPanelProps, 'filters' | 'onFilters'>) {
  return <section className="control-section">
    <h3><SlidersHorizontal size={16} /> Umbrales visibles</h3>
    <label className="range-field">
      <span>Magnitud mínima <strong>M{filters.minMagnitude.toFixed(1)}</strong></span>
      <input type="range" min="-2" max="8" step="0.1" value={filters.minMagnitude} onChange={(event) => onFilters({ ...filters, minMagnitude: Number(event.target.value) })} />
    </label>
    <label className="range-field">
      <span>Profundidad máxima <strong>{filters.maxDepthKm} km</strong></span>
      <input type="range" min="10" max="700" step="10" value={filters.maxDepthKm} onChange={(event) => onFilters({ ...filters, maxDepthKm: Number(event.target.value) })} />
    </label>
    <label className="check-row">
      <input type="checkbox" checked={filters.significantOnly} onChange={(event) => onFilters({ ...filters, significantOnly: event.target.checked })} />
      <span><strong>Solo eventos significativos</strong><small>USGS significance ≥ 600 o magnitud ≥ 6</small></span>
    </label>
    <button className="secondary-button" onClick={() => onFilters({ minMagnitude: -2, maxDepthKm: 700, query: '', significantOnly: false })}>Restablecer filtros</button>
  </section>;
}

function ArchivePanel({
  onHistoricalResults, onReturnToLive, timeWindow, isHistorical, historicalEventCount, visibleEventCount, strongestEvent, stations, geodataReady,
}: Pick<ControlPanelProps, 'onHistoricalResults' | 'onReturnToLive' | 'timeWindow' | 'isHistorical' | 'historicalEventCount' | 'visibleEventCount' | 'strongestEvent' | 'stations' | 'geodataReady'>) {
  const today = new Date();
  const lastYear = new Date(today); lastYear.setFullYear(today.getFullYear() - 1);
  const [start, setStart] = useState(lastYear.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [minMagnitude, setMinMagnitude] = useState(6);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Consulta el catálogo paramétrico de USGS/ComCat.');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('Consultando archivo histórico…');
    try {
      const results = await searchHistoricalEarthquakes({ start: new Date(`${start}T00:00:00Z`), end: new Date(`${end}T23:59:59Z`), minMagnitude, limit: 5000 });
      await upsertEarthquakes(results);
      onHistoricalResults(results);
      setMessage(results.length === 5000
        ? '5.000 eventos recuperados: se ha alcanzado el límite de la consulta. Reduce el intervalo o aumenta la magnitud mínima para obtener una muestra completa.'
        : `${results.length.toLocaleString('es-ES')} eventos recuperados y guardados en SQLite.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La consulta no se pudo completar.');
    } finally { setLoading(false); }
  };

  return <section className="control-section">
    <h3><Database size={16} /> Archivo sísmico</h3>
    <div className="archive-summary" aria-label="Resumen del catálogo visible">
      <article><span>VENTANA</span><strong>{isHistorical ? 'ARCHIVO' : ({ hour: '1 HORA', day: '24 HORAS', week: '7 DÍAS', month: '30 DÍAS' })[timeWindow]}</strong></article>
      <article><span>EVENTOS</span><strong>{visibleEventCount.toLocaleString('es-ES')}</strong></article>
      <article><span>MÁXIMO</span><strong style={{ color: strongestEvent ? magnitudeColor(strongestEvent.magnitude) : undefined }}>{strongestEvent ? formatMagnitude(strongestEvent.magnitude) : '—'}</strong></article>
      <article><span>ESTACIONES</span><strong>{stations.length.toLocaleString('es-ES')}</strong><small>{geodataReady ? 'FDSN DISPONIBLE' : 'CARGANDO RED'}</small></article>
    </div>
    <p className="section-intro">Las consultas se incorporan a la base SQLite local y conservan las revisiones posteriores.</p>
    {isHistorical && <div className="archive-live-return"><div><strong>CATÁLOGO HISTÓRICO ACTIVO · {(historicalEventCount ?? 0).toLocaleString('es-ES')} EVENTOS</strong><span>El globo no está mostrando ahora el flujo de las últimas 24 horas.</span></div><button className="secondary-button" onClick={onReturnToLive}>Volver a tiempo real</button></div>}
    <form className="archive-form" onSubmit={submit}>
      <label>Desde<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label>
      <label>Hasta<input type="date" value={end} min={start} max={today.toISOString().slice(0, 10)} onChange={(event) => setEnd(event.target.value)} /></label>
      <label className="range-field"><span>Magnitud mínima <strong>M{minMagnitude.toFixed(1)}</strong></span><input type="range" min="2.5" max="9" step="0.1" value={minMagnitude} onChange={(event) => setMinMagnitude(Number(event.target.value))} /></label>
      <button className="primary-button" disabled={loading}>{loading && <LoaderCircle size={16} className="spin" />} {loading ? 'Consultando catálogo…' : historicalEventCount === null ? 'Consultar catálogo histórico' : `Repetir consulta · ${historicalEventCount.toLocaleString('es-ES')} encontrados`}</button>
    </form>
    <small className="archive-query-limit">Límite técnico: 5.000 resultados por consulta. No representa el total disponible.</small>
    <p className="form-message">{message}</p>
  </section>;
}

function StationsPanel({
  stations, operationalStationCount, secondaryStationCount, secondaryGeodataReady,
  status, layers, onLayers, onSelectStation,
}: Pick<ControlPanelProps, 'stations' | 'operationalStationCount' | 'secondaryStationCount' | 'secondaryGeodataReady' | 'status' | 'layers' | 'onLayers' | 'onSelectStation'>) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => stations.filter((station) => `${station.id} ${station.name} ${station.country}`.toLowerCase().includes(query.toLowerCase())), [query, stations]);
  return <section className="control-section station-catalogue">
    <h3><RadioTower size={16} /> Catálogo de estaciones</h3>
    <div className="source-health-card" title={status.message}>
      <span className={`live-dot ${status.state}`} />
      <div><strong>{status.sources?.length ?? 0}/3 fuentes sísmicas</strong><small>{status.sources?.join(' · ') || 'Catálogos en sincronización'}{status.lastUpdated ? ` · ${new Date(status.lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></div>
    </div>
    <div className="switch-list station-layer-switch">
      <label>
        <span><strong>Mostrar estaciones operativas</strong><small>{operationalStationCount.toLocaleString('es-ES')} estaciones con flujo anunciado</small></span>
        <input type="checkbox" checked={layers.stations} onChange={() => onLayers({ ...layers, stations: !layers.stations })} />
        <i />
      </label>
      <label>
        <span><strong>Incluir catálogo ampliado</strong><small>{layers.secondaryStations && !secondaryGeodataReady ? 'Cargando bajo demanda…' : secondaryGeodataReady ? `${secondaryStationCount.toLocaleString('es-ES')} estaciones sin directo confirmado` : 'Estaciones históricas o sin directo · carga bajo demanda'}</small></span>
        <input type="checkbox" checked={layers.secondaryStations} onChange={() => onLayers({ ...layers, secondaryStations: !layers.secondaryStations })} />
        <i />
      </label>
    </div>
    <label className="inline-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, país o estación" /></label>
    <p className="catalog-count">{results.length.toLocaleString('es-ES')} estaciones cargadas · se muestran las primeras {Math.min(results.length, 400).toLocaleString('es-ES')}</p>
    <div className="station-list">
      {results.slice(0, 400).map((station) => <button key={station.id} onClick={() => onSelectStation(station)}>
        <span><i className={`station-status ${station.status}`} />{station.id}</span>
        <strong>{station.name}</strong><small>{station.country} · {station.elevationM} m</small>
      </button>)}
    </div>
  </section>;
}

function SettingsPanel(props: Pick<ControlPanelProps, 'theme' | 'autoFocus' | 'autoFocusMagnitude' | 'soundEnabled' | 'soundMinimumMagnitude' | 'cinematicPlayback' | 'waveSpeed' | 'onTheme' | 'onAutoFocus' | 'onAutoFocusMagnitude' | 'onSoundEnabled' | 'onSoundMinimumMagnitude' | 'onCinematicPlayback' | 'onWaveSpeed'>) {
  const [stats, setStats] = useState<{ events: number; updates: number; sizeBytes: number } | null>(null);
  useEffect(() => { void getDatabaseStats().then(setStats); }, []);
  return <>
    <section className="control-section">
      <h3><BellRing size={16} /> Detección y enfoque</h3>
      <div className="switch-list">
        <label><span><strong>Enfoque automático</strong><small>Desplaza la cámara al detectar un evento nuevo</small></span><input type="checkbox" checked={props.autoFocus} onChange={(event) => props.onAutoFocus(event.target.checked)} /><i /></label>
        <label><span><strong>Reproducción cinematográfica</strong><small>Realiza el vuelo de cámara durante el archivo histórico</small></span><input type="checkbox" checked={props.cinematicPlayback} onChange={(event) => props.onCinematicPlayback(event.target.checked)} /><i /></label>
        <label><span><strong>Alertas sonoras por gravedad</strong><small>Cuatro perfiles: leve, moderada, fuerte y crítica</small></span><input type="checkbox" checked={props.soundEnabled} onChange={(event) => props.onSoundEnabled(event.target.checked)} /><i /></label>
      </div>
      <label className="range-field"><span>Magnitud para enfocar <strong>M{props.autoFocusMagnitude.toFixed(1)}</strong></span><input type="range" min="3" max="8" step="0.1" value={props.autoFocusMagnitude} onChange={(event) => props.onAutoFocusMagnitude(Number(event.target.value))} /></label>
      <label className={`range-field ${props.soundEnabled ? '' : 'disabled-control'}`}><span><Volume2 size={14} /> Sonar desde <strong>M{props.soundMinimumMagnitude.toFixed(1)}</strong></span><input type="range" min="-2" max="6" step="0.1" disabled={!props.soundEnabled} value={props.soundMinimumMagnitude} onChange={(event) => props.onSoundMinimumMagnitude(Number(event.target.value))} /></label>
      <div className="wave-speed-setting"><span>Velocidad inicial de ondas</span><div>{[1, 10, 30, 60, 120].map((speed) => <button key={speed} className={props.waveSpeed === speed ? 'active' : ''} onClick={() => props.onWaveSpeed(speed)}>{speed}×</button>)}</div></div>
      <p className="safety-note">Episismic es un observatorio informativo. Las animaciones y estimaciones no sustituyen los sistemas oficiales de alerta temprana.</p>
    </section>
    <section className="control-section">
      <h3>Tema</h3>
      <div className="theme-options">
        {(['automatic', 'morning', 'afternoon', 'night'] as ThemeMode[]).map((theme) => <button key={theme} className={props.theme === theme ? 'active' : ''} onClick={() => props.onTheme(theme)}>{({ automatic: 'Automático', morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' })[theme]}</button>)}
      </div>
    </section>
    <section className="control-section database-card">
      <h3><Database size={16} /> SQLite local</h3>
      <div><span>Eventos</span><strong>{stats?.events.toLocaleString('es-ES') ?? '…'}</strong></div>
      <div><span>Revisiones</span><strong>{stats?.updates.toLocaleString('es-ES') ?? '…'}</strong></div>
      <div><span>Tamaño</span><strong>{stats ? `${(stats.sizeBytes / 1024).toFixed(1)} KB` : '…'}</strong></div>
    </section>
  </>;
}

function AboutPanel({ latestRelease }: Pick<ControlPanelProps, 'latestRelease'>) {
  const platform = detectDesktopPlatform();
  const asset = latestRelease ? assetForPlatform(latestRelease, platform) : null;
  const updateAvailable = Boolean(latestRelease && isNewerVersion(latestRelease.version));
  return <section className="control-section prose-panel about-panel-content">
    <div className="about-identity"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><div><p className="eyebrow">OBSERVATORIO GEOFÍSICO MUNDIAL</p><h3>EPISISMIC</h3><span>Versión {APP_VERSION} · Edición estable · Desarrollado por Alejandro Pico</span></div></div>
    <p>Episismic 1.2.1 es la edición estable y publicable del observatorio tridimensional abierto: integra catálogos sísmicos públicos, estaciones operativas FDSN/SeedLink, un inventario ampliado opcional, volcanes, límites tectónicos, archivo histórico, análisis científico y material educativo en una sola interfaz.</p>
    <p>La arquitectura 1.x queda consolidada para ampliar el proyecto con volcanismo, huracanes, grandes tormentas, incendios y otros riesgos naturales sin mezclar sus modelos de datos.</p>
    <div className="about-principles"><span><strong>3</strong>catálogos sísmicos</span><span><strong>4.000+</strong>estaciones en directo</span><span><strong>SQLite</strong>archivo local</span></div>
    <div className="desktop-download-card">
      <MonitorDown size={28} />
      <div>
        <small>APLICACIÓN NATIVA · {platformLabel(platform).toUpperCase()}</small>
        <strong>{updateAvailable ? `Actualización ${latestRelease?.version} disponible` : `Episismic ${APP_VERSION} para ${platformLabel(platform)}`}</strong>
        <span>Ventana propia del sistema. La aplicación comprueba GitHub Releases al iniciarse y avisa cuando hay una versión superior.{platform === 'macos' && !asset ? ' Elige Intel o Apple Silicon en la página de descargas.' : ''}</span>
      </div>
      <a className="primary-button" href={asset?.browser_download_url || latestRelease?.url || RELEASES_URL} target="_blank" rel="noreferrer">
        <Download size={15} /> {asset ? `Descargar ${(asset.size / 1024 / 1024).toFixed(0)} MB` : 'Ver descargas'}
      </a>
    </div>
    <p className="safety-note">Edición estable de carácter informativo y educativo. Las estimaciones no sustituyen alertas oficiales; para emergencias y decisiones de protección civil deben seguirse siempre los avisos de los organismos competentes.</p>
    <div className="about-links">
      <a href="https://alejandropico.github.io/Portfolio/" target="_blank" rel="noreferrer"><span><small>AUTOR</small>Portfolio de Alejandro Pico</span><ExternalLink size={14} /></a>
      <a href="https://github.com/AlejandroPico/Episismic" target="_blank" rel="noreferrer"><span><small>PROYECTO ABIERTO</small>Código, fuentes y documentación</span><ExternalLink size={14} /></a>
    </div>
  </section>;
}

const titles: Record<Exclude<PanelId, null>, string> = {
  layers: 'Capas y cartografía', filters: 'Filtros del catálogo', archive: 'Consulta histórica',
  stations: 'Red sísmica mundial', settings: 'Preferencias y alertas', guide: 'Enciclopedia sísmica', about: 'Acerca del proyecto',
};

export function ControlPanel(props: ControlPanelProps) {
  return <aside className={`control-panel ${props.panel === 'guide' ? 'encyclopedia-panel' : ''} ${props.panel === 'about' ? 'about-control-panel' : ''}`}>
    <header className="panel-header"><div><p className="eyebrow">EPISISMIC / CONTROL</p><h2>{titles[props.panel]}</h2></div><button className="icon-button" onClick={props.onClose} title="Cerrar"><X size={18} /></button></header>
    <div className="control-scroll">
      {props.panel === 'layers' && <LayersPanel {...props} />}
      {props.panel === 'filters' && <FiltersPanel {...props} />}
      {props.panel === 'archive' && <ArchivePanel {...props} />}
      {props.panel === 'stations' && <StationsPanel {...props} />}
      {props.panel === 'settings' && <SettingsPanel {...props} />}
      {props.panel === 'guide' && <Encyclopedia />}
      {props.panel === 'about' && <AboutPanel {...props} />}
    </div>
  </aside>;
}
