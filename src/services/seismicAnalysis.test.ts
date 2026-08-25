import { describe, expect, it } from 'vitest';
import type { Earthquake } from '../types';
import { aftershockDecay, associatedSequence, depthDistribution, frequencyMagnitude } from './seismicAnalysis';

const event = (id: string, magnitude: number, depthKm: number, time: number, lat = 0, lng = 0) => ({ id, magnitude, depthKm, time, lat, lng } as Earthquake);

describe('análisis estadístico de secuencias', () => {
  const main = event('main', 6, 12, 1_000_000);
  const nearby = [main, event('a', 4, 8, main.time + 3_600_000), event('b', 3, 55, main.time + 90_000_000), event('c', 2, 320, main.time + 180_000_000)];

  it('excluye eventos lejanos de la secuencia local', () => {
    const far = event('far', 5, 10, main.time + 1_000, 20, 20);
    expect(associatedSequence(main, [...nearby, far]).map((item) => item.id)).not.toContain('far');
  });

  it('calcula la frecuencia acumulada y un valor b positivo', () => {
    const result = frequencyMagnitude(nearby);
    expect(result.points[0].cumulative).toBe(4);
    expect(result.bValue).toBeGreaterThan(0);
  });

  it('agrupa profundidad y decaimiento diario', () => {
    expect(depthDistribution(nearby).reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
    const decay = aftershockDecay(main, nearby);
    expect(decay[0].count).toBe(1);
    expect(decay[0].expected).toBeGreaterThan(decay[3].expected);
  });
});
