import { useEffect, useMemo, useState } from 'react';
import {
  BellRing, BookOpen, Database, ExternalLink, Info, Layers3, LoaderCircle,
  Map, RadioTower, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { getDatabaseStats, upsertEarthquakes } from '../services/database';
import { searchHistoricalEarthquakes } from '../services/usgs';
import type {
  Earthquake, Filters, MapLayerState, MapStyle, SeismicStation, ThemeMode,
} from '../types';
import type { PanelId } from './TopBar';

interface ControlPanelProps {
  panel: Exclude<PanelId, null>;
  layers: MapLayerState;
  filters: Filters;
  mapStyle: MapStyle;
  theme: ThemeMode;
  autoFocus: boolean;
  autoFocusMagnitude: number;
  stations: SeismicStation[];
  onClose: () => void;
  onLayers: (layers: MapLayerState) => void;
  onFilters: (filters: Filters) => void;
  onMapStyle: (style: MapStyle) => void;
  onTheme: (theme: ThemeMode) => void;
  onAutoFocus: (active: boolean) => void;
  onAutoFocusMagnitude: (magnitude: number) => void;
  onSelectStation: (station: SeismicStation) => void;
  onHistoricalResults: (events: Earthquake[]) => void;
}

const mapStyles: { id: MapStyle; name: string; description: string }[] = [
  { id: 'political', name: 'Político plano', description: 'Fronteras y lectura clara' },
  { id: 'satellite', name: 'Satélite', description: 'Color natural global' },
  { id: 'relief', name: 'Relieve', description: 'Topografía sombreada' },
  { id: 'bathymetry', name: 'Batimetría', description: 'Lectura del fondo oceánico' },
  { id: 'dark', name: 'Sísmico oscuro', description: 'Máximo contraste de datos' },
  { id: 'night', name: 'Nocturno', description: 'Luces y actividad humana' },
];

const layerDefinitions: { id: keyof MapLayerState; label: string; detail: string }[] = [
  { id: 'earthquakes', label: 'Terremotos', detail: 'Epicentros por profundidad' },
  { id: 'stations', label: 'Estaciones sísmicas', detail: 'Redes FDSN públicas' },
  { id: 'plates', label: 'Límites tectónicos', detail: 'Trazas de placas y dorsales' },
  { id: 'volcanoes', label: 'Volcanes', detail: 'Sistemas volcánicos activos' },
  { id: 'labels', label: 'Nombres geográficos', detail: 'Ciudades de referencia' },
  { id: 'atmosphere', label: 'Atmósfera', detail: 'Halo de lectura del globo' },
  { id: 'graticule', label: 'Retícula geográfica', detail: 'Latitud y longitud' },
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
        {layerDefinitions.map((layer) => (
          <label key={layer.id}>
            <span><strong>{layer.label}</strong><small>{layer.detail}</small></span>
            <input type="checkbox" checked={layers[layer.id]} onChange={() => onLayers({ ...layers, [layer.id]: !layers[layer.id] })} />
            <i />
          </label>
        ))}
      </div>
    </section>
  </>;
}

function FiltersPanel({ filters, onFilters }: Pick<ControlPanelProps, 'filters' | 'onFilters'>) {
  return <section className="control-section">
    <h3><SlidersHorizontal size={16} /> Umbrales visibles</h3>
    <label className="range-field">
      <span>Magnitud mínima <strong>M{filters.minMagnitude.toFixed(1)}</strong></span>
      <input type="range" min="0" max="8" step="0.1" value={filters.minMagnitude} onChange={(event) => onFilters({ ...filters, minMagnitude: Number(event.target.value) })} />
    </label>
    <label className="range-field">
      <span>Profundidad máxima <strong>{filters.maxDepthKm} km</strong></span>
      <input type="range" min="10" max="700" step="10" value={filters.maxDepthKm} onChange={(event) => onFilters({ ...filters, maxDepthKm: Number(event.target.value) })} />
    </label>
    <label className="check-row">
      <input type="checkbox" checked={filters.significantOnly} onChange={(event) => onFilters({ ...filters, significantOnly: event.target.checked })} />
      <span><strong>Solo eventos significativos</strong><small>USGS significance ≥ 600 o magnitud ≥ 6</small></span>
    </label>
    <button className="secondary-button" onClick={() => onFilters({ minMagnitude: 0, maxDepthKm: 700, query: '', significantOnly: false })}>Restablecer filtros</button>
  </section>;
}

function ArchivePanel({ onHistoricalResults }: Pick<ControlPanelProps, 'onHistoricalResults'>) {
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
      setMessage(`${results.length.toLocaleString('es-ES')} eventos recuperados y guardados en SQLite.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La consulta no se pudo completar.');
    } finally { setLoading(false); }
  };

  return <section className="control-section">
    <h3><Database size={16} /> Archivo sísmico</h3>
    <p className="section-intro">Las consultas se incorporan a la base SQLite local y conservan las revisiones posteriores.</p>
    <form className="archive-form" onSubmit={submit}>
      <label>Desde<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label>
      <label>Hasta<input type="date" value={end} min={start} max={today.toISOString().slice(0, 10)} onChange={(event) => setEnd(event.target.value)} /></label>
      <label className="range-field"><span>Magnitud mínima <strong>M{minMagnitude.toFixed(1)}</strong></span><input type="range" min="2.5" max="9" step="0.1" value={minMagnitude} onChange={(event) => setMinMagnitude(Number(event.target.value))} /></label>
      <button className="primary-button" disabled={loading}>{loading && <LoaderCircle size={16} className="spin" />} Consultar hasta 5.000 eventos</button>
    </form>
    <p className="form-message">{message}</p>
  </section>;
}

function StationsPanel({ stations, onSelectStation }: Pick<ControlPanelProps, 'stations' | 'onSelectStation'>) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => stations.filter((station) => `${station.id} ${station.name} ${station.country}`.toLowerCase().includes(query.toLowerCase())), [query, stations]);
  return <section className="control-section station-catalogue">
    <h3><RadioTower size={16} /> Catálogo de estaciones</h3>
    <label className="inline-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, país o estación" /></label>
    <div className="station-list">
      {results.map((station) => <button key={station.id} onClick={() => onSelectStation(station)}>
        <span><i className={`station-status ${station.status}`} />{station.id}</span>
        <strong>{station.name}</strong><small>{station.country} · {station.elevationM} m</small>
      </button>)}
    </div>
  </section>;
}

function SettingsPanel(props: Pick<ControlPanelProps, 'theme' | 'autoFocus' | 'autoFocusMagnitude' | 'onTheme' | 'onAutoFocus' | 'onAutoFocusMagnitude'>) {
  const [stats, setStats] = useState<{ events: number; updates: number; sizeBytes: number } | null>(null);
  useEffect(() => { void getDatabaseStats().then(setStats); }, []);
  return <>
    <section className="control-section">
      <h3><BellRing size={16} /> Detección y enfoque</h3>
      <div className="switch-list">
        <label><span><strong>Enfoque automático</strong><small>Desplaza la cámara al detectar un evento nuevo</small></span><input type="checkbox" checked={props.autoFocus} onChange={(event) => props.onAutoFocus(event.target.checked)} /><i /></label>
      </div>
      <label className="range-field"><span>Magnitud para enfocar <strong>M{props.autoFocusMagnitude.toFixed(1)}</strong></span><input type="range" min="3" max="8" step="0.1" value={props.autoFocusMagnitude} onChange={(event) => props.onAutoFocusMagnitude(Number(event.target.value))} /></label>
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

function GuidePanel() {
  return <section className="control-section prose-panel">
    <h3><BookOpen size={16} /> Enciclopedia sísmica</h3>
    <p>Episismic representa el hipocentro bajo la superficie y el epicentro sobre el globo. El color del marcador indica profundidad; su tamaño responde a la magnitud.</p>
    <h4>Frentes de onda</h4><p>La onda P aparece en azul y se propaga más deprisa. La onda S aparece con el color de severidad del evento y avanza más lentamente.</p>
    <h4>Estado del dato</h4><p><strong>Automático</strong> indica una solución rápida susceptible de revisión. <strong>Revisado</strong> indica intervención o validación posterior de la red de origen.</p>
    <h4>Capas</h4><p>Combina estaciones, límites tectónicos, volcanes, retícula y nombres geográficos. Acerca el globo para separar estaciones cercanas.</p>
  </section>;
}

function AboutPanel() {
  return <section className="control-section prose-panel">
    <h3><Info size={16} /> Acerca de Episismic</h3>
    <p>Observatorio geofísico mundial creado por Alejandro Pico. El núcleo inicial está dedicado a terremotos y se ha diseñado para incorporar volcanes, huracanes, grandes tormentas e incendios.</p>
    <p>Los datos sísmicos mostrados proceden principalmente de servicios públicos USGS/ComCat y metadatos FDSN. La atribución concreta se conserva junto a cada registro.</p>
    <div className="about-links">
      <a href="https://alejandropico.github.io/" target="_blank" rel="noreferrer">Portfolio <ExternalLink size={14} /></a>
      <a href="https://github.com/AlejandroPico/Episismic" target="_blank" rel="noreferrer">Código y documentación <ExternalLink size={14} /></a>
    </div>
  </section>;
}

const titles: Record<Exclude<PanelId, null>, string> = {
  layers: 'Capas y cartografía', filters: 'Filtros del catálogo', archive: 'Consulta histórica',
  stations: 'Red sísmica mundial', settings: 'Preferencias y alertas', guide: 'Guía científica', about: 'Acerca del proyecto',
};

export function ControlPanel(props: ControlPanelProps) {
  return <aside className="control-panel">
    <header className="panel-header"><div><p className="eyebrow">EPISISMIC / CONTROL</p><h2>{titles[props.panel]}</h2></div><button className="icon-button" onClick={props.onClose} title="Cerrar"><X size={18} /></button></header>
    <div className="control-scroll">
      {props.panel === 'layers' && <LayersPanel {...props} />}
      {props.panel === 'filters' && <FiltersPanel {...props} />}
      {props.panel === 'archive' && <ArchivePanel {...props} />}
      {props.panel === 'stations' && <StationsPanel {...props} />}
      {props.panel === 'settings' && <SettingsPanel {...props} />}
      {props.panel === 'guide' && <GuidePanel />}
      {props.panel === 'about' && <AboutPanel />}
    </div>
  </aside>;
}
