import type { Earthquake } from '../types';

export function formatMagnitude(magnitude: number): string {
  return `M${magnitude.toFixed(1)}`;
}

export function formatDepth(depthKm: number): string {
  return `${Math.round(depthKm)} km`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'medium', hour12: false,
  }).format(timestamp);
}

export function magnitudeColor(magnitude: number): string {
  if (magnitude >= 7) return '#ff3b4f';
  if (magnitude >= 6) return '#ff7043';
  if (magnitude >= 5) return '#ffb84d';
  if (magnitude >= 3) return '#f0de69';
  return '#53d6c7';
}

export function depthColor(depthKm: number): string {
  if (depthKm < 35) return '#ff6b62';
  if (depthKm < 70) return '#ffb84d';
  if (depthKm < 300) return '#6dd4ff';
  return '#a993ff';
}

export function eventRadius(event: Earthquake): number {
  return Math.max(0.08, Math.min(0.72, 0.055 * Math.pow(1.7, event.magnitude)));
}

export function windowStart(window: 'hour' | 'day' | 'week' | 'month', now = Date.now()): number {
  const durations = { hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 };
  return now - durations[window];
}

export function intensityLabel(magnitude: number): string {
  if (magnitude >= 8) return 'Gran terremoto';
  if (magnitude >= 7) return 'Muy fuerte';
  if (magnitude >= 6) return 'Fuerte';
  if (magnitude >= 5) return 'Moderado';
  if (magnitude >= 3) return 'Menor';
  return 'Microseísmo';
}

export function toRomanIntensity(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 1) return '—';
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return numerals[Math.max(0, Math.min(11, Math.round(value) - 1))];
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}
