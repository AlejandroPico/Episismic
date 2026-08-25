import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { Color, MeshPhongMaterial, type WebGLRendererParameters } from 'three';
import { platePaths } from '../data/plates';
import type { Earthquake, MapLayerState, MapStyle, SeismicStation, Volcano } from '../types';
import { depthColor, eventRadius, magnitudeColor } from '../utils/format';

const TEXTURES: Record<MapStyle, string> = {
  political: 'https://unpkg.com/three-globe/example/img/earth-day.jpg',
  satellite: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  relief: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  bathymetry: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  dark: 'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
  night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
};

const BUMP_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const SPACE_COLOR = '#071318';
const RENDERER_CONFIG: WebGLRendererParameters = {
  alpha: false,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
  stencil: false,
};

interface WaveRing {
  id: string;
  lat: number;
  lng: number;
  magnitude: number;
  wave: 'P' | 'S';
  color: string;
}

interface GlobeViewProps {
  events: Earthquake[];
  stations: SeismicStation[];
  volcanoes: Volcano[];
  layers: MapLayerState;
  mapStyle: MapStyle;
  selectedEvent: Earthquake | null;
  selectedStation: SeismicStation | null;
  focusTarget: { lat: number; lng: number; altitude?: number; token: number } | null;
  pulseEvent: Earthquake | null;
  onSelectEvent: (event: Earthquake) => void;
  onSelectStation: (station: SeismicStation) => void;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      || canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    return Boolean(context);
  } catch { return false; }
}

function GlobeFallback() {
  return <div className="webgl-fallback" role="status">
    <div className="fallback-orbit"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /></div>
    <p className="eyebrow">MODO DE COMPATIBILIDAD</p>
    <h2>El globo 3D necesita WebGL</h2>
    <p>El historial, los datos y los paneles siguen disponibles. Activa la aceleración gráfica del navegador o abre Episismic en un dispositivo compatible para visualizar la Tierra.</p>
  </div>;
}

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <GlobeFallback /> : this.props.children; }
}

const cities = [
  { lat: 40.4168, lng: -3.7038, name: 'Madrid' }, { lat: 41.3874, lng: 2.1686, name: 'Barcelona' },
  { lat: 51.5072, lng: -0.1276, name: 'Londres' }, { lat: 35.6762, lng: 139.6503, name: 'Tokio' },
  { lat: 19.4326, lng: -99.1332, name: 'Ciudad de México' }, { lat: -33.8688, lng: 151.2093, name: 'Sídney' },
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco' }, { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapur' }, { lat: -1.2921, lng: 36.8219, name: 'Nairobi' },
];

export function GlobeView({
  events, stations, volcanoes, layers, mapStyle, selectedEvent, selectedStation,
  focusTarget, pulseEvent, onSelectEvent, onSelectStation,
}: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [webglAvailable] = useState(supportsWebGL);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const sizeRef = useRef(size);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let resizeFrame: number | null = null;

    const commitSize = (width: number, height: number) => {
      const next = {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      };
      const previous = sizeRef.current;
      if (Math.abs(previous.width - next.width) < 2 && Math.abs(previous.height - next.height) < 2) return;
      sizeRef.current = next;
      setSize(next);
    };

    const initialRect = host.getBoundingClientRect();
    commitSize(initialRect.width, initialRect.height);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        commitSize(width, height);
        resizeFrame = null;
      });
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 25, lng: 5, altitude: 2.25 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.12;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 108;
    controls.maxDistance = 520;
  }, []);

  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = false;
    globeRef.current.pointOfView({
      lat: focusTarget.lat,
      lng: focusTarget.lng,
      altitude: focusTarget.altitude ?? 1.35,
    }, 1250);
  }, [focusTarget]);

  useEffect(() => {
    const material = (globeRef.current as (GlobeMethods & { globeMaterial?: () => MeshPhongMaterial }) | undefined)?.globeMaterial?.();
    if (!material) return;
    const tint = mapStyle === 'bathymetry' ? '#79b8c8' : mapStyle === 'dark' ? '#8bb6bc' : '#ffffff';
    material.color = new Color(tint);
    material.emissive = new Color(mapStyle === 'night' || mapStyle === 'dark' ? '#07151b' : '#000000');
    material.emissiveIntensity = mapStyle === 'night' ? 0.48 : mapStyle === 'dark' ? 0.18 : 0;
    material.shininess = mapStyle === 'bathymetry' ? 8 : 4;
    material.needsUpdate = true;
  }, [mapStyle]);

  const rings = useMemo<WaveRing[]>(() => {
    if (!pulseEvent) return selectedEvent ? [{
      id: `${selectedEvent.id}-selected`, lat: selectedEvent.lat, lng: selectedEvent.lng,
      magnitude: selectedEvent.magnitude, wave: 'S', color: magnitudeColor(selectedEvent.magnitude),
    }] : [];
    return [
      { id: `${pulseEvent.id}-p`, lat: pulseEvent.lat, lng: pulseEvent.lng, magnitude: pulseEvent.magnitude, wave: 'P', color: '#51b8ff' },
      { id: `${pulseEvent.id}-s`, lat: pulseEvent.lat, lng: pulseEvent.lng, magnitude: pulseEvent.magnitude, wave: 'S', color: magnitudeColor(pulseEvent.magnitude) },
    ];
  }, [pulseEvent, selectedEvent]);

  const labels = useMemo(() => [
    ...(layers.labels ? cities.map((city) => ({ ...city, kind: 'city' as const })) : []),
    ...(layers.stations ? stations.map((station) => ({ ...station, kind: 'station' as const })) : []),
    ...(layers.volcanoes ? volcanoes.map((volcano) => ({ ...volcano, kind: 'volcano' as const })) : []),
  ], [layers.labels, layers.stations, layers.volcanoes, stations, volcanoes]);

  return (
    <div className="globe-host" ref={hostRef} aria-label="Globo sísmico tridimensional">
      <GlobeBoundary>
      {webglAvailable ? <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        rendererConfig={RENDERER_CONFIG}
        backgroundColor={SPACE_COLOR}
        globeImageUrl={TEXTURES[mapStyle]}
        bumpImageUrl={mapStyle === 'relief' || mapStyle === 'bathymetry' ? BUMP_TEXTURE : undefined}
        showAtmosphere={layers.atmosphere}
        atmosphereColor={mapStyle === 'night' ? '#618bd8' : '#53d6c7'}
        atmosphereAltitude={0.15}
        showGraticules={layers.graticule}
        pointsData={layers.earthquakes ? events : []}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(item) => 0.012 + Math.min(0.09, ((item as Earthquake).magnitude ** 2) / 900)}
        pointRadius={(item) => eventRadius(item as Earthquake)}
        pointColor={(item) => depthColor((item as Earthquake).depthKm)}
        pointResolution={8}
        pointLabel={(item) => {
          const event = item as Earthquake;
          return `<div class="globe-tooltip"><b>M${event.magnitude.toFixed(1)}</b><span>${event.place}</span><small>${Math.round(event.depthKm)} km de profundidad</small></div>`;
        }}
        onPointClick={(item) => onSelectEvent(item as Earthquake)}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={(item: object) => {
          const ring = item as WaveRing;
          return [`${ring.color}05`, `${ring.color}dd`, `${ring.color}00`];
        }}
        ringMaxRadius={(item) => Math.min(48, 4 + (item as WaveRing).magnitude ** 1.62)}
        ringPropagationSpeed={(item) => (item as WaveRing).wave === 'P' ? 4.4 : 2.55}
        ringRepeatPeriod={pulseEvent ? 60_000 : 5_000}
        pathsData={layers.plates ? platePaths : []}
        pathPoints="coords"
        pathPointLat={(point) => (point as number[])[0]}
        pathPointLng={(point) => (point as number[])[1]}
        pathColor={() => ['rgba(255,184,77,.15)', 'rgba(255,184,77,.82)']}
        pathStroke={0.42}
        pathDashLength={0.18}
        pathDashGap={0.04}
        pathDashAnimateTime={22_000}
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText={(item) => {
          const label = item as { kind: string; name?: string; code?: string };
          if (label.kind === 'station') return label.code ?? '';
          if (label.kind === 'volcano') return '▲';
          return label.name ?? '';
        }}
        labelColor={(item) => {
          const label = item as { kind: string; id?: string };
          if (label.kind === 'station') return selectedStation?.id === label.id ? '#ffffff' : '#53d6c7';
          if (label.kind === 'volcano') return '#ff8a64';
          return 'rgba(227,243,242,.64)';
        }}
        labelSize={(item) => (item as { kind: string }).kind === 'city' ? 0.62 : 0.78}
        labelDotRadius={(item) => (item as { kind: string }).kind === 'station' ? 0.18 : (item as { kind: string }).kind === 'volcano' ? 0.28 : 0.05}
        labelAltitude={(item) => (item as { kind: string }).kind === 'city' ? 0.006 : 0.018}
        labelResolution={2}
        onLabelClick={(item) => {
          const label = item as SeismicStation & { kind: string };
          if (label.kind === 'station') onSelectStation(label);
        }}
        animateIn
      /> : <GlobeFallback />}
      </GlobeBoundary>
      <div className="globe-corner-scale" aria-hidden="true">
        <span>PROFUNDIDAD</span>
        <i style={{ background: '#ff6b62' }} />0–35
        <i style={{ background: '#ffb84d' }} />35–70
        <i style={{ background: '#6dd4ff' }} />70–300
        <i style={{ background: '#a993ff' }} />300+ km
      </div>
    </div>
  );
}
