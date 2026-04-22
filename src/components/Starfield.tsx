import { useEffect, useRef } from "react";

type Comet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  ttl: number;
  hue: number;
};
type Star = { x: number; y: number; r: number; alpha: number; twinkle: number };

// Animated starfield + comets. Draws to a canvas pinned behind the UI.
// Falls back gracefully if the tab isn't visible (pauses to save CPU).
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];
    let comets: Comet[] = [];
    let lastComet = performance.now();
    let running = true;

    const rebuild = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = window.innerWidth * window.innerHeight;
      const density = Math.min(220, Math.floor(area / 6500));
      stars = Array.from({ length: density }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.6 + 0.2,
        twinkle: Math.random() * 0.02 + 0.005,
      }));
    };

    const spawnComet = () => {
      const startSide = Math.random();
      const y = Math.random() * window.innerHeight * 0.5;
      const speed = 360 + Math.random() * 320;
      const angle = Math.PI / 5 + Math.random() * 0.2; // 36° down-right-ish
      comets.push({
        x: startSide < 0.5 ? -80 : window.innerWidth + 80,
        y,
        vx: (startSide < 0.5 ? 1 : -1) * Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 120 + Math.random() * 120,
        life: 0,
        ttl: 2.0 + Math.random() * 1.0,
        hue: 200 + Math.random() * 60, // cyan/violet range
      });
    };

    const draw = (t: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - (draw as unknown as { last?: number }).last!) / 1000 || 0.016);
      (draw as unknown as { last?: number }).last = t;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // stars
      for (const s of stars) {
        s.alpha += (Math.random() - 0.5) * s.twinkle;
        if (s.alpha < 0.1) s.alpha = 0.1;
        if (s.alpha > 0.95) s.alpha = 0.95;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${s.alpha})`;
        ctx.fill();
      }

      // comets
      const now = performance.now();
      if (now - lastComet > 3200 + Math.random() * 2600 && comets.length < 3) {
        spawnComet();
        lastComet = now;
      }

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.life += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const fade = Math.min(1, c.life / 0.3) * Math.max(0, 1 - c.life / c.ttl);
        const tailX = c.x - (c.vx / 360) * c.length;
        const tailY = c.y - (c.vy / 360) * c.length;
        const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        grad.addColorStop(0, `hsla(${c.hue}, 90%, 80%, ${0.9 * fade})`);
        grad.addColorStop(0.4, `hsla(${c.hue + 20}, 90%, 70%, ${0.45 * fade})`);
        grad.addColorStop(1, `hsla(${c.hue + 40}, 90%, 60%, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        // bright head
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${c.hue}, 100%, 92%, ${fade})`;
        ctx.fill();

        if (
          c.life > c.ttl ||
          c.x < -200 || c.x > window.innerWidth + 200 ||
          c.y > window.innerHeight + 200
        ) {
          comets.splice(i, 1);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    const onResize = () => rebuild();
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        (draw as unknown as { last?: number }).last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };

    rebuild();
    (draw as unknown as { last?: number }).last = performance.now();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}

