import { useMemo } from 'react';
import type { Earthquake } from '../types';
import { aftershockDecay, associatedSequence, cumulativeEnergy, depthDistribution, frequencyMagnitude, hypocentralMigration, sequenceIndicators, temporalRate } from '../services/seismicAnalysis';

const WIDTH = 320;
const HEIGHT = 118;
const PAD = 18;

function pathFrom(points: Array<[number, number]>) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function TimelineChart({ sequence }: { sequence: Earthquake[] }) {
  const minimumTime = Math.min(...sequence.map((event) => event.time));
  const maximumTime = Math.max(...sequence.map((event) => event.time));
  const minimumMagnitude = Math.min(...sequence.map((event) => event.magnitude)) - .35;
  const maximumMagnitude = Math.max(...sequence.map((event) => event.magnitude)) + .35;
  const timeRange = Math.max(1, maximumTime - minimumTime);
  const magnitudeRange = Math.max(1, maximumMagnitude - minimumMagnitude);
  const points = sequence.slice(-180).map((event) => ({
    event,
    x: PAD + (event.time - minimumTime) / timeRange * (WIDTH - PAD * 2),
    y: HEIGHT - PAD - (event.magnitude - minimumMagnitude) / magnitudeRange * (HEIGHT - PAD * 2),
  }));
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Magnitud de la secuencia a lo largo del tiempo">
    <path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD} M${PAD},${PAD}V${HEIGHT - PAD}`} />
    <path className="analysis-line" d={pathFrom(points.map((point) => [point.x, point.y]))} />
    {points.map((point) => <circle key={point.event.id} className="analysis-point" cx={point.x} cy={point.y} r={Math.max(2.2, Math.min(6, point.event.magnitude * .75))}><title>M{point.event.magnitude.toFixed(1)} · {point.event.place}</title></circle>)}
  </svg>;
}

function FrequencyChart({ points }: { points: ReturnType<typeof frequencyMagnitude>['points'] }) {
  const maximumMagnitude = Math.max(...points.map((point) => point.magnitude), 1);
  const minimumMagnitude = Math.min(...points.map((point) => point.magnitude), 0);
  const maximumLog = Math.max(1, Math.log10(Math.max(...points.map((point) => point.cumulative), 1)));
  const range = Math.max(.5, maximumMagnitude - minimumMagnitude);
  const chartPoints = points.map((point) => [PAD + (point.magnitude - minimumMagnitude) / range * (WIDTH - PAD * 2), HEIGHT - PAD - Math.log10(Math.max(1, point.cumulative)) / maximumLog * (HEIGHT - PAD * 2)] as [number, number]);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Distribución acumulada Gutenberg-Richter"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD} M${PAD},${PAD}V${HEIGHT - PAD}`} /><path className="analysis-line warm" d={pathFrom(chartPoints)} />{chartPoints.map(([x, y], index) => <circle key={points[index].magnitude} className="analysis-point warm" cx={x} cy={y} r="2.6" />)}</svg>;
}

function EnergyChart({ points }: { points: ReturnType<typeof cumulativeEnergy>['points'] }) {
  const minimumTime = Math.min(...points.map((point) => point.time));
  const maximumTime = Math.max(...points.map((point) => point.time));
  const timeRange = Math.max(1, maximumTime - minimumTime);
  const chartPoints = points.map((point) => [PAD + (point.time - minimumTime) / timeRange * (WIDTH - PAD * 2), HEIGHT - PAD - point.cumulativeFraction * (HEIGHT - PAD * 2)] as [number, number]);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Energía sísmica acumulada"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD} M${PAD},${PAD}V${HEIGHT - PAD}`} /><path className="analysis-area" d={`${pathFrom([[PAD, HEIGHT - PAD], ...chartPoints])}L${WIDTH - PAD},${HEIGHT - PAD}Z`} /><path className="analysis-line" d={pathFrom(chartPoints)} />{chartPoints.map(([x, y], index) => <circle key={`${points[index].time}:${index}`} className="analysis-point" cx={x} cy={y} r="2.4"><title>{(points[index].cumulativeFraction * 100).toFixed(1)}% acumulado</title></circle>)}</svg>;
}

function MigrationChart({ points }: { points: ReturnType<typeof hypocentralMigration>['points'] }) {
  const minimumDay = Math.min(...points.map((point) => point.days));
  const maximumDay = Math.max(...points.map((point) => point.days));
  const maximumDistance = Math.max(1, ...points.map((point) => point.distanceKm));
  const dayRange = Math.max(.1, maximumDay - minimumDay);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Migración horizontal de los hipocentros"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD} M${PAD},${PAD}V${HEIGHT - PAD}`} />{points.slice(-180).map((point, index) => {
    const x = PAD + (point.days - minimumDay) / dayRange * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - point.distanceKm / maximumDistance * (HEIGHT - PAD * 2);
    const hue = Math.max(8, 185 - Math.min(700, point.depthKm) / 700 * 177);
    return <circle key={`${point.time}:${index}`} cx={x} cy={y} r={Math.max(2.2, Math.min(5.6, point.magnitude * .7))} style={{ fill: `hsl(${hue} 76% 58%)` }} className="analysis-point migration-point"><title>{point.days.toFixed(1)} d · {point.distanceKm.toFixed(1)} km · prof. {point.depthKm.toFixed(1)} km</title></circle>;
  })}</svg>;
}

function RateChart({ bins }: { bins: ReturnType<typeof temporalRate>['bins'] }) {
  const maximum = Math.max(1, ...bins.map((bin) => bin.eventsPerDay));
  const width = (WIDTH - PAD * 2) / Math.max(1, bins.length);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Tasa temporal de la secuencia"><path className="analysis-gridline" d={`M${PAD},${HEIGHT - PAD}H${WIDTH - PAD} M${PAD},${PAD}V${HEIGHT - PAD}`} />{bins.slice(-60).map((bin, index, visible) => {
    const visibleWidth = (WIDTH - PAD * 2) / Math.max(1, visible.length);
    const height = bin.eventsPerDay / maximum * (HEIGHT - PAD * 2);
    return <rect key={bin.startTime} x={PAD + index * visibleWidth + 1} y={HEIGHT - PAD - height} width={Math.max(1, visibleWidth - 2)} height={height} className="analysis-rate-bar"><title>{bin.eventsPerDay.toFixed(1)} eventos/día</title></rect>;
  })}{bins.length === 0 && <rect x={PAD} y={HEIGHT - PAD - 1} width={width} height="1" className="analysis-rate-bar" />}</svg>;
}

function formatEnergy(value: number) {
  if (value >= 1e15) return `${(value / 1e15).toFixed(2)} PJ`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} TJ`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GJ`;
  return `${(value / 1e6).toFixed(2)} MJ`;
}

export function SeismicAnalysis({ event, events }: { event: Earthquake; events: Earthquake[] }) {
  const sequence = useMemo(() => associatedSequence(event, events), [event, events]);
  const frequency = useMemo(() => frequencyMagnitude(sequence), [sequence]);
  const decay = useMemo(() => aftershockDecay(event, sequence), [event, sequence]);
  const depths = useMemo(() => depthDistribution(sequence), [sequence]);
  const energy = useMemo(() => cumulativeEnergy(sequence), [sequence]);
  const migration = useMemo(() => hypocentralMigration(event, sequence), [event, sequence]);
  const rate = useMemo(() => temporalRate(sequence), [sequence]);
  const indicators = useMemo(() => sequenceIndicators(event, sequence), [event, sequence]);
  const maximumDecay = Math.max(1, ...decay.map((point) => Math.max(point.count, point.expected)));
  const maximumDepthCount = Math.max(1, ...depths.map((bin) => bin.count));

  return <div className="seismic-analysis-grid">
    <article className="analysis-card"><header><div><span>MAGNITUD / TIEMPO</span><strong>{sequence.length} eventos asociados</strong></div><small>±14 días · radio local</small></header><TimelineChart sequence={sequence} /></article>
    <article className="analysis-card"><header><div><span>GUTENBERG–RICHTER</span><strong>valor b {frequency.bValue?.toFixed(2) ?? '—'}</strong></div><small>Mc ≈ M{frequency.completeness?.toFixed(1) ?? '—'}</small></header><FrequencyChart points={frequency.points} /></article>
    <article className="analysis-card"><header><div><span>DECAIMIENTO DE OMORI</span><strong>{sequence.filter((item) => item.time > event.time).length} réplicas</strong></div><small>14 días posteriores</small></header><div className="decay-bars" aria-label="Réplicas observadas y curva de Omori">{decay.map((point) => <i key={point.day} title={`Día ${point.day + 1}: ${point.count} eventos`} style={{ '--observed': `${point.count / maximumDecay * 100}%`, '--expected': `${point.expected / maximumDecay * 100}%` } as React.CSSProperties}><span /><b /><small>{point.day + 1}</small></i>)}</div><div className="analysis-legend"><span><i />Observado</span><span><i className="expected" />Modelo p=1,05</span></div></article>
    <article className="analysis-card"><header><div><span>PERFIL DE PROFUNDIDAD</span><strong>{event.depthKm.toFixed(1)} km principal</strong></div><small>hipocentros asociados</small></header><div className="depth-analysis-bars">{depths.map((bin) => <span key={bin.label}><i style={{ height: `${Math.max(3, bin.count / maximumDepthCount * 100)}%` }} /><strong>{bin.count}</strong><small>{bin.label}</small></span>)}</div><div className="analysis-axis-label">PROFUNDIDAD · KM</div></article>
    <article className="analysis-card"><header><div><span>ENERGÍA ACUMULADA</span><strong>{formatEnergy(energy.totalJoules)}</strong></div><small>{(energy.dominantFraction * 100).toFixed(1)}% evento dominante</small></header><EnergyChart points={energy.points} /></article>
    <article className="analysis-card"><header><div><span>MIGRACIÓN HIPOCENTRAL</span><strong>{migration.rateKmPerDay == null ? 'tendencia insuficiente' : `${migration.rateKmPerDay >= 0 ? '+' : ''}${migration.rateKmPerDay.toFixed(1)} km/día`}</strong></div><small>distancia al epicentro</small></header><MigrationChart points={migration.points} /><div className="analysis-axis-label">TIEMPO → · DISTANCIA ↑ · COLOR = PROF.</div></article>
    <article className="analysis-card"><header><div><span>RITMO DE ACTIVIDAD</span><strong>{rate.peakEventsPerDay.toFixed(1)} eventos/día máx.</strong></div><small>mediana Δt {rate.medianIntervalHours == null ? '—' : `${rate.medianIntervalHours.toFixed(1)} h`}</small></header><RateChart bins={rate.bins} /></article>
    <article className="analysis-card sequence-indicators"><header><div><span>INDICADORES DE SECUENCIA</span><strong>Ley de Båth ΔM {indicators.bathGap?.toFixed(1) ?? '—'}</strong></div><small>diagnóstico provisional</small></header><div><span>Réplica máxima<strong>{indicators.strongestAftershock ? `M${indicators.strongestAftershock.magnitude.toFixed(1)}` : '—'}</strong></span><span>Productividad M≥{(event.magnitude - 2).toFixed(1)}<strong>{indicators.productivity}</strong></span><span>Desplaz. centroide<strong>{indicators.centroidOffsetKm?.toFixed(1) ?? '—'} km</strong></span><span>Prof. media<strong>{indicators.meanDepthKm?.toFixed(1) ?? '—'} km</strong></span></div></article>
    <p className="analysis-note">Estadística provisional calculada sobre el catálogo actualmente cargado; la completitud y los parámetros pueden cambiar al incorporarse revisiones.</p>
  </div>;
}
