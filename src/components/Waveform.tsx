import { useEffect, useRef } from 'react';

interface WaveformProps {
  seed: string;
  active?: boolean;
  minFrequency: number;
  maxFrequency: number;
  timeWindowSeconds: number;
  gain: number;
}

function deterministicNoise(value: number, seed: number) {
  const raw = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
  return (raw - Math.floor(raw)) * 2 - 1;
}

export function Waveform({ seed, active = true, minFrequency, maxFrequency, timeWindowSeconds, gain }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const seedValue = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    let animation = 0;
    let frame = 0;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const style = getComputedStyle(canvas);
      const trace = style.getPropertyValue('--accent').trim() || '#53d6c7';
      const text = style.getPropertyValue('--text-soft').trim() || '#9bb0ae';
      const line = style.getPropertyValue('--line').trim() || 'rgba(151,204,199,.2)';
      const left = 48;
      const right = 9;
      const top = 10;
      const bottom = 25;
      const plotWidth = Math.max(1, width - left - right);
      const plotHeight = Math.max(1, height - top - bottom);
      const centerY = top + plotHeight / 2;

      context.font = '7px "IBM Plex Mono", monospace';
      context.fillStyle = text;
      context.strokeStyle = line;
      context.lineWidth = 1;
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      for (let index = 0; index <= 4; index += 1) {
        const y = top + plotHeight * index / 4;
        const value = Math.round((1 - index / 2) * 1000 / gain);
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillText(value.toLocaleString('es-ES'), left - 6, y);
      }

      context.textAlign = 'center';
      context.textBaseline = 'top';
      for (let index = 0; index <= 6; index += 1) {
        const x = left + plotWidth * index / 6;
        const seconds = -timeWindowSeconds + timeWindowSeconds * index / 6;
        context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + plotHeight); context.stroke();
        context.fillText(index === 6 ? 'AHORA' : `${Math.round(seconds)} s`, x, top + plotHeight + 7);
      }

      context.save();
      context.translate(9, centerY);
      context.rotate(-Math.PI / 2);
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillText('AMPLITUD · COUNTS', 0, 0);
      context.restore();

      const frequencies = [0.18, 0.32, 0.55, 0.9, 1.35, 2.1, 3.4, 5.2, 7.6, 9.4];
      const secondsPerPixel = timeWindowSeconds / plotWidth;
      context.save();
      context.beginPath(); context.rect(left, top, plotWidth, plotHeight); context.clip();
      context.strokeStyle = active ? trace : text;
      context.lineWidth = 1.05;
      context.beginPath();
      for (let pixel = 0; pixel <= plotWidth; pixel += 1) {
        const time = (pixel + frame * .42) * secondsPerPixel;
        let signal = 0;
        let normalization = 0;
        for (let index = 0; index < frequencies.length; index += 1) {
          const frequency = frequencies[index];
          if (frequency < minFrequency || frequency > maxFrequency) continue;
          const amplitude = 1 / Math.sqrt(1 + frequency * 1.4);
          signal += Math.sin(Math.PI * 2 * frequency * time + seedValue * (index + 1) * .013) * amplitude;
          normalization += amplitude;
        }
        if (normalization) signal /= normalization;
        const noiseFrequency = Math.max(minFrequency, Math.min(maxFrequency, 6.5));
        signal += deterministicNoise(time * noiseFrequency * 2.7, seedValue) * .22;
        const pulsePosition = ((time + seedValue * .17) % 47 + 47) % 47;
        const pulseEnvelope = Math.exp(-Math.pow((pulsePosition - 19) / 2.7, 2));
        signal += pulseEnvelope * (Math.sin(time * Math.PI * 7.4) * .65 + deterministicNoise(time * 11, seedValue + 19) * .28);
        const y = centerY - Math.max(-1, Math.min(1, signal * gain)) * plotHeight * .43;
        const x = left + pixel;
        if (pixel === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      context.restore();

      context.strokeStyle = line;
      context.strokeRect(left, top, plotWidth, plotHeight);
      if (active) frame += 1;
      animation = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animation);
  }, [active, gain, maxFrequency, minFrequency, seed, timeWindowSeconds]);

  return <canvas ref={canvasRef} className="waveform" role="img" aria-label={`Sismograma sintético de ${timeWindowSeconds} segundos, banda de ${minFrequency.toFixed(1)} a ${maxFrequency.toFixed(1)} hercios`} />;
}
