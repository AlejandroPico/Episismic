export type TimeWindow = 'hour' | 'day' | 'week' | 'month';
export type ThemeMode = 'automatic' | 'morning' | 'afternoon' | 'night';
export type MapStyle = 'political' | 'satellite' | 'relief' | 'bathymetry';
export type HazardKind = 'earthquake' | 'volcano' | 'storm' | 'fire';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface EarthquakeSolution {
  agency: string;
  magnitude: number;
  magnitudeType: string;
  depthKm: number;
  time: number;
  status: string;
}

export interface Earthquake extends Coordinates {
  id: string;
  magnitude: number;
  depthKm: number;
  place: string;
  time: number;
  updated: number;
  source: string;
  sourceUrl: string;
  detailUrl?: string;
  felt: number | null;
  tsunami: boolean;
  alert: 'green' | 'yellow' | 'orange' | 'red' | null;
  status: string;
  significance: number;
  magnitudeType: string;
  catalogs: string[];
  intensity: number | null;
  reportedIntensity?: number | null;
  estimatedIntensity?: number | null;
  eventType?: string;
  solutions?: EarthquakeSolution[];
  reviewCode: 'A' | 'R' | 'M';
  kind: HazardKind;
}

export interface SeismicStation extends Coordinates {
  id: string;
  network: string;
  code: string;
  name: string;
  country: string;
  elevationM: number;
  status: 'online' | 'delayed' | 'unknown';
  dataUrl: string;
  source: string;
  startTime?: string | null;
  endTime?: string | null;
}

export interface Volcano extends Coordinates {
  id: string;
  name: string;
  country: string;
  elevationM: number;
  status: 'catalogued' | 'normal' | 'advisory' | 'watch';
  region?: string;
  volcanoType?: string;
  lastEruptionYear?: number | null;
  sourceUrl?: string;
}

export interface MapLayerState {
  earthquakes: boolean;
  stations: boolean;
  plates: boolean;
  volcanoes: boolean;
  labels: boolean;
  atmosphere: boolean;
  graticule: boolean;
  legend: boolean;
}

export type SeismicActivityKind = 'new' | 'magnitude' | 'corroborated' | 'revision';

export interface SeismicActivity {
  event: Earthquake;
  previous: Earthquake | null;
  kind: SeismicActivityKind;
}

export interface Filters {
  minMagnitude: number;
  maxDepthKm: number;
  query: string;
  significantOnly: boolean;
}

export interface DataStatus {
  state: 'loading' | 'live' | 'cached' | 'error';
  lastUpdated: number | null;
  message?: string;
  sources?: string[];
}
