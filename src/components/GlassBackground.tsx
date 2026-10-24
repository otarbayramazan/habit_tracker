import { useMemo } from 'react';
import { useHabits } from '@/context/HabitsContext';

const FALLBACK = ['#0a84ff', '#8a2cff', '#ff2d9b', '#00c4a0'];

// Расположение пятен: размер и позиция в процентах экрана
const SPOTS = [
  // Верхние пятна: видны в обеих темах (в тёмной — тусклое свечение за заголовком)
  { size: 60, top: -32, left: -22, delay: 0, top_: true },
  { size: 55, top: -30, left: 48, delay: -8, top_: true },
  // Нижние пятна: только в светлой теме (в тёмной фон остаётся чистым OLED-чёрным)
  { size: 65, top: 50, left: -15, delay: -14, top_: false },
  { size: 55, top: 80, left: 50, delay: -20, top_: false },
];

/** Фиксированный фон за всем интерфейсом: размытые пятна цветов привычек, видные сквозь стекло. */
export function GlassBackground() {
  const { habits } = useHabits();

  const colors = useMemo(() => {
    const own = [...new Set(habits.map((h) => h.color))];
    return SPOTS.map((_, i) => own[i % (own.length || 1)] ?? FALLBACK[i]);
  }, [habits]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {SPOTS.map((s, i) => (
        <div
          key={i}
          className={`blob ${s.top_ ? 'blob-top' : 'blob-bottom'}`}
          style={{
            width: `${s.size}vmax`,
            height: `${s.size}vmax`,
            top: `${s.top}%`,
            left: `${s.left}%`,
            backgroundColor: colors[i],
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
