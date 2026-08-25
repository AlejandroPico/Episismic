import { useMemo } from 'react';
import type { Earthquake } from '../types';
import { aftershockDecay, associatedSequence, depthDistribution, frequencyMagnitude } from '../services/seismicAnalysis';

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

export function SeismicAnalysis({ event, events }: { event: Earthquake; events: Earthquake[] }) {
  const sequence = useMemo(() => associatedSequence(event, events), [event, events]);
  const frequency = useMemo(() => frequencyMagnitude(sequence), [sequence]);
  const decay = useMemo(() => aftershockDecay(event, sequence), [event, sequence]);
  const depths = useMemo(() => depthDistribution(sequence), [sequence]);
  const maximumDecay = Math.max(1, ...decay.map((point) => Math.max(point.count, point.expected)));
  const maximumDepthCount = Math.max(1, ...depths.map((bin) => bin.count));

  return <div className="seismic-analysis-grid">
    <article className="analysis-card"><header><div><span>MAGNITUD / TIEMPO</span><strong>{sequence.length} eventos asociados</strong></div><small>±14 días · radio local</small></header><TimelineChart sequence={sequence} /></article>
    <article className="analysis-card"><header><div><span>GUTENBERG–RICHTER</span><strong>valor b {frequency.bValue?.toFixed(2) ?? '—'}</strong></div><small>Mc ≈ M{frequency.completeness?.toFixed(1) ?? '—'}</small></header><FrequencyChart points={frequency.points} /></article>
    <article className="analysis-card"><header><div><span>DECAIMIENTO DE OMORI</span><strong>{sequence.filter((item) => item.time > event.time).length} réplicas</strong></div><small>14 días posteriores</small></header><div className="decay-bars" aria-label="Réplicas observadas y curva de Omori">{decay.map((point) => <i key={point.day} title={`Día ${point.day + 1}: ${point.count} eventos`} style={{ '--observed': `${point.count / maximumDecay * 100}%`, '--expected': `${point.expected / maximumDecay * 100}%` } as React.CSSProperties}><span /><b /><small>{point.day + 1}</small></i>)}</div><div className="analysis-legend"><span><i />Observado</span><span><i className="expected" />Modelo p=1,05</span></div></article>
    <article className="analysis-card"><header><div><span>PERFIL DE PROFUNDIDAD</span><strong>{event.depthKm.toFixed(1)} km principal</strong></div><small>hipocentros asociados</small></header><div className="depth-analysis-bars">{depths.map((bin) => <span key={bin.label}><i style={{ height: `${Math.max(3, bin.count / maximumDepthCount * 100)}%` }} /><strong>{bin.count}</strong><small>{bin.label}</small></span>)}</div><div className="analysis-axis-label">PROFUNDIDAD · KM</div></article>
    <p className="analysis-note">Estadística provisional calculada sobre el catálogo actualmente cargado; la completitud y los parámetros pueden cambiar al incorporarse revisiones.</p>
  </div>;
}
