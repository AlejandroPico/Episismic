import type { Earthquake } from '../types';
import { estimatedMaximumIntensity, estimateIntensityZones } from './shakeMap';

export type ScreeningLevel = 'Bajo' | 'Vigilancia' | 'Elevado';

function radiusForIntensity(event: Earthquake, intensity: number) {
  const zones = estimateIntensityZones(event);
  return zones.find((zone) => zone.intensity === intensity)?.radiusKm ?? 0;
}

export function ruptureGeometry(event: Earthquake) {
  const lengthKm = 10 ** (.5 * event.magnitude - 1.8);
  const widthKm = Math.min(180, 10 ** (.32 * event.magnitude - 1.01));
  const areaKm2 = lengthKm * widthKm;
  const durationSeconds = Math.max(.5, lengthKm / 2.8);
  return { lengthKm, widthKm, areaKm2, durationSeconds };
}

export function groundMotionEstimate(event: Earthquake) {
  const effectiveDepth = Math.max(5, event.depthKm + 10);
  const pgaG = Math.max(.001, Math.min(2.5, 10 ** (.45 * event.magnitude - 1.3 * Math.log10(effectiveDepth) - 2.3)));
  const pgvCmS = Math.max(.1, Math.min(250, pgaG * 82));
  return { pgaG, pgvCmS, maximumIntensity: estimatedMaximumIntensity(event) };
}

export function impactRadii(event: Earthquake) {
  return {
    perceivedKm: radiusForIntensity(event, 2),
    lightDamageKm: radiusForIntensity(event, 6),
    severeDamageKm: radiusForIntensity(event, 8),
  };
}

export function secondaryHazardScreening(event: Earthquake) {
  const intensity = estimatedMaximumIntensity(event);
  const tsunami: ScreeningLevel = event.tsunami || (event.magnitude >= 7 && event.depthKm <= 50) ? 'Elevado' : event.magnitude >= 6.5 && event.depthKm <= 70 ? 'Vigilancia' : 'Bajo';
  const landslide: ScreeningLevel = intensity >= 8 && event.depthKm <= 70 ? 'Elevado' : intensity >= 6 && event.depthKm <= 150 ? 'Vigilancia' : 'Bajo';
  const liquefaction: ScreeningLevel = intensity >= 7 && event.depthKm <= 50 ? 'Elevado' : intensity >= 5 && event.depthKm <= 100 ? 'Vigilancia' : 'Bajo';
  return { tsunami, landslide, liquefaction };
}

export function operationalPriority(event: Earthquake) {
  const intensity = estimatedMaximumIntensity(event);
  const alertWeight = event.alert ? ({ green: 4, yellow: 10, orange: 18, red: 25 } as const)[event.alert] : 0;
  const score = Math.round(Math.min(100,
    Math.max(0, event.magnitude - 3) * 13
    + Math.max(0, intensity - 3) * 5
    + alertWeight
    + (event.tsunami ? 12 : 0)
    + Math.min(10, event.significance / 100)
    + Math.min(8, (event.felt ?? 0) / 1_000),
  ));
  const level = score >= 80 ? 'Crítica' : score >= 60 ? 'Alta' : score >= 35 ? 'Media' : 'Baja';
  return { score, level };
}

export function assessImpact(event: Earthquake) {
  return {
    motion: groundMotionEstimate(event),
    radii: impactRadii(event),
    rupture: ruptureGeometry(event),
    hazards: secondaryHazardScreening(event),
    priority: operationalPriority(event),
  };
}

export function impactReportMarkdown(event: Earthquake) {
  const assessment = assessImpact(event);
  const generated = new Date().toISOString();
  return `# Informe de impacto · ${event.place}\n\n` +
    `Generado por Episismic ${generated}.\n\n` +
    `## Evento\n\n- Identificador: ${event.id}\n- Fecha: ${new Date(event.time).toISOString()}\n- Magnitud: M${event.magnitude.toFixed(1)} ${event.magnitudeType.toUpperCase()}\n- Profundidad: ${event.depthKm.toFixed(1)} km\n- Coordenadas: ${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}\n\n` +
    `## Movimiento estimado\n\n- Intensidad máxima: MMI ${assessment.motion.maximumIntensity}\n- PGA: ${assessment.motion.pgaG.toFixed(3)} g\n- PGV: ${assessment.motion.pgvCmS.toFixed(1)} cm/s\n- Radio percibido MMI II: ${assessment.radii.perceivedKm.toFixed(0)} km\n- Radio de daño MMI VI: ${assessment.radii.lightDamageKm.toFixed(0)} km\n- Radio severo MMI VIII: ${assessment.radii.severeDamageKm.toFixed(0)} km\n\n` +
    `## Ruptura empírica\n\n- Longitud: ${assessment.rupture.lengthKm.toFixed(1)} km\n- Anchura: ${assessment.rupture.widthKm.toFixed(1)} km\n- Área: ${assessment.rupture.areaKm2.toFixed(1)} km²\n- Duración: ${assessment.rupture.durationSeconds.toFixed(1)} s\n\n` +
    `## Cribado de riesgos\n\n- Tsunami: ${assessment.hazards.tsunami}\n- Deslizamientos: ${assessment.hazards.landslide}\n- Licuefacción: ${assessment.hazards.liquefaction}\n- Prioridad operativa: ${assessment.priority.level} (${assessment.priority.score}/100)\n\n` +
    `> Estimación experimental. No sustituye ShakeMap, PAGER ni avisos de protección civil.\n`;
}
