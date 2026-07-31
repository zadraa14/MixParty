"use client";

import { useEffect, useRef } from "react";

type Glow = {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  phase: number;
  speed: number;
};

const GLOWS: Glow[] = [
  { x: 0.12, y: 0.12, radius: 0.62, color: [139, 92, 246], phase: 0, speed: 0.00018 },
  { x: 0.88, y: 0.3, radius: 0.56, color: [236, 72, 153], phase: 2.1, speed: 0.00015 },
  { x: 0.48, y: 0.92, radius: 0.5, color: [251, 146, 60], phase: 4.2, speed: 0.00013 },
];

export default function MixPartyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#070711";
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalCompositeOperation = "screen";

      GLOWS.forEach((glow, index) => {
        const elapsed = reduceMotion ? 0 : time;
        const x = glow.x * width + Math.sin(elapsed * glow.speed + glow.phase) * width * 0.14;
        const y = glow.y * height + Math.cos(elapsed * glow.speed * 0.82 + glow.phase) * height * 0.11;
        const pulse = 1 + Math.sin(elapsed * glow.speed * 0.68 + glow.phase) * 0.1;
        const radius = Math.max(width, height) * glow.radius * pulse;
        const [r, g, b] = glow.color;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${index === 2 ? 0.18 : 0.24})`);
        gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.11)`);
        gradient.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, 0.025)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      });

      context.restore();

      context.save();
      context.strokeStyle = "rgba(255,255,255,0.025)";
      context.lineWidth = 1;
      const step = 48;

      for (let x = 0; x <= width; x += step) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      for (let y = 0; y <= height; y += step) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();

      const vignette = context.createRadialGradient(
        width / 2,
        height * 0.38,
        Math.min(width, height) * 0.12,
        width / 2,
        height * 0.45,
        Math.max(width, height) * 0.76,
      );
      vignette.addColorStop(0, "rgba(7,7,17,0)");
      vignette.addColorStop(0.62, "rgba(7,7,17,0.08)");
      vignette.addColorStop(1, "rgba(2,2,8,0.72)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    resize();
    draw(0);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
    />
  );
}
