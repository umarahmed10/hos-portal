"use client";
// Premium confetti — bone/bronze/sage palette, restrained particle count.
// Fires once on mount, self-destroys after 3000ms.
import { useEffect, useRef } from "react";

type Shape = "rect" | "circle";

interface Particle {
  x:     number;
  y:     number;
  vx:    number;
  vy:    number;
  color: string;
  shape: Shape;
  rot:   number;
  rotV:  number;
  born:  number;
}

const COLORS = [
  "#F3F1EC",            // bone white
  "#8B6B3E",            // bronze
  "#4EAD87",            // sage green
  "rgba(243,241,236,0.4)", // ghost
];

const COUNT          = 80;
const GRAVITY        = 0.3;
const AIR_RESISTANCE = 0.98;
const DURATION       = 2800;
const FADE_START     = 1800;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function spawn(W: number, H: number, now: number): Particle[] {
  const cx = W / 2;
  const cy = H * 0.08;
  return Array.from({ length: COUNT }, () => ({
    x:     cx + rand(-70, 70),
    y:     cy,
    vx:    rand(-12, 12),
    vy:    rand(-32, -20),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() < 0.55 ? "rect" : "circle",
    rot:   rand(0, Math.PI * 2),
    rotV:  rand(-0.2, 0.2),
    born:  now,
  }));
}

function draw(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = p.color;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-1.5, -4, 3, 8);
  }
  ctx.restore();
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

    const ctx   = canvas.getContext("2d")!;
    const start = performance.now();
    const particles = spawn(W, H, start);

    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);

      let alpha = 1;
      if (elapsed > FADE_START) {
        alpha = Math.max(0, 1 - (elapsed - FADE_START) / (DURATION - FADE_START));
      }

      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += GRAVITY;
        p.vx  *= AIR_RESISTANCE;
        p.vy  *= AIR_RESISTANCE;
        p.rot += p.rotV;
        draw(ctx, p, alpha);
      }

      if (elapsed < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    }

    raf = requestAnimationFrame(tick);
    const destroy = setTimeout(() => cancelAnimationFrame(raf), 3000);

    return () => {
      clearTimeout(destroy);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:         0,
        pointerEvents: "none",
        zIndex:        50,
      }}
    />
  );
}
