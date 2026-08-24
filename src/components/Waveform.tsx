import { useEffect, useRef } from 'react';

export function Waveform({ seed, active = true }: { seed: string; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    let frame = 0;
    let animation = 0;
    const seedValue = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(83,214,199,.12)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 36) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
      context.strokeStyle = active ? '#53d6c7' : '#78908f';
      context.lineWidth = 1.35;
      context.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const t = x + frame * 0.8 + seedValue;
        const envelope = 0.16 + Math.pow(Math.sin(t * 0.007), 8) * 0.8;
        const signal = Math.sin(t * 0.12) * 0.42 + Math.sin(t * 0.037) * 0.34 + Math.sin(t * 0.61) * 0.09;
        const y = height / 2 + signal * envelope * height * 0.42;
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      frame += 1;
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animation);
  }, [active, seed]);

  return <canvas ref={canvasRef} className="waveform" role="img" aria-label="Vista previa sintética de forma de onda" />;
}
