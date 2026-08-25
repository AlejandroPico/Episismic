import type { SeismicStation } from '../types';
import { haversineKm } from '../utils/format';

function bearing(from: SeismicStation, to: SeismicStation) {
  const rad = Math.PI / 180;
  const lat1 = from.lat * rad;
  const lat2 = to.lat * rad;
  const deltaLongitude = (to.lng - from.lng) * rad;
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function networkMembership(station: SeismicStation, stations: SeismicStation[]) {
  const members = stations.filter((candidate) => candidate.network === station.network);
  const countries = new Set(members.map((candidate) => candidate.country).filter((country) => country && country !== '—'));
  return { memberCount: members.length, countryCount: countries.size, onlineCount: members.filter((candidate) => candidate.status === 'online').length };
}

export function nearestStation(station: SeismicStation, stations: SeismicStation[]) {
  return stations.filter((candidate) => candidate.id !== station.id).map((candidate) => ({ station: candidate, distanceKm: haversineKm(station, candidate) })).sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
}

export function stationDensity(station: SeismicStation, stations: SeismicStation[]) {
  const distances = stations.filter((candidate) => candidate.id !== station.id).map((candidate) => haversineKm(station, candidate));
  return { within100Km: distances.filter((distance) => distance <= 100).length, within500Km: distances.filter((distance) => distance <= 500).length, within1000Km: distances.filter((distance) => distance <= 1000).length };
}

export function stationAzimuthCoverage(station: SeismicStation, stations: SeismicStation[], radiusKm = 1000) {
  const sectors = Array.from({ length: 8 }, () => 0);
  for (const candidate of stations) {
    if (candidate.id === station.id || haversineKm(station, candidate) > radiusKm) continue;
    sectors[Math.min(7, Math.floor(bearing(station, candidate) / 45))] += 1;
  }
  const occupied = sectors.filter((count) => count > 0).length;
  return { sectors, coverage: occupied / sectors.length, label: occupied >= 7 ? 'Excelente' : occupied >= 5 ? 'Buena' : occupied >= 3 ? 'Parcial' : 'Escasa' };
}

export function elevationContext(station: SeismicStation, stations: SeismicStation[]) {
  const valid = stations.map((candidate) => candidate.elevationM).filter(Number.isFinite).sort((a, b) => a - b);
  const belowOrEqual = valid.filter((elevation) => elevation <= station.elevationM).length;
  const percentile = valid.length ? belowOrEqual / valid.length * 100 : 0;
  const label = station.elevationM < 0 ? 'Bajo el nivel del mar' : station.elevationM < 100 ? 'Cota baja' : station.elevationM < 800 ? 'Cota media' : station.elevationM < 2000 ? 'Alta montaña' : 'Muy alta montaña';
  return { percentile, label };
}

export function operationalSpan(station: SeismicStation, now = new Date()) {
  const start = station.startTime ? new Date(station.startTime) : null;
  const end = station.endTime ? new Date(station.endTime) : null;
  const validStart = start && Number.isFinite(start.getTime()) ? start : null;
  const validEnd = end && Number.isFinite(end.getTime()) ? end : null;
  const until = validEnd ?? now;
  const years = validStart ? Math.max(0, (until.getTime() - validStart.getTime()) / 31_556_952_000) : null;
  return { start: validStart, end: validEnd, years, active: station.status === 'online' && (!validEnd || validEnd > now) };
}

export function geographicContext(station: SeismicStation) {
  const latitude = station.lat >= 0 ? 'Hemisferio norte' : 'Hemisferio sur';
  const longitude = station.lng >= 0 ? 'Hemisferio oriental' : 'Hemisferio occidental';
  const zone = Math.abs(station.lat) < 23.5 ? 'Tropical' : Math.abs(station.lat) < 66.5 ? 'Templada' : 'Polar';
  return { latitude, longitude, zone };
}

export function fdsnStationLinks(station: SeismicStation, now = new Date()) {
  const end = now.toISOString();
  const start = new Date(now.getTime() - 3_600_000).toISOString();
  const stationQuery = new URLSearchParams({ net: station.network, sta: station.code, level: 'response', format: 'xml' });
  const dataQuery = new URLSearchParams({ net: station.network, sta: station.code, loc: '*', cha: 'BH?', starttime: start, endtime: end });
  return {
    stationXml: `https://service.earthscope.org/fdsnws/station/1/query?${stationQuery}`,
    miniSeed: `https://service.earthscope.org/fdsnws/dataselect/1/query?${dataQuery}`,
  };
}

export function stationGeoJson(station: SeismicStation) {
  return JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [station.lng, station.lat, station.elevationM] }, properties: { id: station.id, network: station.network, station: station.code, name: station.name, country: station.country, status: station.status, source: station.source, startTime: station.startTime ?? null, endTime: station.endTime ?? null } }, null, 2);
}
