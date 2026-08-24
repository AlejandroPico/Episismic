import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Earthquake, TimeWindow } from '../types';

export function Timeline({ events, timeWindow, onReset, onPlayback }: { events: Earthquake[]; timeWindow: TimeWindow; onReset: () => void; onPlayback: (event: Earthquake) => void }) {
  const [playing, setPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
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
  const playbackEvents = useMemo(() => [...events]
    .sort((a, b) => a.time - b.time)
    .slice(-24), [events]);

  useEffect(() => {
    if (!playing || !playbackEvents.length) return;
    let current = Math.min(playbackIndex, playbackEvents.length - 1);
    let timer = 0;
    const step = () => {
      onPlayback(playbackEvents[current]);
      current += 1;
      setPlaybackIndex(current);
      if (current >= playbackEvents.length) {
        setPlaying(false);
        return;
      }
      timer = window.setTimeout(step, 4_300);
    };
    step();
    return () => window.clearTimeout(timer);
  // El índice inicial solo se toma al pulsar Play; durante la sesión avanza en el cierre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, playbackEvents, onPlayback]);

  const togglePlayback = () => {
    if (!playing && playbackIndex >= playbackEvents.length) setPlaybackIndex(0);
    setPlaying((current) => !current);
  };

  const progress = playbackEvents.length ? Math.min(100, (playbackIndex / playbackEvents.length) * 100) : 0;
  return <div className="timeline">
    <button onClick={togglePlayback} disabled={!playbackEvents.length} title={playing ? 'Pausar reproducción' : 'Reproducir los 24 eventos más recientes'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    <div className={`timeline-bars ${playing ? 'playing' : ''}`} aria-label="Distribución temporal de eventos">
      {bars.map((value, index) => <i key={index} style={{ height: `${Math.max(2, value * 6.2)}px`, opacity: value ? 0.35 + value / 12 : 0.1 }} />)}
      <span className="timeline-cursor" style={{ left: `${playing || playbackIndex ? progress : 100}%` }} />
    </div>
    <span className="timeline-label">{playing ? `${Math.min(playbackIndex, playbackEvents.length)}/${playbackEvents.length}` : playbackIndex && playbackIndex < playbackEvents.length ? 'PAUSA' : 'AHORA'}</span>
    <button onClick={onReset} title="Restablecer vista"><RotateCcw size={15} /></button>
  </div>;
}
