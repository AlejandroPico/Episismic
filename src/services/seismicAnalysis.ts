import type { Earthquake } from '../types';
import { haversineKm } from '../utils/format';

export interface FrequencyMagnitudePoint { magnitude: number; cumulative: number }
export interface DecayPoint { day: number; count: number; expected: number }
export interface DepthBin { label: string; minimum: number; maximum: number; count: number }

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
