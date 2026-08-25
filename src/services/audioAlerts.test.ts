import { describe, expect, it } from 'vitest';
import { seismicAlertLevel } from './audioAlerts';

describe('gravedad de las alertas sonoras', () => {
  it('clasifica la magnitud en cuatro perfiles audibles', () => {
    expect(seismicAlertLevel(1.2)).toBe('leve');
    expect(seismicAlertLevel(3.8)).toBe('moderada');
    expect(seismicAlertLevel(5.7)).toBe('fuerte');
    expect(seismicAlertLevel(7.1)).toBe('crítica');
  });
});
