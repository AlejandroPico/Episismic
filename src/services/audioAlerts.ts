import type { SeismicActivityKind } from '../types';

let context: AudioContext | null = null;

function getContext() {
  if (!context) context = new AudioContext();
  return context;
}

export type SeismicAlertLevel = 'leve' | 'moderada' | 'fuerte' | 'crítica';

export function seismicAlertLevel(magnitude: number): SeismicAlertLevel {
  if (magnitude >= 6.5) return 'crítica';
  if (magnitude >= 5) return 'fuerte';
  if (magnitude >= 3) return 'moderada';
  return 'leve';
}

export async function unlockAudioAlerts() {
  try {
    const audio = getContext();
    if (audio.state === 'suspended') await audio.resume();
  } catch {
    // El mapa y los datos deben seguir funcionando aunque el navegador bloquee audio.
  }
}

interface ToneStep {
  frequency: number;
  duration: number;
  offset: number;
  volume: number;
  type: OscillatorType;
}

function patternFor(kind: SeismicActivityKind, magnitude: number): ToneStep[] {
  const level = seismicAlertLevel(magnitude);
  const kindFactor = kind === 'revision' ? .58 : kind === 'corroborated' ? .72 : kind === 'magnitude' ? 1.08 : 1;
  const profiles: Record<SeismicAlertLevel, ToneStep[]> = {
    leve: [
      { frequency: 520, duration: .1, offset: 0, volume: .035, type: 'sine' },
      { frequency: 420, duration: .13, offset: .13, volume: .03, type: 'sine' },
    ],
    moderada: [
      { frequency: 370, duration: .13, offset: 0, volume: .065, type: 'triangle' },
      { frequency: 295, duration: .2, offset: .16, volume: .065, type: 'triangle' },
    ],
    fuerte: [
      { frequency: 250, duration: .16, offset: 0, volume: .105, type: 'sawtooth' },
      { frequency: 330, duration: .16, offset: .2, volume: .11, type: 'sawtooth' },
      { frequency: 220, duration: .26, offset: .4, volume: .12, type: 'triangle' },
    ],
    crítica: [
      { frequency: 180, duration: .22, offset: 0, volume: .15, type: 'sawtooth' },
      { frequency: 285, duration: .22, offset: .25, volume: .16, type: 'sawtooth' },
      { frequency: 180, duration: .22, offset: .5, volume: .16, type: 'sawtooth' },
      { frequency: 315, duration: .3, offset: .75, volume: .17, type: 'sawtooth' },
    ],
  };
  return profiles[level].map((step, index) => ({
    ...step,
    frequency: step.frequency * (kind === 'magnitude' ? 1 + index * .08 : 1),
    volume: step.volume * kindFactor,
  }));
}

export function playSeismicAlert(magnitude: number, kind: SeismicActivityKind = 'new', delayMs = 0) {
  window.setTimeout(() => {
    try {
      const audio = getContext();
      if (audio.state !== 'running') return;
      const start = audio.currentTime;
      patternFor(kind, magnitude).forEach((step) => {
        const gain = audio.createGain();
        const oscillator = audio.createOscillator();
        const toneStart = start + step.offset;
        oscillator.type = step.type;
        oscillator.frequency.setValueAtTime(step.frequency, toneStart);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, step.frequency * .78), toneStart + step.duration);
        gain.gain.setValueAtTime(.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(step.volume, toneStart + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, toneStart + step.duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneStart + step.duration + .02);
      });
    } catch {
      // Sin audio no se interrumpe la actualización científica.
    }
  }, delayMs);
}
