import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Download, X } from 'lucide-react';
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
import { APP_VERSION, RELEASES_URL, fetchLatestRelease, isNativeApp, isNewerVersion, type LatestRelease } from './services/releases';
import type {
  Earthquake, Filters, MapLayerState, MapStyle, SeismicActivity, SeismicStation, ThemeMode, TimeWindow,
} from './types';
import { formatMagnitude, formatRelativeTime, haversineKm, magnitudeColor } from './utils/format';

const DEFAULT_LAYERS: MapLayerState = {
  earthquakes: true,
  stations: true,
  secondaryStations: false,
  plates: true,
  volcanoes: true,
  labels: true,
  atmosphere: true,
  graticule: false,
  legend: false,
  shakeMap: true,
};

const activityLabels = {
  new: 'NUEVO TERREMOTO DETECTADO',
  magnitude: 'MAGNITUD REVISADA AL ALZA',
  corroborated: 'EVENTO CORROBORADO',
  revision: 'SOLUCIÓN SÍSMICA ACTUALIZADA',
} as const;

function loadPreference<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`episismic:${key}`);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

export default function App() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('day');
  const { events: liveEvents, status, activities, refresh } = useEarthquakes(timeWindow);
  const [stationCatalogueRequested, setStationCatalogueRequested] = useState(true);
  const [secondaryCatalogueRequested, setSecondaryCatalogueRequested] = useState(false);
  const {
    stations: operationalStations,
    secondaryStations,
    volcanoes,
    stationsReady,
    secondaryStationsReady,
  } = useGeodata(stationCatalogueRequested, secondaryCatalogueRequested);
  const [historicalEvents, setHistoricalEvents] = useState<Earthquake[] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Earthquake | null>(null);
  const [selectedStation, setSelectedStation] = useState<SeismicStation | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; altitude?: number; cinematic?: boolean; token: number } | null>(null);
  const [pulseEvent, setPulseEvent] = useState<Earthquake | null>(null);
  const [comparisonEvents, setComparisonEvents] = useState<Earthquake[]>([]);
  const sequenceTimersRef = useRef<number[]>([]);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [historyOpen, setHistoryOpen] = useState(() => window.innerWidth > 820);
  const [layers, setLayers] = useState<MapLayerState>(() => ({ ...DEFAULT_LAYERS, ...loadPreference('layers-v4', DEFAULT_LAYERS) }));
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => loadPreference('map-style-v2', 'political'));
  const [theme, setTheme] = useState<ThemeMode>(() => loadPreference('theme', 'automatic'));
  const [autoFocus, setAutoFocus] = useState(() => loadPreference('auto-focus', true));
  const [autoFocusMagnitude, setAutoFocusMagnitude] = useState(() => loadPreference('auto-focus-magnitude', 5));
  const [soundEnabled, setSoundEnabled] = useState(() => loadPreference('sound-enabled', true));
  const [soundMinimumMagnitude, setSoundMinimumMagnitude] = useState(() => loadPreference('sound-minimum-magnitude', -1));
  const [waveSpeed, setWaveSpeed] = useState(() => loadPreference('wave-speed-v2', 30));
  const [wavePaused, setWavePaused] = useState(false);
  const [waveInterior, setWaveInterior] = useState(() => loadPreference('wave-interior', true));
  const [cinematicPlayback, setCinematicPlayback] = useState(() => loadPreference('cinematic-playback', true));
  const [filters, setFilters] = useState<Filters>({ minMagnitude: -2, maxDepthKm: 700, query: '', significantOnly: false });
  const [notice, setNotice] = useState<SeismicActivity | null>(null);
  const [latestRelease, setLatestRelease] = useState<LatestRelease | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const stations = useMemo(() => [...operationalStations, ...secondaryStations], [operationalStations, secondaryStations]);
  const mapStations = useMemo(() => [
    ...(layers.stations ? operationalStations : []),
    ...(layers.secondaryStations ? secondaryStations : []),
  ], [layers.secondaryStations, layers.stations, operationalStations, secondaryStations]);

  const sourceEvents = historicalEvents ?? liveEvents;
  const visibleEvents = useMemo(() => sourceEvents.filter((event) => {
    return event.magnitude >= filters.minMagnitude
      && event.depthKm <= filters.maxDepthKm
      && (!filters.significantOnly || event.significance >= 600 || event.magnitude >= 6);
  }), [filters, sourceEvents]);

  const strongest = useMemo(() => visibleEvents.reduce<Earthquake | null>((max, event) => !max || event.magnitude > max.magnitude ? event : max, null), [visibleEvents]);

  const focus = useCallback((target: { lat: number; lng: number }, altitude = 1.35, cinematic = false) => {
    setFocusTarget({ ...target, altitude, cinematic, token: Date.now() });
  }, []);

  const selectEvent = useCallback((event: Earthquake) => {
    setSelectedEvent(event);
    setSelectedStation(null);
    setPulseEvent(event);
    focus(event, event.magnitude >= 6 ? 1.05 : 1.28);
    setWavePaused(false);
  }, [focus]);

  const selectStation = useCallback((station: SeismicStation) => {
    setSelectedStation(station);
    setSelectedEvent(null);
    setPulseEvent(null);
    focus(station, 0.92);
    if (window.innerWidth < 820) setActivePanel(null);
  }, [focus]);

  const playEvent = useCallback((event: Earthquake) => {
    setSelectedEvent(event);
    setSelectedStation(null);
    setPulseEvent(event);
    setWavePaused(false);
    focus(event, event.magnitude >= 6 ? 1.05 : 1.28, cinematicPlayback);
  }, [cinematicPlayback, focus]);

  const startWave = useCallback((event: Earthquake) => {
    setPulseEvent(null);
    setWavePaused(false);
    window.requestAnimationFrame(() => setPulseEvent(event));
  }, []);

  const toggleComparison = useCallback((event: Earthquake) => {
    setComparisonEvents((current) => current.some((item) => item.id === event.id)
      ? current.filter((item) => item.id !== event.id)
      : [...current, event].slice(-4));
  }, []);

  const playSequence = useCallback((mainEvent: Earthquake) => {
    sequenceTimersRef.current.forEach(window.clearTimeout);
    sequenceTimersRef.current = [];
    const radiusKm = Math.min(350, Math.max(45, 12 * 2 ** Math.max(0, mainEvent.magnitude - 3)));
    const sequence = sourceEvents.filter((candidate) => Math.abs(candidate.time - mainEvent.time) <= 14 * 86_400_000
      && haversineKm(mainEvent, candidate) <= radiusKm).sort((a, b) => a.time - b.time).slice(0, 30);
    sequence.forEach((event, index) => {
      sequenceTimersRef.current.push(window.setTimeout(() => playEvent(event), index * 1_250));
    });
  }, [playEvent, sourceEvents]);

  useEffect(() => () => {
    sequenceTimersRef.current.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    const activity = activities[0];
    if (!activity) return;
    setNotice(activity);
    window.setTimeout(() => setNotice((current) => current?.event.id === activity.event.id && current.kind === activity.kind ? null : current), 16_000);
    if (autoFocus && activity.kind === 'new' && activity.event.magnitude >= autoFocusMagnitude) selectEvent(activity.event);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`${activityLabels[activity.kind]} · ${formatMagnitude(activity.event.magnitude)}`, {
        body: `${activity.event.place} · ${Math.round(activity.event.depthKm)} km`,
        icon: `${window.location.origin}${import.meta.env.BASE_URL}favicon.svg`,
        tag: `episismic:${activity.event.id}`,
      });
    }
  }, [activities, autoFocus, autoFocusMagnitude, selectEvent]);

  useEffect(() => {
    if (!soundEnabled || !activities.length) return;
    activities.filter(({ event }) => event.magnitude >= soundMinimumMagnitude).slice(0, 6)
      .forEach((activity, index) => playSeismicAlert(activity.event.magnitude, activity.kind, index * 420));
  }, [activities, soundEnabled, soundMinimumMagnitude]);

  useEffect(() => {
    void fetchLatestRelease().then(setLatestRelease);
  }, []);

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

  useEffect(() => {
    if (layers.stations || activePanel === 'stations' || selectedEvent || selectedStation) setStationCatalogueRequested(true);
    if (layers.secondaryStations) setSecondaryCatalogueRequested(true);
  }, [activePanel, layers.secondaryStations, layers.stations, selectedEvent, selectedStation]);

  useEffect(() => { localStorage.setItem('episismic:layers-v4', JSON.stringify(layers)); }, [layers]);
  useEffect(() => { localStorage.setItem('episismic:map-style-v2', JSON.stringify(mapStyle)); }, [mapStyle]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus', JSON.stringify(autoFocus)); }, [autoFocus]);
  useEffect(() => { localStorage.setItem('episismic:auto-focus-magnitude', JSON.stringify(autoFocusMagnitude)); }, [autoFocusMagnitude]);
  useEffect(() => { localStorage.setItem('episismic:sound-enabled', JSON.stringify(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('episismic:sound-minimum-magnitude', JSON.stringify(soundMinimumMagnitude)); }, [soundMinimumMagnitude]);
  useEffect(() => { localStorage.setItem('episismic:wave-speed-v2', JSON.stringify(waveSpeed)); }, [waveSpeed]);
  useEffect(() => { localStorage.setItem('episismic:wave-interior', JSON.stringify(waveInterior)); }, [waveInterior]);
  useEffect(() => { localStorage.setItem('episismic:cinematic-playback', JSON.stringify(cinematicPlayback)); }, [cinematicPlayback]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActivePanel(null); setHistoryOpen(false); setSelectedEvent(null); setSelectedStation(null); setPulseEvent(null); }
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
    if (events[0]) selectEvent(events[0]);
  };

  const returnToLive = () => {
    setHistoricalEvents(null);
    setTimeWindow('day');
    setSelectedEvent(null);
    setPulseEvent(null);
    setActivePanel(null);
    setHistoryOpen(true);
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
          stations={mapStations}
          volcanoes={volcanoes}
          layers={layers}
          mapStyle={mapStyle}
          selectedEvent={selectedEvent}
          selectedStation={selectedStation}
          focusTarget={focusTarget}
          pulseEvent={pulseEvent}
          waveSpeed={waveSpeed}
          wavePaused={wavePaused}
          onSelectEvent={selectEvent}
          onSelectStation={selectStation}
        />

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
          cinematicPlayback={cinematicPlayback}
          waveSpeed={waveSpeed}
          stations={stations}
          operationalStationCount={operationalStations.length}
          secondaryStationCount={secondaryStations.length}
          secondaryGeodataReady={secondaryStationsReady}
          status={status}
          timeWindow={timeWindow}
          isHistorical={historicalEvents !== null}
          historicalEventCount={historicalEvents?.length ?? null}
          visibleEventCount={visibleEvents.length}
          strongestEvent={strongest}
          geodataReady={stationsReady}
          latestRelease={latestRelease}
          onClose={() => setActivePanel(null)}
          onLayers={setLayers}
          onFilters={setFilters}
          onMapStyle={setMapStyle}
          onTheme={setTheme}
          onAutoFocus={setAutoFocus}
          onAutoFocusMagnitude={setAutoFocusMagnitude}
          onSoundEnabled={setSoundEnabled}
          onSoundMinimumMagnitude={setSoundMinimumMagnitude}
          onCinematicPlayback={setCinematicPlayback}
          onWaveSpeed={setWaveSpeed}
          onSelectStation={selectStation}
          onHistoricalResults={loadHistorical}
          onReturnToLive={returnToLive}
        />}

        {selectedEvent && <EventInspector
          event={selectedEvent}
          events={sourceEvents}
          stations={stations}
          comparisonEvents={comparisonEvents}
          waveSpeed={waveSpeed}
          wavePaused={wavePaused}
          waveInterior={waveInterior}
          onClose={() => { setSelectedEvent(null); setPulseEvent(null); }}
          onFocus={() => focus(selectedEvent, 1.05)}
          onStartWave={startWave}
          onWaveSpeed={setWaveSpeed}
          onWavePaused={setWavePaused}
          onWaveInterior={setWaveInterior}
          onPlaySequence={playSequence}
          onToggleComparison={toggleComparison}
          onClearComparison={() => setComparisonEvents([])}
        />}
        {selectedStation && <StationInspector station={selectedStation} stations={stations} events={sourceEvents} onClose={() => setSelectedStation(null)} onFocus={() => focus(selectedStation, 0.9)} onSelectEvent={selectEvent} />}

        {notice && <div className="event-notice" style={{ '--notice-color': magnitudeColor(notice.event.magnitude) } as React.CSSProperties}>
          <div className="notice-magnitude"><BellRing size={14} /><strong>{formatMagnitude(notice.event.magnitude)}</strong></div>
          <div className="notice-copy">
            <span>{activityLabels[notice.kind]}</span>
            <strong>{notice.event.place}</strong>
            <div className="notice-facts">
              <small>{formatRelativeTime(notice.event.time)}</small>
              <small>{Math.round(notice.event.depthKm)} km profundidad</small>
              <small>{notice.event.catalogs.length} {notice.event.catalogs.length === 1 ? 'catálogo' : 'catálogos'} · {notice.event.catalogs.join(' + ')}</small>
              {notice.previous && notice.kind === 'magnitude' && <small>M{notice.previous.magnitude.toFixed(1)} → M{notice.event.magnitude.toFixed(1)}</small>}
            </div>
          </div>
          <button onClick={() => selectEvent(notice.event)}>ABRIR FICHA</button>
          <button className="icon-button" onClick={() => setNotice(null)} title="Cerrar"><X size={16} /></button>
        </div>}

        {!updateDismissed && latestRelease && isNativeApp() && isNewerVersion(latestRelease.version, APP_VERSION) && <div className="native-update-notice">
          <Download size={18} />
          <div><span>ACTUALIZACIÓN DISPONIBLE</span><strong>Episismic {latestRelease.version}</strong><small>Instalada: {APP_VERSION} · descarga el instalador más reciente.</small></div>
          <a href={latestRelease.url || RELEASES_URL} target="_blank" rel="noreferrer">DESCARGAR</a>
          <button className="icon-button" onClick={() => setUpdateDismissed(true)} title="Cerrar"><X size={16} /></button>
        </div>}

        <div className="map-attribution">
          <span>CATÁLOGOS <a href="https://earthquake.usgs.gov/" target="_blank" rel="noreferrer">USGS</a> / <a href="https://www.seismicportal.eu/" target="_blank" rel="noreferrer">EMSC</a> / <a href="https://geofon.gfz-potsdam.de/" target="_blank" rel="noreferrer">GEOFON</a></span>
          <span>MAPLIBRE / PB2002 / FDSN</span>
        </div>
        <Timeline events={visibleEvents} timeWindow={timeWindow} onPlayback={playEvent} onReset={() => focus({ lat: 22, lng: 5 }, 2.25)} />
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
