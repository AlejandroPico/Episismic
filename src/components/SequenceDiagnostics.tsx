import { useMemo } from 'react';
import type { Earthquake } from '../types';
import { associatedSequence } from '../services/seismicAnalysis';
import {
  catalogConsensus, classifySequence, cumulativeSeismicity, detectOutliers, energeticConcentration,
  intervalDistribution, magnitudeDepthRelation, rollingBValue, spatialDiffusion, verticalMigration,
} from '../services/sequenceDiagnostics';

const WIDTH = 320;
const HEIGHT = 118;
const PAD = 18;

function pathFrom(points: Array<[number, number]>) { return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '); }

function CumulativeChart({ points }: { points: ReturnType<typeof cumulativeSeismicity>['points'] }) {
  const minimumTime = Math.min(...points.map((point) => point.time));
  const maximumTime = Math.max(...points.map((point) => point.time));
  const range = Math.max(1, maximumTime - minimumTime);
  const maximumCount = Math.max(1, ...points.map((point) => point.count));
  const chart = points.map((point) => [PAD + (point.time - minimumTime) / range * (WIDTH - PAD * 2), HEIGHT - PAD - point.count / maximumCount * (HEIGHT - PAD * 2)] as [number, number]);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Número acumulado de eventos"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD}M${PAD},${PAD}V${HEIGHT - PAD}`} /><path className="analysis-line" d={pathFrom(chart)} />{chart.map(([x, y], index) => <circle key={`${points[index].time}:${index}`} className="analysis-point" cx={x} cy={y} r="2.3" />)}</svg>;
}

function IntervalChart({ bins }: { bins: ReturnType<typeof intervalDistribution>['bins'] }) {
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  return <div className="diagnostic-bars" aria-label="Distribución de tiempos entre eventos">{bins.map((bin) => <span key={bin.label}><i style={{ height: `${Math.max(2, bin.count / maximum * 100)}%` }} /><strong>{bin.count}</strong><small>{bin.label}</small></span>)}</div>;
}

function RollingBChart({ points }: { points: ReturnType<typeof rollingBValue> }) {
  if (!points.length) return <p className="diagnostic-empty">Se necesitan al menos cuatro eventos para calcular una ventana móvil.</p>;
  const minimumTime = Math.min(...points.map((point) => point.time));
  const maximumTime = Math.max(...points.map((point) => point.time));
  const minimumValue = Math.min(...points.map((point) => point.value), .5);
  const maximumValue = Math.max(...points.map((point) => point.value), 1.5);
  const timeRange = Math.max(1, maximumTime - minimumTime);
  const valueRange = Math.max(.1, maximumValue - minimumValue);
  const chart = points.map((point) => [PAD + (point.time - minimumTime) / timeRange * (WIDTH - PAD * 2), HEIGHT - PAD - (point.value - minimumValue) / valueRange * (HEIGHT - PAD * 2)] as [number, number]);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Evolución móvil del valor b"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD}M${PAD},${PAD}V${HEIGHT - PAD}`} /><path className="analysis-line warm" d={pathFrom(chart)} />{chart.map(([x, y], index) => <circle key={`${points[index].time}:${index}`} className="analysis-point warm" cx={x} cy={y} r="2.5"><title>b={points[index].value.toFixed(2)}</title></circle>)}</svg>;
}

function RelationChart({ sequence }: { sequence: Earthquake[] }) {
  const maximumDepth = Math.max(1, ...sequence.map((event) => event.depthKm));
  const minimumMagnitude = Math.min(...sequence.map((event) => event.magnitude)) - .2;
  const maximumMagnitude = Math.max(...sequence.map((event) => event.magnitude)) + .2;
  const magnitudeRange = Math.max(.5, maximumMagnitude - minimumMagnitude);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Relación entre magnitud y profundidad"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD}M${PAD},${PAD}V${HEIGHT - PAD}`} />{sequence.map((event) => <circle key={event.id} className="analysis-point diagnostic-scatter-point" cx={PAD + event.depthKm / maximumDepth * (WIDTH - PAD * 2)} cy={HEIGHT - PAD - (event.magnitude - minimumMagnitude) / magnitudeRange * (HEIGHT - PAD * 2)} r={Math.max(2.2, Math.min(5.5, event.magnitude * .65))}><title>{event.depthKm.toFixed(1)} km · M{event.magnitude.toFixed(1)}</title></circle>)}</svg>;
}

export function SequenceDiagnostics({ event, events }: { event: Earthquake; events: Earthquake[] }) {
  const sequence = useMemo(() => associatedSequence(event, events), [event, events]);
  const cumulative = useMemo(() => cumulativeSeismicity(sequence), [sequence]);
  const intervals = useMemo(() => intervalDistribution(sequence), [sequence]);
  const rolling = useMemo(() => rollingBValue(sequence), [sequence]);
  const relation = useMemo(() => magnitudeDepthRelation(sequence), [sequence]);
  const vertical = useMemo(() => verticalMigration(event, sequence), [event, sequence]);
  const diffusion = useMemo(() => spatialDiffusion(event, sequence), [event, sequence]);
  const concentration = useMemo(() => energeticConcentration(sequence), [sequence]);
  const outliers = useMemo(() => detectOutliers(event, sequence), [event, sequence]);
  const consensus = useMemo(() => catalogConsensus(sequence), [sequence]);
  const classification = useMemo(() => classifySequence(event, sequence), [event, sequence]);

  return <div className="seismic-analysis-grid diagnostic-grid">
    <article className="analysis-card"><header><div><span>SISMICIDAD ACUMULADA</span><strong>{sequence.length} eventos</strong></div><small>{cumulative.averagePerDay.toFixed(2)} eventos/día</small></header><CumulativeChart points={cumulative.points} /></article>
    <article className="analysis-card"><header><div><span>INTERVALO ENTRE EVENTOS</span><strong>mediana {intervals.medianHours?.toFixed(1) ?? '—'} h</strong></div><small>{intervals.intervals.length} intervalos</small></header><IntervalChart bins={intervals.bins} /></article>
    <article className="analysis-card"><header><div><span>VALOR B MÓVIL</span><strong>{rolling.at(-1)?.value.toFixed(2) ?? '—'} actual</strong></div><small>ventana de 8 eventos</small></header><RollingBChart points={rolling} /></article>
    <article className="analysis-card"><header><div><span>MAGNITUD / PROFUNDIDAD</span><strong>correlación r {relation.correlation?.toFixed(2) ?? '—'}</strong></div><small>{relation.magnitudePer100Km?.toFixed(2) ?? '—'} M / 100 km</small></header><RelationChart sequence={sequence} /></article>
    <article className="analysis-card diagnostic-metric-card"><header><div><span>MIGRACIÓN VERTICAL</span><strong>{vertical.rateKmPerDay == null ? 'muestra insuficiente' : `${vertical.rateKmPerDay >= 0 ? '+' : ''}${vertical.rateKmPerDay.toFixed(2)} km/día`}</strong></div><small>positivo = profundización</small></header><div><span>Correlación temporal<strong>{vertical.correlation?.toFixed(2) ?? '—'}</strong></span><p>Regresión de la profundidad de las réplicas respecto al tiempo transcurrido.</p></div></article>
    <article className="analysis-card diagnostic-metric-card"><header><div><span>DIFUSIÓN ESPACIAL</span><strong>{diffusion.coefficientKm2PerDay?.toFixed(1) ?? '—'} km²/día</strong></div><small>{diffusion.sampleSize} réplicas</small></header><div><span>Coeficiente aparente D<strong>{diffusion.coefficientKm2PerDay == null ? '—' : diffusion.coefficientKm2PerDay < 100 ? 'Compacto' : diffusion.coefficientKm2PerDay < 1000 ? 'Moderado' : 'Disperso'}</strong></span><p>Estimación descriptiva mediante r²/4t; no constituye una predicción física.</p></div></article>
    <article className="analysis-card diagnostic-metric-card"><header><div><span>CONCENTRACIÓN ENERGÉTICA</span><strong>{(concentration.topThreeFraction * 100).toFixed(1)}% en los 3 mayores</strong></div><small>energía radiada estimada</small></header><div><span>Evento dominante<strong>{concentration.strongest ? `M${concentration.strongest.magnitude.toFixed(1)} · ${concentration.strongest.place}` : '—'}</strong></span><div className="diagnostic-meter"><i style={{ width: `${concentration.topThreeFraction * 100}%` }} /></div></div></article>
    <article className="analysis-card outlier-card"><header><div><span>EVENTOS ATÍPICOS</span><strong>{outliers.length} detectados</strong></div><small>umbral ≥ 1,8σ</small></header><div>{outliers.length === 0 ? <p>No se detectan valores periféricos suficientes.</p> : outliers.slice(0, 5).map((item) => <span key={item.event.id}><strong>M{item.event.magnitude.toFixed(1)}</strong><i>{item.reasons.join(' · ')}</i></span>)}</div></article>
    <article className="analysis-card consensus-card"><header><div><span>CONSENSO DE CATÁLOGO</span><strong>{consensus.score}/100</strong></div><small>agencias y revisiones</small></header><div><span><i style={{ width: `${consensus.score}%` }} /></span><small>Corroborados<strong>{(consensus.corroboratedFraction * 100).toFixed(0)}%</strong></small><small>Dispersión M<strong>{consensus.meanMagnitudeSpread?.toFixed(2) ?? '—'}</strong></small></div></article>
    <article className="analysis-card classification-card"><header><div><span>CLASIFICACIÓN AUTOMÁTICA</span><strong>{classification.label}</strong></div><small>confianza {classification.confidence}%</small></header><div><strong>{classification.confidence}%</strong><span><i style={{ width: `${classification.confidence}%` }} /></span><p>{classification.detail}</p></div></article>
    <p className="analysis-note">Diagnóstico exploratorio sobre la ventana local cargada. Las correlaciones y clasificaciones no sustituyen la revisión de una agencia sismológica.</p>
  </div>;
}
