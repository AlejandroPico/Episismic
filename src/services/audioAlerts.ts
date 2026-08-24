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

export function playSeismicAlert(magnitude: number, delayMs = 0) {
  window.setTimeout(() => {
    try {
      const audio = getContext();
      if (audio.state !== 'running') return;
      const start = audio.currentTime;
      const gain = audio.createGain();
      const oscillator = audio.createOscillator();
      oscillator.type = magnitude >= 5 ? 'sawtooth' : magnitude >= 2.5 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(magnitude >= 5 ? 220 : magnitude >= 2.5 ? 330 : 470, start);
      oscillator.frequency.exponentialRampToValueAtTime(magnitude >= 5 ? 110 : 250, start + .22);
      const volume = magnitude >= 5 ? .13 : magnitude >= 2.5 ? .075 : .035;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .28);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .3);
    } catch {
      // Sin audio no se interrumpe la actualización científica.
    }
  }, delayMs);
}
