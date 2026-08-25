import { describe, expect, it } from 'vitest';
import type { Earthquake, SeismicStation } from '../types';
import { associateStationEvents, stationAssociationsCsv, stationEventSummary } from './stationEventAnalysis';

const station = { id: 'XX.TEST', network: 'XX', code: 'TEST', lat: 0, lng: 0, status: 'online' } as SeismicStation;
const event = (id: string, magnitude: number, lng: number, time = 1_000_000) => ({ id, magnitude, lng, lat: 0, depthKm: 10, time, estimatedIntensity: null, intensity: null, magnitudeType: 'mw', place: id, source: 'USGS', status: 'reviewed' } as Earthquake);

describe('asociación estación–terremoto', () => {
  it('calcula geometría y orden de llegadas', () => {
    const item = associateStationEvents(station, [event('este', 6, 1)], 1_000_000)[0];
    expect(item.distanceKm).toBeCloseTo(111, 0);
    expect(item.azimuthDeg).toBeCloseTo(90, 0);
    expect(item.backAzimuthDeg).toBeCloseTo(270, 0);
    expect(item.pSeconds).toBeLessThan(item.sSeconds);
    expect(item.sSeconds).toBeLessThan(item.surfaceSeconds);
  });

  it('estima desfase, intensidad y detectabilidad', () => {
    const item = associateStationEvents(station, [event('fuerte', 7, .2)], 1_000_000)[0];
    expect(item.psLagSeconds).toBeGreaterThan(0);
    expect(item.estimatedIntensity).toBeGreaterThan(1);
    expect(item.detectionScore).toBeGreaterThan(40);
  });

  it('resume distancias y eventos dominantes', () => {
    const events = [event('cerca', 4, 1), event('lejos', 7, 20, 2_000_000)];
    const summary = stationEventSummary(station, events, 2_000_000);
    expect(summary.nearest?.event.id).toBe('cerca');
    expect(summary.strongest?.event.id).toBe('lejos');
    expect(summary.within500Km).toBe(1);
  });

  it('exporta todas las métricas en CSV', () => {
    const csv = stationAssociationsCsv(station, [event('e', 5, 1)]);
    expect(csv).toContain('desfase_ps_s');
    expect(csv.split('\n')).toHaveLength(2);
  });
});
