import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { ControlPanel } from './components/ControlPanel';
import { EventHistory } from './components/EventHistory';
import { EventInspector } from './components/EventInspector';
import { GlobeView } from './components/GlobeView';
import { StationInspector } from './components/StationInspector';
import { Timeline } from './components/Timeline';
import { TopBar, type PanelId } from './components/TopBar';
import { useEarthquakes } from './hooks/useEarthquakes';
import { useGeodata } from './hooks/useGeodata';
import { playSeismicAlert, unlockAudioAlerts } from './services/audioAlerts';
import type {
  Earthquake, Filters, MapLayerState, MapStyle, SeismicStation, ThemeMode, TimeWindow,
} from './types';
import { formatMagnitude, formatRelativeTime, magnitudeColor } from './utils/format';

const DEFAULT_LAYERS: MapLayerState = {
  earthquakes: true,
  stations: true,
  plates: true,
  volcanoes: true,
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
  const { events: liveEvents, status, newEvent, newEvents, refresh } = useEarthquakes(timeWindow);
  const { stations, volcanoes, ready: geodataReady } = useGeodata();
  const [historicalEvents, setHistoricalEvents] = useState<Earthquake[] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Earthquake | null>(null);
  const [selectedStation, setSelectedStation] = useState<SeismicStation | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; altitude?: number; token: number } | null>(null);
  const [pulseEvent, setPulseEvent] = useState<Earthquake | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [historyOpen, setHistoryOpen] = useState(() => window.innerWidth > 820);
  const [layers, setLayers] = useState<MapLayerState>(() => loadPreference('layers-v2', DEFAULT_LAYERS));
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => loadPreference('map-style-v2', 'political'));
  const [theme, setTheme] = useState<ThemeMode>(() => loadPreference('theme', 'automatic'));
  const [autoFocus, setAutoFocus] = useState(() => loadPreference('auto-focus', true));
  const [autoFocusMagnitude, setAutoFocusMagnitude] = useState(() => loadPreference('auto-focus-magnitude', 5));
  const [soundEnabled, setSoundEnabled] = useState(() => loadPreference('sound-enabled', true));
  const [soundMinimumMagnitude, setSoundMinimumMagnitude] = useState(() => loadPreference('sound-minimum-magnitude', -1));
  const [filters, setFilters] = useState<Filters>({ minMagnitude: -2, maxDepthKm: 700, query: '', significantOnly: false });
  const [notice, setNotice] = useState<Earthquake | null>(null);

  const sourceEvents = historicalEvents ?? liveEvents;
  const visibleEvents = useMemo(() => sourceEvents.filter((event) => {
    return event.magnitude >= filters.minMagnitude
      && event.depthKm <= filters.maxDepthKm
      && (!filters.significantOnly || event.significance >= 600 || event.magnitude >= 6);
  }), [filters, sourceEvents]);

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
    if (!soundEnabled || !newEvents.length) return;
    newEvents.filter((event) => event.magnitude >= soundMinimumMagnitude).slice(0, 6)
      .forEach((event, index) => playSeismicAlert(event.magnitude, index * 240));
  }, [newEvents, soundEnabled, soundMinimumMagnitude]);

  useEffect(() => {
    const unlock = () => void unlockAudioAlerts();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

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

  useEffect(() => { localStorage.setItem('episismic:layers-v2', JSON.stringify(layers)); }, [layers]);
  useEffect(() => { localStorage.setItem('episismic:map-style-v2', JSON.stringify(mapStyle)); }, [mapStyle]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus', JSON.stringify(autoFocus)); }, [autoFocus]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus-magnitude', JSON.stringify(autoFocusMagnitude)); }, [autoFocusMagnitude]);
  useEffect(() => { localStorage.setItem('episismic:sound-enabled', JSON.stringify(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('episismic:sound-minimum-magnitude', JSON.stringify(soundMinimumMagnitude)); }, [soundMinimumMagnitude]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActivePanel(null); setHistoryOpen(false); setSelectedEvent(null); setSelectedStation(null); }
      if (event.key.toLowerCase() === 'l' && !(event.target instanceof HTMLInputElement)) { setHistoryOpen(false); setActivePanel((panel) => panel === 'layers' ? null : 'layers'); }
      if (event.key.toLowerCase() === 'h' && !(event.target instanceof HTMLInputElement)) { setActivePanel(null); setHistoryOpen((open) => !open); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  const changeWindow = (window: TimeWindow) => {
    setHistoricalEvents(null);
    setTimeWindow(window);
  };

  const togglePanel = (panel: PanelId) => {
    setActivePanel((current) => current === panel ? null : panel);
    setHistoryOpen(false);
  };

  const toggleHistory = () => {
    setActivePanel(null);
    setHistoryOpen((open) => !open);
  };

  const loadHistorical = (events: Earthquake[]) => {
    setHistoricalEvents(events);
    setActivePanel(null);
    setHistoryOpen(true);
    if (events[0]) selectEvent(events[0], false);
  };

  return (
    <div className={`app-shell ${historyOpen ? 'with-history' : ''}`}>
      <TopBar
        activePanel={activePanel}
        alertCount={visibleEvents.filter((event) => event.alert || event.magnitude >= 6).length}
        historyOpen={historyOpen}
        onPanel={togglePanel}
        onHistory={toggleHistory}
      />

      <main className="map-stage">
        <GlobeView
          events={visibleEvents}
          stations={stations}
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
          <article><span>ESTACIONES</span><strong>{stations.length.toLocaleString('es-ES')}<small> / {geodataReady ? 'FDSN ACTIVO' : 'CARGANDO'}</small></strong></article>
        </div>

        {activePanel && <ControlPanel
          panel={activePanel}
          layers={layers}
          filters={filters}
          mapStyle={mapStyle}
          theme={theme}
          autoFocus={autoFocus}
          autoFocusMagnitude={autoFocusMagnitude}
          soundEnabled={soundEnabled}
          soundMinimumMagnitude={soundMinimumMagnitude}
          stations={stations}
          status={status}
          onClose={() => setActivePanel(null)}
          onLayers={setLayers}
          onFilters={setFilters}
          onMapStyle={setMapStyle}
          onTheme={setTheme}
          onAutoFocus={setAutoFocus}
          onAutoFocusMagnitude={setAutoFocusMagnitude}
          onSoundEnabled={setSoundEnabled}
          onSoundMinimumMagnitude={setSoundMinimumMagnitude}
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
          <span>CATÁLOGOS <a href="https://earthquake.usgs.gov/" target="_blank" rel="noreferrer">USGS</a> / <a href="https://www.seismicportal.eu/" target="_blank" rel="noreferrer">EMSC</a> / <a href="https://geofon.gfz-potsdam.de/" target="_blank" rel="noreferrer">GEOFON</a></span>
          <span>MAPLIBRE / PB2002 / FDSN</span>
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

    </div>
  );
}
