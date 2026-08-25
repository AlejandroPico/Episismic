import { describe, expect, it } from 'vitest';
import type { Earthquake } from '../types';
import { catalogConsensus, classifySequence, cumulativeSeismicity, detectOutliers, energeticConcentration, intervalDistribution, magnitudeDepthRelation, rollingBValue, spatialDiffusion, verticalMigration } from './sequenceDiagnostics';

const event = (id: string, magnitude: number, depthKm: number, time: number, lat = 0, lng = 0, reviewed = true) => ({
  id, magnitude, depthKm, time, lat, lng, status: reviewed ? 'reviewed' : 'automatic', reviewCode: reviewed ? 'R' : 'A', catalogs: reviewed ? ['USGS', 'EMSC'] : ['USGS'], source: 'USGS', magnitudeType: 'mw', place: id,
} as Earthquake);

describe('diagnóstico avanzado de secuencias', () => {
  const main = event('main', 6, 10, 1_000_000);
  const sequence = [main, event('a', 4.5, 20, main.time + 86_400_000, .1), event('b', 4, 30, main.time + 172_800_000, .25), event('c', 3.5, 40, main.time + 259_200_000, .45)];

  it('calcula acumulación, intervalos y valor b móvil', () => {
    expect(cumulativeSeismicity(sequence).points.at(-1)?.count).toBe(4);
    expect(intervalDistribution(sequence).medianHours).toBe(24);
    expect(rollingBValue(sequence, 4)).toHaveLength(1);
  });

  it('calcula correlación, migración vertical y difusión', () => {
    expect(magnitudeDepthRelation(sequence).correlation).toBeLessThan(0);
    expect(verticalMigration(main, sequence).rateKmPerDay).toBeCloseTo(10);
    expect(spatialDiffusion(main, sequence).coefficientKm2PerDay).toBeGreaterThan(0);
  });

  it('mide concentración energética y consenso', () => {
    expect(energeticConcentration(sequence).topThreeFraction).toBeGreaterThan(.99);
    expect(catalogConsensus(sequence).score).toBeGreaterThan(70);
  });

  it('clasifica la secuencia y detecta anomalías', () => {
    expect(classifySequence(main, sequence).label).toBe('Principal–réplicas');
    const withOutlier = [...sequence, event('deep', 2, 600, main.time + 300_000_000)];
    expect(detectOutliers(main, withOutlier).some((item) => item.event.id === 'deep')).toBe(true);
  });
});
