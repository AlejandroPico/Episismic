import { describe, expect, it } from 'vitest';
import type { Earthquake } from '../types';
import { assessImpact, groundMotionEstimate, impactRadii, impactReportMarkdown, operationalPriority, ruptureGeometry, secondaryHazardScreening } from './impactAssessment';

const event = (magnitude: number, depthKm: number, tsunami = false) => ({ id: 'e', magnitude, depthKm, tsunami, alert: null, significance: 500, felt: 0, estimatedIntensity: null, intensity: null, magnitudeType: 'mw', place: 'Prueba', time: 1_000_000, lat: 0, lng: 0 } as Earthquake);

describe('evaluación experimental de impacto', () => {
  it('aumenta el movimiento con la magnitud', () => {
    expect(groundMotionEstimate(event(7, 15)).pgaG).toBeGreaterThan(groundMotionEstimate(event(5, 15)).pgaG);
    expect(groundMotionEstimate(event(7, 15)).pgvCmS).toBeGreaterThan(0);
  });

  it('calcula radios y geometría de ruptura', () => {
    const strong = event(8, 20);
    const radii = impactRadii(strong);
    expect(radii.perceivedKm).toBeGreaterThanOrEqual(radii.lightDamageKm);
    expect(radii.lightDamageKm).toBeGreaterThanOrEqual(radii.severeDamageKm);
    expect(ruptureGeometry(strong).areaKm2).toBeGreaterThan(0);
  });

  it('eleva cribados y prioridad para un gran terremoto somero', () => {
    const strong = event(8, 15, true);
    expect(secondaryHazardScreening(strong).tsunami).toBe('Elevado');
    expect(operationalPriority(strong).score).toBeGreaterThan(70);
  });

  it('compone evaluación e informe reproducible', () => {
    expect(assessImpact(event(6, 20)).rupture.lengthKm).toBeGreaterThan(0);
    expect(impactReportMarkdown(event(6, 20))).toContain('Prioridad operativa');
  });
});
