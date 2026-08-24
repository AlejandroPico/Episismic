export type TimeWindow = 'hour' | 'day' | 'week' | 'month';
export type ThemeMode = 'automatic' | 'morning' | 'afternoon' | 'night';
export type MapStyle = 'political' | 'satellite' | 'relief' | 'bathymetry' | 'dark' | 'night';
export type HazardKind = 'earthquake' | 'volcano' | 'storm' | 'fire';

export interface Coordinates {
  lat: number;
  lng: number;
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
  source: 'EarthScope' | 'GEOFON' | 'IGN' | 'USGS';
}

export interface Volcano extends Coordinates {
  id: string;
  name: string;
  country: string;
  elevationM: number;
  status: 'normal' | 'advisory' | 'watch';
}

export interface MapLayerState {
  earthquakes: boolean;
  stations: boolean;
  plates: boolean;
  volcanoes: boolean;
  labels: boolean;
  atmosphere: boolean;
  graticule: boolean;
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
}
