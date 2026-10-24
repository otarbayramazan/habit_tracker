import { Check } from 'lucide-react';

type Props = {
  emoji: string;
  color: string;
  count: number; // сколько отметок сегодня
  target: number; // сколько нужно за день
  size: number; // диаметр в пикселях
};

/**
 * Иконка привычки с кольцом прогресса за сегодня.
 * - Цель 1 раз: сплошное кольцо, бледное до отметки и цветное после.
 * - Цель N раз: N отрезков с промежутками, загораются по одному.
 * Когда цель выполнена, в углу появляется маленькая галочка.
 */
export function ProgressRing({ emoji, color, count, target, size }: Props) {
  const stroke = size >= 40 ? 2.5 : 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segments = Math.max(1, target);
  const done = Math.min(count, segments);
  const complete = count >= target;

  // Промежуток между отрезками (в длине окружности); для одного отрезка промежутка нет.
  const gap = segments > 1 ? Math.min(c * 0.05, (c / segments) * 0.35) : 0;
  const seg = c / segments - gap;

  const inner = size - stroke * 2 - 6; // круглая подложка с эмодзи внутри кольца
  const badge = Math.round(size * 0.38);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => {
          const lit = i < done;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap={segments > 1 ? 'round' : 'butt'}
              strokeDasharray={`${seg} ${c - seg}`}
              strokeDashoffset={-(i * (seg + gap)) - gap / 2}
              style={{
                stroke: lit ? color : 'rgb(var(--c-line2))',
                transition: 'stroke 0.35s ease',
              }}
            />
          );
        })}
      </svg>

      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          inset: (size - inner) / 2,
          backgroundColor: `${color}${complete ? '2e' : '1a'}`,
          fontSize: Math.round(inner * 0.55),
          transition: 'background-color 0.35s ease',
        }}
      >
        <span className="leading-none">{emoji}</span>
      </div>

      {complete && (
        <div
          className="absolute rounded-full flex items-center justify-center animate-pop ring-2 ring-card"
          style={{
            width: badge,
            height: badge,
            right: -2,
            bottom: -2,
            backgroundColor: color,
          }}
        >
          <Check className="text-white" style={{ width: badge * 0.65, height: badge * 0.65 }} strokeWidth={3.5} />
        </div>
      )}
    </div>
  );
}
