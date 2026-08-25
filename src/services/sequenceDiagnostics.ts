import type { Earthquake } from '../types';
import { haversineKm } from '../utils/format';
import { frequencyMagnitude } from './seismicAnalysis';

export interface CumulativePoint { time: number; count: number }
export interface IntervalBin { label: string; minimumHours: number; maximumHours: number; count: number }
export interface RollingBPoint { time: number; value: number }

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function regression(x: number[], y: number[]) {
  if (x.length < 2 || x.length !== y.length) return { slope: null as number | null, correlation: null as number | null };
  const meanX = mean(x);
  const meanY = mean(y);
  const covariance = x.reduce((sum, value, index) => sum + (value - meanX) * (y[index] - meanY), 0);
  const varianceX = x.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const varianceY = y.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  return {
    slope: varianceX > 0 ? covariance / varianceX : null,
    correlation: varianceX > 0 && varianceY > 0 ? covariance / Math.sqrt(varianceX * varianceY) : null,
  };
}

export function cumulativeSeismicity(sequence: Earthquake[]) {
  const ordered = [...sequence].sort((a, b) => a.time - b.time);
  const points = ordered.map<CumulativePoint>((event, index) => ({ time: event.time, count: index + 1 }));
  const spanDays = ordered.length > 1 ? (ordered.at(-1)!.time - ordered[0].time) / 86_400_000 : 0;
  return { points, averagePerDay: spanDays > 0 ? ordered.length / spanDays : ordered.length };
}

export function intervalDistribution(sequence: Earthquake[]) {
  const ordered = [...sequence].sort((a, b) => a.time - b.time);
  const intervals = ordered.slice(1).map((event, index) => Math.max(0, (event.time - ordered[index].time) / 3_600_000));
  const bins: IntervalBin[] = [
    { label: '<1h', minimumHours: 0, maximumHours: 1, count: 0 },
    { label: '1–6h', minimumHours: 1, maximumHours: 6, count: 0 },
    { label: '6–24h', minimumHours: 6, maximumHours: 24, count: 0 },
    { label: '1–3d', minimumHours: 24, maximumHours: 72, count: 0 },
    { label: '3–7d', minimumHours: 72, maximumHours: 168, count: 0 },
    { label: '>7d', minimumHours: 168, maximumHours: Infinity, count: 0 },
  ];
  for (const interval of intervals) bins.find((bin) => interval >= bin.minimumHours && interval < bin.maximumHours)!.count += 1;
  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianHours = sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { bins, intervals, medianHours };
}

export function rollingBValue(sequence: Earthquake[], windowSize = 8) {
  const ordered = [...sequence].sort((a, b) => a.time - b.time);
  const size = Math.max(4, Math.min(windowSize, ordered.length));
  if (ordered.length < 4) return [] as RollingBPoint[];
  const points: RollingBPoint[] = [];
  for (let index = size - 1; index < ordered.length; index += 1) {
    const window = ordered.slice(index - size + 1, index + 1);
    const value = frequencyMagnitude(window).bValue;
    if (value != null && Number.isFinite(value)) points.push({ time: ordered[index].time, value });
  }
  return points;
}

export function magnitudeDepthRelation(sequence: Earthquake[]) {
  const result = regression(sequence.map((event) => event.depthKm), sequence.map((event) => event.magnitude));
  return { correlation: result.correlation, magnitudePer100Km: result.slope == null ? null : result.slope * 100 };
}

export function verticalMigration(mainEvent: Earthquake, sequence: Earthquake[]) {
  const aftershocks = sequence.filter((event) => event.time > mainEvent.time);
  const result = regression(aftershocks.map((event) => (event.time - mainEvent.time) / 86_400_000), aftershocks.map((event) => event.depthKm));
  return { rateKmPerDay: result.slope, correlation: result.correlation };
}

export function spatialDiffusion(mainEvent: Earthquake, sequence: Earthquake[]) {
  const estimates = sequence.filter((event) => event.time > mainEvent.time).map((event) => {
    const days = (event.time - mainEvent.time) / 86_400_000;
    const radiusKm = haversineKm(mainEvent, event);
    return days > 0 ? radiusKm ** 2 / (4 * days) : 0;
  }).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const middle = Math.floor(estimates.length / 2);
  const coefficientKm2PerDay = estimates.length === 0 ? null : estimates.length % 2 ? estimates[middle] : (estimates[middle - 1] + estimates[middle]) / 2;
  return { coefficientKm2PerDay, sampleSize: estimates.length };
}

function energyJoules(magnitude: number) { return 10 ** (1.5 * magnitude + 4.8); }

export function energeticConcentration(sequence: Earthquake[]) {
  const energies = sequence.map((event) => ({ event, energy: energyJoules(event.magnitude) })).sort((a, b) => b.energy - a.energy);
  const total = energies.reduce((sum, item) => sum + item.energy, 0);
  const topThree = energies.slice(0, 3).reduce((sum, item) => sum + item.energy, 0);
  return { topThreeFraction: total > 0 ? topThree / total : 0, strongest: energies[0]?.event ?? null };
}

export function detectOutliers(mainEvent: Earthquake, sequence: Earthquake[]) {
  if (sequence.length < 4) return [] as Array<{ event: Earthquake; reasons: string[] }>;
  const depths = sequence.map((event) => event.depthKm);
  const distances = sequence.map((event) => haversineKm(mainEvent, event));
  const depthMean = mean(depths);
  const distanceMean = mean(distances);
  const depthDeviation = Math.sqrt(mean(depths.map((value) => (value - depthMean) ** 2)));
  const distanceDeviation = Math.sqrt(mean(distances.map((value) => (value - distanceMean) ** 2)));
  return sequence.map((event, index) => {
    const reasons: string[] = [];
    if (depthDeviation > 0 && Math.abs(depths[index] - depthMean) / depthDeviation >= 1.8) reasons.push('profundidad atípica');
    if (distanceDeviation > 0 && Math.abs(distances[index] - distanceMean) / distanceDeviation >= 1.8) reasons.push('posición periférica');
    if (event.id !== mainEvent.id && event.magnitude > mainEvent.magnitude + .2) reasons.push('magnitud superior al principal');
    return { event, reasons };
  }).filter((item) => item.reasons.length > 0);
}

export function catalogConsensus(sequence: Earthquake[]) {
  if (!sequence.length) return { score: 0, corroboratedFraction: 0, meanMagnitudeSpread: null as number | null };
  const corroborated = sequence.filter((event) => event.catalogs?.length > 1).length / sequence.length;
  const spreads = sequence.map((event) => event.solutions?.length ? Math.max(...event.solutions.map((solution) => solution.magnitude)) - Math.min(...event.solutions.map((solution) => solution.magnitude)) : null).filter((value): value is number => value != null);
  const spread = spreads.length ? mean(spreads) : null;
  const reviewed = sequence.filter((event) => event.status === 'reviewed' || event.reviewCode === 'R').length / sequence.length;
  const score = Math.round(Math.min(100, corroborated * 45 + reviewed * 35 + (spread == null ? 10 : Math.max(0, 20 - spread * 40))));
  return { score, corroboratedFraction: corroborated, meanMagnitudeSpread: spread };
}

export function classifySequence(mainEvent: Earthquake, sequence: Earthquake[]) {
  const precursors = sequence.filter((event) => event.time < mainEvent.time);
  const aftershocks = sequence.filter((event) => event.time > mainEvent.time);
  const largestNeighbour = sequence.filter((event) => event.id !== mainEvent.id).reduce((maximum, event) => Math.max(maximum, event.magnitude), -Infinity);
  const bathGap = Number.isFinite(largestNeighbour) ? mainEvent.magnitude - largestNeighbour : null;
  if (sequence.length <= 2) return { label: 'Evento aislado', confidence: 55, detail: 'La muestra local contiene muy pocos eventos asociados.' };
  if (precursors.length > aftershocks.length * 1.5) return { label: 'Actividad precursora dominante', confidence: 62, detail: 'La mayor parte de la actividad cargada precede al evento seleccionado.' };
  if (sequence.length >= 8 && bathGap != null && bathGap < .8) return { label: 'Enjambre probable', confidence: 70, detail: 'Varios eventos presentan magnitudes próximas, sin un principal claramente dominante.' };
  if (aftershocks.length >= 3 && bathGap != null && bathGap >= .8) return { label: 'Principal–réplicas', confidence: 78, detail: 'El evento seleccionado domina una secuencia posterior compatible con réplicas.' };
  return { label: 'Actividad sísmica dispersa', confidence: 58, detail: 'La muestra no encaja todavía en una secuencia temporal dominante.' };
}
