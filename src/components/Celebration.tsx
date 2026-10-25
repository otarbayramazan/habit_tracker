import { useEffect, useRef } from 'react';

/**
 * Конфетти-«хлопушки»: из двух нижних углов экрана вылетают вверх и к центру,
 * затем медленно опадают, кружась как бумажки. Цвета — цвета привычек.
 * Анимируется только transform/opacity (силами видеокарты), поэтому не тормозит даже на простых телефонах.
 */
export const CELEBRATION_MS = 3400;

export function Celebration({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const palette = colors.length > 0 ? colors : ['#ff5a00', '#ffcc00', '#0a84ff', '#ff2d9b'];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const perSide = reduced ? 12 : 70;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const STEPS = 36;
    const animations: Animation[] = [];

    for (let side = 0; side < 2; side++) {
      const dirX = side === 0 ? 1 : -1;
      for (let i = 0; i < perSide; i++) {
        const el = document.createElement('span');
        const w = 7 + Math.random() * 6;
        const round = Math.random() < 0.3;
        el.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${round ? w : w * 0.45}px;border-radius:${round ? '50%' : '2px'};background:${palette[(i + side) % palette.length]};will-change:transform,opacity;`;
        host.appendChild(el);

        // Простая физика: выстрел под углом, сопротивление воздуха и гравитация
        const speed = H * (3.2 + Math.random() * 1.6);
        const angle = ((55 + Math.random() * 23) * Math.PI) / 180;
        const g = H * 1.5;
        const k = 3.6 + Math.random() * 0.9;
        let vx = speed * Math.cos(angle) * dirX * (W < 500 ? 0.8 : 1.2);
        let vy = -speed * Math.sin(angle);
        let x = side === 0 ? -10 : W + 10;
        let y = H * 0.96;
        const duration = 2600 + Math.random() * 700;
        const dt = duration / 1000 / STEPS;
        const spin = (Math.random() * 2 - 1) * 900; // градусов в секунду
        const flutter = 6 + Math.random() * 6; // как быстро «переворачивается» бумажка
        const frames: Keyframe[] = [];
        for (let s = 0; s <= STEPS; s++) {
          const t = s * dt;
          const flip = Math.cos(t * flutter);
          frames.push({
            transform: `translate3d(${x}px, ${y}px, 0) rotate(${spin * t}deg) scaleY(${flip.toFixed(3)})`,
            opacity: s > STEPS * 0.8 ? 1 - (s - STEPS * 0.8) / (STEPS * 0.2) : 1,
          });
          for (let sub = 0; sub < 4; sub++) {
            const h = dt / 4;
            vy += g * h;
            const damp = Math.exp(-k * h);
            vx *= damp;
            vy *= damp;
            x += vx * h + Math.sin((t + sub * h) * 3 + i) * 0.6; // лёгкое покачивание
            y += vy * h;
          }
        }
        el.style.transform = frames[0].transform as string; // старт сразу за краем, ещё до первого кадра
        const anim = el.animate(frames, {
          duration,
          delay: Math.random() * 180,
          easing: 'linear',
          fill: 'forwards',
        });
        animations.push(anim);
      }
    }

    return () => {
      animations.forEach((a) => a.cancel());
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="fixed inset-0 z-[70] pointer-events-none overflow-hidden" aria-hidden="true" />;
}
