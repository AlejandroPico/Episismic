import { describe, expect, it } from 'vitest';
import type { Earthquake } from '../types';
import { aftershockDecay, associatedSequence, azimuthDistribution, cumulativeEnergy, depthDistribution, depthTimeProfile, frequencyMagnitude, hypocentralMigration, momentBalance, sampleQuality, sequenceCsv, sequenceIndicators, spatialFootprint, temporalRate } from './seismicAnalysis';

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

  it('acumula energía sin perder la fracción total', () => {
    const result = cumulativeEnergy(nearby);
    expect(result.points.at(-1)?.cumulativeFraction).toBeCloseTo(1);
    expect(result.dominantFraction).toBeGreaterThan(.9);
  });

  it('calcula migración, cadencia e indicadores de secuencia', () => {
    const migrating = [main, event('m1', 4, 14, main.time + 86_400_000, .1, 0), event('m2', 3.8, 16, main.time + 172_800_000, .3, 0)];
    expect(hypocentralMigration(main, migrating).rateKmPerDay).toBeGreaterThan(0);
    expect(temporalRate(migrating).medianIntervalHours).toBe(24);
    const indicators = sequenceIndicators(main, migrating);
    expect(indicators.strongestAftershock?.id).toBe('m1');
    expect(indicators.bathGap).toBe(2);
  });

  it('resume geometría, profundidad y momento sísmico', () => {
    const east = event('east', 4, 24, main.time + 86_400_000, 0, .2);
    const sequence = [main, east, event('east-2', 3.5, 30, main.time + 172_800_000, 0, .4)];
    expect(azimuthDistribution(main, sequence).dominantBearingDeg).toBeCloseTo(105);
    expect(depthTimeProfile(main, sequence).at(-1)?.depthKm).toBe(30);
    expect(momentBalance(main, sequence).equivalentMagnitude).toBeGreaterThanOrEqual(main.magnitude);
    expect(spatialFootprint(main, sequence).radius90Km).toBeGreaterThan(40);
  });

  it('puntúa la muestra y exporta un CSV utilizable', () => {
    const quality = sampleQuality(main, nearby);
    expect(quality.score).toBeGreaterThan(0);
    const csv = sequenceCsv(nearby);
    expect(csv).toContain('fecha_iso');
    expect(csv.split('\n')).toHaveLength(nearby.length + 1);
  });
});
