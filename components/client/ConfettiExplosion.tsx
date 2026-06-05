"use client";
// Lightweight pure-canvas confetti — zero external dependencies.
// Runs once on mount, cleans up automatically.
import { useEffect, useRef } from "react";

interface Particle {
  x:    number;
  y:    number;
  vx:   number;
  vy:   number;
  color: string;
  size: number;
  rot:  number;
  rotV: number;
  life: number;
}

const COLORS = [
  "#f5f0eb", "#22c55e", "#eab308",
  "#a78bfa", "#60a5fa", "#f472b6",
];

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function ConfettiExplosion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d")!;
    const particles: Particle[] = [];

    // Spawn 120 particles from the top-center
    for (let i = 0; i < 120; i++) {
      particles.push({
        x:    W * randBetween(0.3, 0.7),
        y:    H * 0.2,
        vx:   randBetween(-8, 8),
        vy:   randBetween(-14, -4),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: randBetween(5, 10),
        rot:  randBetween(0, Math.PI * 2),
        rotV: randBetween(-0.2, 0.2),
        life: 1,
      });
    }

    let raf: number;
    let lastTime = performance.now();

    function draw(now: number) {
      const dt = Math.min((now - lastTime) / 16, 3); // cap at 3x speed
      lastTime = now;

      ctx.clearRect(0, 0, W, H);

      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;

        p.x   += p.vx * dt;
        p.y   += p.vy * dt;
        p.vy  += 0.35 * dt;  // gravity
        p.rot += p.rotV * dt;
        p.life -= 0.012 * dt;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (alive) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:         0,
        pointerEvents: "none",
        zIndex:        9999,
      }}
    />
  );
}
