import { useMemo } from 'react';
import { AlertTriangle, Download, Printer } from 'lucide-react';
import type { Earthquake } from '../types';
import { assessImpact, impactReportMarkdown, type ScreeningLevel } from '../services/impactAssessment';

function downloadText(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }

function printReport(event: Earthquake, report: string) {
  const view = window.open('', '_blank', 'width=900,height=720');
  if (!view) return;
  view.opener = null;
  view.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe Episismic · ${escapeHtml(event.place)}</title><style>body{max-width:820px;margin:36px auto;padding:0 24px;color:#172326;font:14px/1.55 system-ui,sans-serif}pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,monospace}footer{margin-top:28px;border-top:1px solid #ccd5d4;padding-top:12px;color:#617170;font-size:11px}@media print{body{margin:0}}</style></head><body><pre>${escapeHtml(report)}</pre><footer>Episismic · informe experimental y no operativo</footer><script>window.onload=()=>window.print()</script></body></html>`);
  view.document.close();
}

function levelClass(level: ScreeningLevel) { return level === 'Elevado' ? 'high' : level === 'Vigilancia' ? 'watch' : 'low'; }

export function ImpactAssessment({ event }: { event: Earthquake }) {
  const assessment = useMemo(() => assessImpact(event), [event]);
  const report = useMemo(() => impactReportMarkdown(event), [event]);
  const maximumRadius = Math.max(1, assessment.radii.perceivedKm);
  const radius = (value: number) => Math.max(2, value / maximumRadius * 72);

  return <div className="impact-assessment">
    <section className="impact-priority" data-level={assessment.priority.level.toLowerCase()}><div><span>PRIORIDAD OPERATIVA EXPERIMENTAL</span><strong>{assessment.priority.level}</strong><small>Integra magnitud, intensidad, alerta, tsunami, significancia y reportes sentidos.</small></div><b>{assessment.priority.score}<small>/100</small></b></section>
    <div className="impact-grid">
      <article className="impact-card impact-zones"><header><span>EXTENSIÓN DE INTENSIDAD</span><strong>MMI {assessment.motion.maximumIntensity} máxima</strong></header><div><svg viewBox="0 0 180 180" role="img" aria-label="Radios estimados de intensidad"><circle className="impact-ring perceived" cx="90" cy="90" r={radius(assessment.radii.perceivedKm)} /><circle className="impact-ring damage" cx="90" cy="90" r={radius(assessment.radii.lightDamageKm)} /><circle className="impact-ring severe" cx="90" cy="90" r={radius(assessment.radii.severeDamageKm)} /><circle className="impact-epicenter" cx="90" cy="90" r="4" /></svg><div><span><i className="perceived" />MMI II<strong>{assessment.radii.perceivedKm.toFixed(0)} km</strong></span><span><i className="damage" />MMI VI<strong>{assessment.radii.lightDamageKm.toFixed(0)} km</strong></span><span><i className="severe" />MMI VIII<strong>{assessment.radii.severeDamageKm.toFixed(0)} km</strong></span></div></div></article>
      <article className="impact-card"><header><span>MOVIMIENTO DEL TERRENO</span><strong>Modelo de atenuación simplificado</strong></header><div className="impact-metrics three"><span>Intensidad máxima<strong>MMI {assessment.motion.maximumIntensity}</strong></span><span>PGA estimada<strong>{assessment.motion.pgaG.toFixed(3)} g</strong></span><span>PGV estimada<strong>{assessment.motion.pgvCmS.toFixed(1)} cm/s</strong></span></div></article>
      <article className="impact-card"><header><span>GEOMETRÍA DE RUPTURA</span><strong>Relaciones empíricas por magnitud</strong></header><div className="impact-metrics four"><span>Longitud<strong>{assessment.rupture.lengthKm.toFixed(1)} km</strong></span><span>Anchura<strong>{assessment.rupture.widthKm.toFixed(1)} km</strong></span><span>Área<strong>{assessment.rupture.areaKm2.toFixed(1)} km²</strong></span><span>Duración<strong>{assessment.rupture.durationSeconds.toFixed(1)} s</strong></span></div></article>
      <article className="impact-card"><header><span>RIESGOS SECUNDARIOS</span><strong>Cribado inicial</strong></header><div className="hazard-screening"><span className={levelClass(assessment.hazards.tsunami)}><AlertTriangle size={14} />Tsunami<strong>{assessment.hazards.tsunami}</strong></span><span className={levelClass(assessment.hazards.landslide)}><AlertTriangle size={14} />Deslizamientos<strong>{assessment.hazards.landslide}</strong></span><span className={levelClass(assessment.hazards.liquefaction)}><AlertTriangle size={14} />Licuefacción<strong>{assessment.hazards.liquefaction}</strong></span></div></article>
    </div>
    <section className="impact-report-actions"><div><strong>Informe técnico del incidente</strong><span>Incluye evento, movimiento, radios, ruptura, riesgos y prioridad.</span></div><button onClick={() => downloadText(`episismic-impacto-${event.id}.md`, report, 'text/markdown;charset=utf-8')}><Download size={14} /> MARKDOWN</button><button onClick={() => downloadText(`episismic-impacto-${event.id}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), event, assessment }, null, 2), 'application/json')}><Download size={14} /> JSON</button><button onClick={() => printReport(event, report)}><Printer size={14} /> IMPRIMIR / PDF</button></section>
    <p className="impact-disclaimer">Las cifras son estimaciones educativas y experimentales. Los riesgos de tsunami, deslizamiento o licuefacción requieren batimetría, pendiente, geología, suelo y productos oficiales que no contiene este cribado.</p>
  </div>;
}
