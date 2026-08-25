import { describe, expect, it } from 'vitest';
import { estimatedMaximumIntensity, estimateIntensityZones } from './shakeMap';

describe('mapa de intensidad estimada', () => {
  it('respeta una intensidad publicada y crea zonas concéntricas decrecientes', () => {
    const zones = estimateIntensityZones({ magnitude: 6.2, depthKm: 20, estimatedIntensity: 8, intensity: null });
    expect(estimatedMaximumIntensity({ magnitude: 6.2, depthKm: 20, estimatedIntensity: 8, intensity: null })).toBe(8);
    expect(zones.at(-1)?.intensity).toBe(8);
    expect(zones.every((zone, index) => index === 0 || zones[index - 1].radiusKm > zone.radiusKm)).toBe(true);
  });

  it('atenúa la extensión de un evento profundo', () => {
    const shallow = estimateIntensityZones({ magnitude: 6, depthKm: 10, estimatedIntensity: null, intensity: null });
    const deep = estimateIntensityZones({ magnitude: 6, depthKm: 500, estimatedIntensity: null, intensity: null });
    expect(shallow[0].radiusKm).toBeGreaterThan(deep[0].radiusKm);
  });
});
