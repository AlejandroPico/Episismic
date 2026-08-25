import type { Earthquake } from '../types';

export interface IntensityZone {
  intensity: number;
  radiusKm: number;
  color: string;
  label: string;
}

const colors: Record<number, string> = {
  2: '#8ec9ff', 3: '#58d5cf', 4: '#80d56b', 5: '#e5d452', 6: '#f5a442',
  7: '#ed674b', 8: '#df3f50', 9: '#aa2e55', 10: '#70234f',
};

export function estimatedMaximumIntensity(event: Pick<Earthquake, 'magnitude' | 'depthKm' | 'estimatedIntensity' | 'intensity'>) {
  if (event.estimatedIntensity != null) return Math.max(2, Math.min(10, Math.round(event.estimatedIntensity)));
  if (event.intensity != null) return Math.max(2, Math.min(10, Math.round(event.intensity)));
  return Math.max(2, Math.min(10, Math.round(event.magnitude + 1.6 - Math.log10(Math.max(5, event.depthKm)) * 0.75)));
}

export function estimateIntensityZones(event: Pick<Earthquake, 'magnitude' | 'depthKm' | 'estimatedIntensity' | 'intensity'>): IntensityZone[] {
  const maximum = estimatedMaximumIntensity(event);
  const depthAttenuation = Math.max(0.28, 1 - event.depthKm / 850);
  const ruptureScale = Math.max(5, 10 ** (0.5 * event.magnitude - 1.2)) * depthAttenuation;
  const zones: IntensityZone[] = [];
  for (let intensity = 2; intensity <= maximum; intensity += 1) {
    const stepsFromMaximum = maximum - intensity;
    const radiusKm = Math.min(4_000, ruptureScale * (1.35 + stepsFromMaximum * stepsFromMaximum * 0.72 + stepsFromMaximum * 1.25));
    zones.push({ intensity, radiusKm, color: colors[intensity], label: `Intensidad estimada ${intensity}` });
  }
  return zones.sort((a, b) => b.radiusKm - a.radiusKm);
}
