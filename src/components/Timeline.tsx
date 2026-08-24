import { Pause, Play, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Earthquake, TimeWindow } from '../types';

export function Timeline({ events, timeWindow, onReset }: { events: Earthquake[]; timeWindow: TimeWindow; onReset: () => void }) {
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => {
    if (!events.length) return Array.from({ length: 48 }, () => 0);
    const newest = Date.now();
    const duration = ({ hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 })[timeWindow];
    const start = newest - duration;
    const buckets = Array.from({ length: 48 }, () => 0);
    events.forEach((event) => {
      const index = Math.max(0, Math.min(47, Math.floor(((event.time - start) / duration) * 48)));
      buckets[index] = Math.max(buckets[index], event.magnitude);
    });
    return buckets;
  }, [events, timeWindow]);
  return <div className="timeline">
    <button onClick={() => setPlaying(!playing)} title={playing ? 'Pausar reproducción' : 'Reproducir cronología'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    <div className={`timeline-bars ${playing ? 'playing' : ''}`} aria-label="Distribución temporal de eventos">
      {bars.map((value, index) => <i key={index} style={{ height: `${Math.max(2, value * 6.2)}px`, opacity: value ? 0.35 + value / 12 : 0.1 }} />)}
      <span className="timeline-cursor" />
    </div>
    <span className="timeline-label">AHORA</span>
    <button onClick={onReset} title="Restablecer vista"><RotateCcw size={15} /></button>
  </div>;
}
