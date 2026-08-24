import type { SeismicActivityKind } from '../types';

let context: AudioContext | null = null;

function getContext() {
  if (!context) context = new AudioContext();
  return context;
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
  const strong = magnitude >= 5;
  const base = strong ? 190 : magnitude >= 2.5 ? 310 : 460;
  const volume = strong ? .13 : magnitude >= 2.5 ? .075 : .04;
  if (kind === 'magnitude') return [
    { frequency: base, duration: .15, offset: 0, volume, type: 'triangle' },
    { frequency: base * 1.28, duration: .18, offset: .17, volume: volume * 1.08, type: 'sawtooth' },
    { frequency: base * 1.58, duration: .22, offset: .38, volume: volume * 1.15, type: 'sawtooth' },
  ];
  if (kind === 'corroborated') return [
    { frequency: base * 1.08, duration: .13, offset: 0, volume: volume * .72, type: 'sine' },
    { frequency: base * 1.08, duration: .13, offset: .19, volume: volume * .72, type: 'sine' },
  ];
  if (kind === 'revision') return [{ frequency: base * 1.2, duration: .12, offset: 0, volume: volume * .45, type: 'sine' }];
  return [
    { frequency: base * 1.18, duration: .14, offset: 0, volume, type: strong ? 'sawtooth' : 'triangle' },
    { frequency: base, duration: .24, offset: .17, volume, type: strong ? 'sawtooth' : 'sine' },
  ];
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
