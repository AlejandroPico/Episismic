import type { Earthquake, SeismicStation } from '../types';
import { haversineKm } from '../utils/format';

export type SeismicWaveKind = 'P' | 'S' | 'SURFACE';

export interface WaveArrivalPrediction {
  station: SeismicStation;
  distanceKm: number;
  pSeconds: number;
  sSeconds: number;
  surfaceSeconds: number;
}

export function waveVelocityKmS(kind: SeismicWaveKind, depthKm: number) {
  if (kind === 'SURFACE') return 3.2;
  if (depthKm < 35) return kind === 'P' ? 6 : 3.5;
  if (depthKm < 70) return kind === 'P' ? 6.5 : 3.75;
  if (depthKm < 300) return kind === 'P' ? 8.1 : 4.5;
  return kind === 'P' ? 10.2 : 5.6;
}

export function waveRadiusKm(kind: SeismicWaveKind, elapsedSeconds: number, depthKm: number) {
  const velocity = waveVelocityKmS(kind, depthKm);
  if (kind === 'SURFACE') return Math.max(0, elapsedSeconds * velocity);
  const travelledKm = elapsedSeconds * velocity;
  return travelledKm <= depthKm ? 0 : Math.sqrt(travelledKm ** 2 - depthKm ** 2);
}

export function travelTimeSeconds(kind: SeismicWaveKind, distanceKm: number, depthKm: number) {
  if (kind === 'SURFACE') return distanceKm / waveVelocityKmS(kind, depthKm);
  return Math.sqrt(distanceKm ** 2 + depthKm ** 2) / waveVelocityKmS(kind, depthKm);
}

export function predictArrival(event: Earthquake, station: SeismicStation): WaveArrivalPrediction {
  const distanceKm = haversineKm(event, station);
  return {
    station,
    distanceKm,
    pSeconds: travelTimeSeconds('P', distanceKm, event.depthKm),
    sSeconds: travelTimeSeconds('S', distanceKm, event.depthKm),
    surfaceSeconds: travelTimeSeconds('SURFACE', distanceKm, event.depthKm),
  };
}

export function nearestStationArrivals(event: Earthquake, stations: SeismicStation[], limit = 8) {
  const nearest: WaveArrivalPrediction[] = [];
  for (const station of stations) {
    const prediction = predictArrival(event, station);
    const index = nearest.findIndex((item) => prediction.distanceKm < item.distanceKm);
    if (index === -1) {
      if (nearest.length < limit) nearest.push(prediction);
    } else {
      nearest.splice(index, 0, prediction);
      if (nearest.length > limit) nearest.pop();
    }
  }
  return nearest;
}

export function formatTravelTime(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes} min ${remaining.toString().padStart(2, '0')} s`;
}
