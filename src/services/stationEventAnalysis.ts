import type { Earthquake, SeismicStation } from '../types';
import { estimateIntensityZones } from './shakeMap';
import { predictArrival } from './travelTimes';

export type ArrivalPhase = 'before-p' | 'p' | 's' | 'surface' | 'complete';

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const lat1 = from.lat * rad;
  const lat2 = to.lat * rad;
  const deltaLongitude = (to.lng - from.lng) * rad;
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function estimatedIntensityAtDistance(event: Earthquake, distanceKm: number) {
  return estimateIntensityZones(event).reduce((maximum, zone) => distanceKm <= zone.radiusKm ? Math.max(maximum, zone.intensity) : maximum, 1);
}

function detectionScore(event: Earthquake, station: SeismicStation, distanceKm: number) {
  const hypocentralDistance = Math.hypot(distanceKm, event.depthKm);
  const signalIndex = event.magnitude - 1.2 * Math.log10(hypocentralDistance + 1) - 1;
  return Math.round(Math.max(0, Math.min(100, signalIndex * 22 + (station.status === 'online' ? 10 : 0))));
}

function phaseAt(now: number, event: Earthquake, pSeconds: number, sSeconds: number, surfaceSeconds: number): ArrivalPhase {
  const elapsed = (now - event.time) / 1000;
  if (elapsed < pSeconds) return 'before-p';
  if (elapsed < sSeconds) return 'p';
  if (elapsed < surfaceSeconds) return 's';
  if (elapsed < surfaceSeconds + Math.max(120, surfaceSeconds * .2)) return 'surface';
  return 'complete';
}

export function associateStationEvents(station: SeismicStation, events: Earthquake[], now = Date.now()) {
  return events.map((event) => {
    const arrival = predictArrival(event, station);
    const azimuthDeg = bearing(station, event);
    const score = detectionScore(event, station, arrival.distanceKm);
    return {
      event,
      distanceKm: arrival.distanceKm,
      azimuthDeg,
      backAzimuthDeg: (azimuthDeg + 180) % 360,
      pSeconds: arrival.pSeconds,
      sSeconds: arrival.sSeconds,
      surfaceSeconds: arrival.surfaceSeconds,
      psLagSeconds: arrival.sSeconds - arrival.pSeconds,
      pArrivalTime: event.time + arrival.pSeconds * 1000,
      sArrivalTime: event.time + arrival.sSeconds * 1000,
      surfaceArrivalTime: event.time + arrival.surfaceSeconds * 1000,
      phase: phaseAt(now, event, arrival.pSeconds, arrival.sSeconds, arrival.surfaceSeconds),
      estimatedIntensity: estimatedIntensityAtDistance(event, arrival.distanceKm),
      detectionScore: score,
      detectionLabel: score >= 70 ? 'Fuerte' : score >= 40 ? 'Probable' : score >= 20 ? 'Marginal' : 'Débil',
    };
  }).sort((a, b) => b.event.time - a.event.time);
}

export function stationEventSummary(station: SeismicStation, events: Earthquake[], now = Date.now()) {
  const allAssociations = associateStationEvents(station, events, now);
  const associations = allAssociations.filter((item) => item.distanceKm <= 1000 || item.detectionScore >= 40)
    .sort((a, b) => b.detectionScore - a.detectionScore || b.event.time - a.event.time);
  const nearest = [...allAssociations].sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
  const strongest = allAssociations.reduce<(typeof allAssociations)[number] | null>((maximum, item) => !maximum || item.event.magnitude > maximum.event.magnitude ? item : maximum, null);
  return {
    associations,
    nearest,
    strongest,
    within500Km: allAssociations.filter((item) => item.distanceKm <= 500).length,
    within1000Km: allAssociations.filter((item) => item.distanceKm <= 1000).length,
    within5000Km: allAssociations.filter((item) => item.distanceKm <= 5000).length,
    probableDetections: allAssociations.filter((item) => item.detectionScore >= 40).length,
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function stationAssociationsCsv(station: SeismicStation, events: Earthquake[], now = Date.now()) {
  const header = ['estacion', 'evento', 'fecha_origen', 'magnitud', 'distancia_km', 'azimut', 'back_azimut', 'llegada_p', 'llegada_s', 'llegada_superficial', 'desfase_ps_s', 'intensidad_estimada', 'deteccion_0_100', 'fase'];
  const rows = associateStationEvents(station, events, now).map((item) => [station.id, item.event.id, new Date(item.event.time).toISOString(), item.event.magnitude, item.distanceKm.toFixed(2), item.azimuthDeg.toFixed(1), item.backAzimuthDeg.toFixed(1), new Date(item.pArrivalTime).toISOString(), new Date(item.sArrivalTime).toISOString(), new Date(item.surfaceArrivalTime).toISOString(), item.psLagSeconds.toFixed(2), item.estimatedIntensity, item.detectionScore, item.phase]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}
