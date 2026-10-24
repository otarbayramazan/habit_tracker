import type { HabitWithCompletions } from '@/lib/supabase';

/**
 * Иконка «Все привычки»: квадрат 2×2 из клеток цветов первых четырёх привычек
 * (в стиле клеток календаря). Если привычек меньше четырёх, оставшиеся клетки серые.
 */
export function HabitsGridIcon({ habits, size = 36 }: { habits: HabitWithCompletions[]; size?: number }) {
  const colors = [...new Set(habits.map((h) => h.color))].slice(0, 4);
  const cell = Math.round(size * 0.28);
  const gap = Math.max(2, Math.round(size * 0.08));

  return (
    <div
      className="rounded-xl bg-elev flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="grid grid-cols-2" style={{ gap }}>
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className="cell-r"
            style={{
              width: cell,
              height: cell,
              backgroundColor: colors[i] ?? 'rgb(var(--c-line2))',
            }}
          />
        ))}
      </div>
    </div>
  );
}
