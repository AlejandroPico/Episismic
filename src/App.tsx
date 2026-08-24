import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Database, RadioTower, X } from 'lucide-react';
import { ControlPanel } from './components/ControlPanel';
import { EventHistory } from './components/EventHistory';
import { EventInspector } from './components/EventInspector';
import { GlobeView } from './components/GlobeView';
import { StationInspector } from './components/StationInspector';
import { Timeline } from './components/Timeline';
import { TopBar, type PanelId } from './components/TopBar';
import { stations } from './data/stations';
import { volcanoes } from './data/volcanoes';
import { useEarthquakes } from './hooks/useEarthquakes';
import type {
  Earthquake, Filters, MapLayerState, MapStyle, SeismicStation, ThemeMode, TimeWindow,
} from './types';
import { formatMagnitude, formatRelativeTime, magnitudeColor } from './utils/format';

const DEFAULT_LAYERS: MapLayerState = {
  earthquakes: true,
  stations: true,
  plates: true,
  volcanoes: false,
  labels: true,
  atmosphere: true,
  graticule: false,
};

function loadPreference<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`episismic:${key}`);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

export default function App() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('day');
  const { events: liveEvents, status, newEvent, refresh } = useEarthquakes(timeWindow);
  const [historicalEvents, setHistoricalEvents] = useState<Earthquake[] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Earthquake | null>(null);
  const [selectedStation, setSelectedStation] = useState<SeismicStation | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; altitude?: number; token: number } | null>(null);
  const [pulseEvent, setPulseEvent] = useState<Earthquake | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [historyOpen, setHistoryOpen] = useState(() => window.innerWidth > 820);
  const [query, setQuery] = useState('');
  const [layers, setLayers] = useState<MapLayerState>(() => loadPreference('layers', DEFAULT_LAYERS));
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => loadPreference('map-style', 'political'));
  const [theme, setTheme] = useState<ThemeMode>(() => loadPreference('theme', 'automatic'));
  const [autoFocus, setAutoFocus] = useState(() => loadPreference('auto-focus', true));
  const [autoFocusMagnitude, setAutoFocusMagnitude] = useState(() => loadPreference('auto-focus-magnitude', 5));
  const [filters, setFilters] = useState<Filters>({ minMagnitude: 0, maxDepthKm: 700, query: '', significantOnly: false });
  const [notice, setNotice] = useState<Earthquake | null>(null);

  const sourceEvents = historicalEvents ?? liveEvents;
  const visibleEvents = useMemo(() => sourceEvents.filter((event) => {
    const search = query.trim().toLowerCase();
    return event.magnitude >= filters.minMagnitude
      && event.depthKm <= filters.maxDepthKm
      && (!filters.significantOnly || event.significance >= 600 || event.magnitude >= 6)
      && (!search || `${event.place} ${event.source} ${event.magnitude.toFixed(1)}`.toLowerCase().includes(search));
  }), [filters, query, sourceEvents]);

  const visibleStations = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return stations;
    const matches = stations.filter((station) => `${station.id} ${station.name} ${station.country}`.toLowerCase().includes(search));
    return matches.length ? matches : stations;
  }, [query]);

  const strongest = useMemo(() => visibleEvents.reduce<Earthquake | null>((max, event) => !max || event.magnitude > max.magnitude ? event : max, null), [visibleEvents]);

  const focus = useCallback((target: { lat: number; lng: number }, altitude = 1.35) => {
    setFocusTarget({ ...target, altitude, token: Date.now() });
  }, []);

  const selectEvent = useCallback((event: Earthquake, animate = true) => {
    setSelectedEvent(event);
    setSelectedStation(null);
    focus(event, event.magnitude >= 6 ? 1.05 : 1.28);
    if (animate) {
      setPulseEvent(event);
      window.setTimeout(() => setPulseEvent((current) => current?.id === event.id ? null : current), 30_000);
    }
  }, [focus]);

  const selectStation = useCallback((station: SeismicStation) => {
    setSelectedStation(station);
    setSelectedEvent(null);
    focus(station, 0.92);
    if (window.innerWidth < 820) setActivePanel(null);
  }, [focus]);

  useEffect(() => {
    if (!newEvent) return;
    setNotice(newEvent);
    window.setTimeout(() => setNotice((current) => current?.id === newEvent.id ? null : current), 12_000);
    if (autoFocus && newEvent.magnitude >= autoFocusMagnitude) selectEvent(newEvent);
  }, [autoFocus, autoFocusMagnitude, newEvent, selectEvent]);

  useEffect(() => {
    const applyTheme = () => {
      const hour = new Date().getHours();
      const resolved = theme === 'automatic' ? (hour >= 7 && hour < 17 ? 'morning' : hour < 21 ? 'afternoon' : 'night') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    const interval = window.setInterval(applyTheme, 60_000);
    localStorage.setItem('episismic:theme', JSON.stringify(theme));
    return () => window.clearInterval(interval);
  }, [theme]);

  useEffect(() => { localStorage.setItem('episismic:layers', JSON.stringify(layers)); }, [layers]);
  useEffect(() => { localStorage.setItem('episismic:map-style', JSON.stringify(mapStyle)); }, [mapStyle]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus', JSON.stringify(autoFocus)); }, [autoFocus]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus-magnitude', JSON.stringify(autoFocusMagnitude)); }, [autoFocusMagnitude]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActivePanel(null); setSelectedEvent(null); setSelectedStation(null); }
      if (event.key.toLowerCase() === 'l' && !(event.target instanceof HTMLInputElement)) setActivePanel((panel) => panel === 'layers' ? null : 'layers');
      if (event.key.toLowerCase() === 'h' && !(event.target instanceof HTMLInputElement)) setHistoryOpen((open) => !open);
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  const changeWindow = (window: TimeWindow) => {
    setHistoricalEvents(null);
    setTimeWindow(window);
  };

  const loadHistorical = (events: Earthquake[]) => {
    setHistoricalEvents(events);
    setHistoryOpen(true);
    if (events[0]) selectEvent(events[0], false);
  };

  return (
    <div className={`app-shell ${historyOpen ? 'with-history' : ''}`}>
      <TopBar
        activePanel={activePanel}
        query={query}
        status={status}
        alertCount={visibleEvents.filter((event) => event.alert || event.magnitude >= 6).length}
        historyOpen={historyOpen}
        onPanel={setActivePanel}
        onQuery={setQuery}
        onHistory={() => setHistoryOpen((open) => !open)}
        onMenu={() => setActivePanel((panel) => panel ? null : 'layers')}
      />

      <main className="map-stage">
        <GlobeView
          events={visibleEvents}
          stations={visibleStations}
          volcanoes={volcanoes}
          layers={layers}
          mapStyle={mapStyle}
          selectedEvent={selectedEvent}
          selectedStation={selectedStation}
          focusTarget={focusTarget}
          pulseEvent={pulseEvent}
          onSelectEvent={selectEvent}
          onSelectStation={selectStation}
        />

        <div className="summary-hud">
          <article><span>VENTANA</span><strong>{historicalEvents ? 'ARCHIVO' : ({ hour: '1 HORA', day: '24 HORAS', week: '7 DÍAS', month: '30 DÍAS' })[timeWindow]}</strong></article>
          <article><span>EVENTOS</span><strong>{visibleEvents.length.toLocaleString('es-ES')}</strong></article>
          <article><span>MÁXIMO</span><strong style={{ color: strongest ? magnitudeColor(strongest.magnitude) : undefined }}>{strongest ? formatMagnitude(strongest.magnitude) : '—'}</strong></article>
          <article><span>ESTACIONES</span><strong>{stations.length}<small> / CATÁLOGO FDSN</small></strong></article>
        </div>

        {activePanel && <ControlPanel
          panel={activePanel}
          layers={layers}
          filters={filters}
          mapStyle={mapStyle}
          theme={theme}
          autoFocus={autoFocus}
          autoFocusMagnitude={autoFocusMagnitude}
          stations={stations}
          onClose={() => setActivePanel(null)}
          onLayers={setLayers}
          onFilters={setFilters}
          onMapStyle={setMapStyle}
          onTheme={setTheme}
          onAutoFocus={setAutoFocus}
          onAutoFocusMagnitude={setAutoFocusMagnitude}
          onSelectStation={selectStation}
          onHistoricalResults={loadHistorical}
        />}

        {selectedEvent && <EventInspector event={selectedEvent} onClose={() => setSelectedEvent(null)} onFocus={() => focus(selectedEvent, 1.05)} />}
        {selectedStation && <StationInspector station={selectedStation} onClose={() => setSelectedStation(null)} onFocus={() => focus(selectedStation, 0.9)} />}

        {notice && <div className="event-notice" style={{ '--notice-color': magnitudeColor(notice.magnitude) } as React.CSSProperties}>
          <BellRing size={19} />
          <div><span>NUEVO EVENTO / ACTUALIZACIÓN</span><strong>{formatMagnitude(notice.magnitude)} · {notice.place}</strong><small>{formatRelativeTime(notice.time)} · {Math.round(notice.depthKm)} km de profundidad</small></div>
          <button onClick={() => selectEvent(notice)}>VER</button>
          <button className="icon-button" onClick={() => setNotice(null)} title="Cerrar"><X size={16} /></button>
        </div>}

        <div className="map-attribution">
          <span>DATOS <a href="https://earthquake.usgs.gov/" target="_blank" rel="noreferrer">USGS</a> / <a href="https://www.earthscope.org/" target="_blank" rel="noreferrer">EarthScope</a></span>
          <span>VISUALIZACIÓN WEBGL</span>
        </div>
        <Timeline events={visibleEvents} timeWindow={timeWindow} onReset={() => focus({ lat: 22, lng: 5 }, 2.25)} />
      </main>

      {historyOpen && <EventHistory
        events={visibleEvents}
        selected={selectedEvent}
        status={status}
        timeWindow={timeWindow}
        onWindowChange={changeWindow}
        onSelect={selectEvent}
        onRefresh={() => { setHistoricalEvents(null); void refresh(); }}
        onClose={() => setHistoryOpen(false)}
      />}

      <div className="mobile-quickbar">
        <button onClick={() => setActivePanel('layers')}><span><Database size={18} /></span>Capas</button>
        <button onClick={() => setHistoryOpen(true)}><span><RadioTower size={18} /></span>Eventos</button>
        <button onClick={() => setActivePanel('settings')}><span><BellRing size={18} /></span>Alertas</button>
        <button onClick={() => setActivePanel('about')}><span><AlertTriangle size={18} /></span>Info</button>
      </div>
    </div>
  );
}
