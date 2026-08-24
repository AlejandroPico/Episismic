import type { Earthquake } from '../types';

const now = Date.now();

export const fallbackEarthquakes: Earthquake[] = [
  [6.4, 18, 'Arco de las Aleutianas', 52.1, -171.4, 38],
  [5.8, 42, 'Dorsal Mesoatlántica', -7.2, -13.5, 84],
  [5.5, 10, 'Al este de Honshu, Japón', 38.1, 142.3, 120],
  [5.2, 70, 'Región de Vanuatu', -16.2, 167.5, 165],
  [4.9, 14, 'Sur de Grecia', 36.4, 24.8, 210],
  [4.7, 8, 'Costa de Oaxaca, México', 15.7, -96.4, 254],
  [4.6, 110, 'Hindu Kush, Afganistán', 36.3, 70.7, 320],
  [4.4, 12, 'Canal de Sicilia', 36.7, 12.9, 390],
  [4.2, 7, 'Islas Canarias', 28.3, -17.8, 470],
  [3.9, 5, 'Golfo de California', 28.6, -112.1, 520],
  [3.6, 9, 'Mar de Alborán', 35.7, -3.6, 610],
  [3.2, 6, 'Pirineos occidentales', 42.8, -1.1, 690],
].map(([magnitude, depthKm, place, lat, lng, minutes], index) => ({
  id: `offline-${index}`,
  magnitude: Number(magnitude),
  depthKm: Number(depthKm),
  place: String(place),
  lat: Number(lat),
  lng: Number(lng),
  time: now - Number(minutes) * 60_000,
  updated: now - Number(minutes) * 60_000,
  source: 'Caché de demostración',
  sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
  felt: null,
  tsunami: false,
  alert: Number(magnitude) >= 6 ? 'orange' : Number(magnitude) >= 5 ? 'yellow' : null,
  status: 'reviewed',
  significance: Math.round(Number(magnitude) * 100),
  magnitudeType: 'mw',
  kind: 'earthquake',
}));
