import type { Earthquake } from '../types';
import { haversineKm } from '../utils/format';

export interface FrequencyMagnitudePoint { magnitude: number; cumulative: number }
export interface DecayPoint { day: number; count: number; expected: number }
export interface DepthBin { label: string; minimum: number; maximum: number; count: number }
export interface EnergyPoint { time: number; joules: number; cumulativeJoules: number; cumulativeFraction: number }
export interface MigrationPoint { time: number; days: number; distanceKm: number; depthKm: number; magnitude: number }
export interface RateBin { startTime: number; endTime: number; count: number; eventsPerDay: number }

export function associatedSequence(mainEvent: Earthquake, events: Earthquake[]) {
  const radiusKm = Math.min(350, Math.max(45, 12 * 2 ** Math.max(0, mainEvent.magnitude - 3)));
  return events.filter((candidate) => candidate.id === mainEvent.id || (
    Math.abs(candidate.time - mainEvent.time) <= 14 * 86_400_000 && haversineKm(mainEvent, candidate) <= radiusKm
  )).sort((a, b) => a.time - b.time);
}

export function frequencyMagnitude(sequence: Earthquake[], binSize = 0.5) {
  if (!sequence.length) return { points: [] as FrequencyMagnitudePoint[], bValue: null as number | null, completeness: null as number | null };
  const minimum = Math.floor(Math.min(...sequence.map((event) => event.magnitude)) / binSize) * binSize;
  const maximum = Math.ceil(Math.max(...sequence.map((event) => event.magnitude)) / binSize) * binSize;
  const points: FrequencyMagnitudePoint[] = [];
  for (let magnitude = minimum; magnitude <= maximum + 0.001; magnitude += binSize) {
    points.push({ magnitude: Number(magnitude.toFixed(2)), cumulative: sequence.filter((event) => event.magnitude >= magnitude).length });
  }
  const mean = sequence.reduce((sum, event) => sum + event.magnitude, 0) / sequence.length;
  const denominator = mean - (minimum - binSize / 2);
  const bValue = denominator > 0 ? Math.log10(Math.E) / denominator : null;
  return { points, bValue, completeness: minimum };
}

export function aftershockDecay(mainEvent: Earthquake, sequence: Earthquake[], days = 14): DecayPoint[] {
  const counts = Array.from({ length: days }, () => 0);
  for (const event of sequence) {
    if (event.time <= mainEvent.time) continue;
    const day = Math.floor((event.time - mainEvent.time) / 86_400_000);
    if (day >= 0 && day < days) counts[day] += 1;
  }
  const initial = Math.max(1, counts[0], ...counts);
  return counts.map((count, day) => ({ day, count, expected: initial / Math.pow(day + 1, 1.05) }));
}

export function depthDistribution(sequence: Earthquake[]): DepthBin[] {
  const bins: DepthBin[] = [
    { label: '0–10', minimum: 0, maximum: 10, count: 0 }, { label: '10–35', minimum: 10, maximum: 35, count: 0 },
    { label: '35–70', minimum: 35, maximum: 70, count: 0 }, { label: '70–150', minimum: 70, maximum: 150, count: 0 },
    { label: '150–300', minimum: 150, maximum: 300, count: 0 }, { label: '300–700', minimum: 300, maximum: 701, count: 0 },
  ];
  for (const event of sequence) {
    const bin = bins.find((item) => event.depthKm >= item.minimum && event.depthKm < item.maximum);
    if (bin) bin.count += 1;
  }
  return bins;
}

function energyJoules(magnitude: number) { return 10 ** (1.5 * magnitude + 4.8); }

export function cumulativeEnergy(sequence: Earthquake[]) {
  const ordered = [...sequence].sort((a, b) => a.time - b.time);
  const totalJoules = ordered.reduce((sum, event) => sum + energyJoules(event.magnitude), 0);
  let cumulativeJoules = 0;
  const points: EnergyPoint[] = ordered.map((event) => {
    const joules = energyJoules(event.magnitude);
    cumulativeJoules += joules;
    return { time: event.time, joules, cumulativeJoules, cumulativeFraction: totalJoules > 0 ? cumulativeJoules / totalJoules : 0 };
  });
  const dominant = points.reduce((maximum, point) => Math.max(maximum, point.joules), 0);
  return { points, totalJoules, dominantFraction: totalJoules > 0 ? dominant / totalJoules : 0 };
}

export function hypocentralMigration(mainEvent: Earthquake, sequence: Earthquake[]) {
  const points: MigrationPoint[] = sequence.map((event) => ({
    time: event.time,
    days: (event.time - mainEvent.time) / 86_400_000,
    distanceKm: haversineKm(mainEvent, event),
    depthKm: event.depthKm,
    magnitude: event.magnitude,
  })).sort((a, b) => a.time - b.time);
  const aftershocks = points.filter((point) => point.days > 0);
  if (aftershocks.length < 2) return { points, rateKmPerDay: null as number | null };
  const meanDay = aftershocks.reduce((sum, point) => sum + point.days, 0) / aftershocks.length;
  const meanDistance = aftershocks.reduce((sum, point) => sum + point.distanceKm, 0) / aftershocks.length;
  const covariance = aftershocks.reduce((sum, point) => sum + (point.days - meanDay) * (point.distanceKm - meanDistance), 0);
  const variance = aftershocks.reduce((sum, point) => sum + (point.days - meanDay) ** 2, 0);
  return { points, rateKmPerDay: variance > 0 ? covariance / variance : null };
}

export function temporalRate(sequence: Earthquake[], binHours = 24) {
  const ordered = [...sequence].sort((a, b) => a.time - b.time);
  if (!ordered.length) return { bins: [] as RateBin[], medianIntervalHours: null as number | null, peakEventsPerDay: 0 };
  const binMs = Math.max(1, binHours) * 3_600_000;
  const minimumTime = ordered[0].time;
  const maximumTime = ordered[ordered.length - 1].time;
  const binCount = Math.max(1, Math.ceil((maximumTime - minimumTime + 1) / binMs));
  const bins: RateBin[] = Array.from({ length: binCount }, (_, index) => ({
    startTime: minimumTime + index * binMs,
    endTime: minimumTime + (index + 1) * binMs,
    count: 0,
    eventsPerDay: 0,
  }));
  for (const event of ordered) bins[Math.min(binCount - 1, Math.floor((event.time - minimumTime) / binMs))].count += 1;
  for (const bin of bins) bin.eventsPerDay = bin.count * 24 / binHours;
  const intervals = ordered.slice(1).map((event, index) => (event.time - ordered[index].time) / 3_600_000).sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  const medianIntervalHours = intervals.length === 0 ? null : intervals.length % 2 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2;
  return { bins, medianIntervalHours, peakEventsPerDay: Math.max(0, ...bins.map((bin) => bin.eventsPerDay)) };
}

export function sequenceIndicators(mainEvent: Earthquake, sequence: Earthquake[]) {
  const aftershocks = sequence.filter((event) => event.time > mainEvent.time);
  const strongestAftershock = aftershocks.reduce<Earthquake | null>((strongest, event) => !strongest || event.magnitude > strongest.magnitude ? event : strongest, null);
  const bathGap = strongestAftershock ? mainEvent.magnitude - strongestAftershock.magnitude : null;
  const centroid = sequence.length ? {
    lat: sequence.reduce((sum, event) => sum + event.lat, 0) / sequence.length,
    lng: sequence.reduce((sum, event) => sum + event.lng, 0) / sequence.length,
    depthKm: sequence.reduce((sum, event) => sum + event.depthKm, 0) / sequence.length,
  } : null;
  return {
    strongestAftershock,
    bathGap,
    productivity: aftershocks.filter((event) => event.magnitude >= mainEvent.magnitude - 2).length,
    centroidOffsetKm: centroid ? haversineKm(mainEvent, centroid) : null,
    meanDepthKm: centroid?.depthKm ?? null,
  };
}
