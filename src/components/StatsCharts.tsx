import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Check } from 'lucide-react';
import type { HabitWithCompletions } from '@/lib/supabase';
import type { TranslationKey } from '@/lib/i18n';
import {
  addDays,
  startOfWeek,
  isScheduledOn,
  isCompletedOn,
  habitStartDate,
  rateInRange,
} from '@/lib/dateUtils';

type T = (key: TranslationKey) => string;

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] glass p-4 mb-5">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-fg font-semibold text-sm">{title}</h3>
        {subtitle && <span className="text-muted text-[11px] truncate">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

// ── 3. Общая статистика: сравнение всех привычек за 30 дней ──
export function HabitsComparison({
  habits,
  t,
}: {
  habits: HabitWithCompletions[];
  t: T;
}) {
  const rows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = addDays(today, -29);
    return habits
      .map((h) => {
        const start = habitStartDate(h.created_at, h.completions);
        const { done, scheduled } = rateInRange(
          h.completions,
          h.target_count,
          h.frequency_type ?? 'everyday',
          h.frequency_days ?? [],
          start,
          from,
          today
        );
        return { h, rate: scheduled === 0 ? null : Math.round((done / scheduled) * 100) };
      })
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [habits]);

  return (
    <ChartCard title={t('compareHabits')} subtitle={t('last30Days')}>
      <div className="space-y-3">
        {rows.map(({ h, rate }) => (
          <div key={h.id} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: `${h.color}1f` }}
            >
              {h.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-fg text-xs font-medium truncate">{h.title}</span>
                <span className="text-xs font-bold shrink-0" style={{ color: rate === null ? undefined : h.color }}>
                  {rate === null ? '—' : `${rate}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-elev overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${rate ?? 0}%`, backgroundColor: h.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

/**
 * Процент за последние 30 дней по всем привычкам вместе:
 * все выполненные дни / все запланированные дни (так же считает кольцо внизу).
 */
export function averageRate30(habits: HabitWithCompletions[]): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = addDays(today, -29);
  let done = 0;
  let scheduled = 0;
  for (const h of habits) {
    const r = rateInRange(
      h.completions,
      h.target_count,
      h.frequency_type ?? 'everyday',
      h.frequency_days ?? [],
      habitStartDate(h.created_at, h.completions),
      from,
      today
    );
    done += r.done;
    scheduled += r.scheduled;
  }
  return scheduled === 0 ? null : Math.round((done / scheduled) * 100);
}

// ── Эта неделя против прошлой ──
// Процент за прошедшие дни текущей недели и разница с прошлой неделей.
export function WeekComparison({ habit, t }: { habit: HabitWithCompletions; t: T }) {
  const { cur, prev, perfect } = useMemo(() => {
    const start = habitStartDate(habit.created_at, habit.completions);
    const freqType = habit.frequency_type ?? 'everyday';
    const freqDays = habit.frequency_days ?? [];
    const ws = startOfWeek(new Date());
    const rate = (from: Date) => {
      const { done, scheduled } = rateInRange(
        habit.completions,
        habit.target_count,
        freqType,
        freqDays,
        start,
        from,
        addDays(from, 6)
      );
      return scheduled === 0 ? null : Math.round((done / scheduled) * 100);
    };
    // Сколько недель подряд (включая текущую) выполнено на 100%
    let perfect = 0;
    for (let w = 0; w < 104; w++) {
      if (rate(addDays(ws, -7 * w)) !== 100) break;
      perfect++;
    }
    return { cur: rate(ws), prev: rate(addDays(ws, -7)), perfect };
  }, [habit]);

  if (cur === null) return null;
  const delta = prev === null ? null : cur - prev;

  return (
    <div className="rounded-[26px] glass p-4 mb-5 flex items-center justify-between gap-3">
      <div>
        <p className="text-muted text-[11px]">{t('thisWeekSoFar')}</p>
        <p className="text-fg text-2xl font-bold leading-tight">{cur}%</p>
      </div>
      {perfect >= 2 ? (
        // Две и больше идеальных недель подряд — поощряем, а не пишем «как на прошлой»
        <div className="flex items-center gap-1.5 text-xs font-semibold text-right" style={{ color: habit.color }}>
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 animate-pop"
            style={{ backgroundColor: habit.color }}
          >
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
          </span>
          <span>{t('perfectWeeks').replace('{n}', String(perfect))}</span>
        </div>
      ) : delta !== null && (
        <div
          className="flex items-center gap-1.5 text-xs font-semibold text-right"
          style={{ color: delta > 0 ? '#34c759' : delta < 0 ? '#ff453a' : 'rgb(var(--c-sub))' }}
        >
          {delta > 0 ? (
            <TrendingUp className="w-4 h-4 shrink-0" />
          ) : delta < 0 ? (
            <TrendingDown className="w-4 h-4 shrink-0" />
          ) : (
            <Minus className="w-4 h-4 shrink-0" />
          )}
          <span>
            {delta === 0
              ? t('sameAsLast')
              : (delta > 0 ? t('betterThanLast') : t('worseThanLast')).replace('{n}', String(Math.abs(delta)))}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Общий итог за 30 дней: кольца активности ──
// У каждой привычки своё кольцо, заполненное на её процент выполнения за 30 дней.
// Бледный след — сколько осталось до 100%. В центре — общий процент (все выполненные дни / все запланированные).
// Колец не больше 4: если привычек больше, три лучшие получают свои кольца,
// а все остальные объединяются в одно серое кольцо «Остальные (N)».
const MAX_RINGS = 4;
const OTHERS_COLOR = '#8e8e93';

type Ring = { key: string; title: string; color: string; rate: number; others?: number };

export function AllTimeRing({ habits, t }: { habits: HabitWithCompletions[]; t: T }) {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = addDays(today, -29);
    const rows = habits
      .map((h) => {
        const { done, scheduled } = rateInRange(
          h.completions,
          h.target_count,
          h.frequency_type ?? 'everyday',
          h.frequency_days ?? [],
          habitStartDate(h.created_at, h.completions),
          from,
          today
        );
        return { h, done, scheduled, rate: scheduled === 0 ? null : done / scheduled };
      })
      .filter((r): r is typeof r & { rate: number } => r.rate !== null)
      .sort((a, b) => b.rate - a.rate);
    const done = rows.reduce((a, r) => a + r.done, 0);
    const scheduled = rows.reduce((a, r) => a + r.scheduled, 0);
    return { rows, overall: scheduled === 0 ? null : Math.round((done / scheduled) * 100) };
  }, [habits]);

  if (data.overall === null) return null;

  let shown: Ring[];
  if (data.rows.length <= MAX_RINGS) {
    shown = data.rows.map(({ h, rate }) => ({ key: h.id, title: h.title, color: h.color, rate }));
  } else {
    const top = data.rows.slice(0, MAX_RINGS - 1);
    const rest = data.rows.slice(MAX_RINGS - 1);
    const restDone = rest.reduce((a, r) => a + r.done, 0);
    const restScheduled = rest.reduce((a, r) => a + r.scheduled, 0);
    shown = [
      ...top.map(({ h, rate }) => ({ key: h.id, title: h.title, color: h.color, rate })),
      {
        key: 'others',
        title: t('othersHabits').replace('{n}', String(rest.length)),
        color: OTHERS_COLOR,
        rate: restScheduled === 0 ? 0 : restDone / restScheduled,
        others: rest.length,
      },
    ];
  }
  const size = 148;
  const stroke = shown.length > 3 ? 10 : 12;
  const spacing = 3;

  return (
    <div className="rounded-[26px] glass p-5 mb-5">
      <div className="flex items-baseline justify-between mb-4 gap-2">
        <h3 className="text-fg font-semibold text-sm">{t('overallRing')}</h3>
        <span className="text-muted text-[11px]">{t('last30Days')}</span>
      </div>

      {/* Кольца слева, легенда справа */}
      <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {shown.map(({ key, color, rate }, i) => {
            const r = size / 2 - stroke / 2 - i * (stroke + spacing);
            const c = 2 * Math.PI * r;
            return (
              <g key={key}>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.18}
                  strokeWidth={stroke}
                />
                {rate > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${c * Math.min(rate, 1)} ${c}`}
                    style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-fg font-bold leading-none ${shown.length > 3 ? 'text-lg' : 'text-2xl'}`}>
            {data.overall}%
          </span>
        </div>
      </div>

      {/* Легенда столбиком: в том же порядке, что кольца (снаружи → внутрь) */}
      <div className="flex-1 min-w-0 space-y-2.5">
        {shown.map(({ key, title, color, rate }) => (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-fg2 text-xs truncate">{title}</span>
            </div>
            <p className="text-sm font-bold leading-tight pl-3.5" style={{ color }}>
              {Math.round(rate * 100)}%
            </p>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

/**
 * Идеальные дни за последние 30 дней: в такой день была запланирована хотя бы одна привычка,
 * и все запланированные привычки выполнены. Сегодня считается, только если уже всё сделано.
 */
export function perfectDays30(habits: HabitWithCompletions[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const starts = habits.map((h) => habitStartDate(h.created_at, h.completions));
  let count = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    let scheduled = 0;
    let allDone = true;
    habits.forEach((h, idx) => {
      if (d < starts[idx]) return;
      const type = h.frequency_type ?? 'everyday';
      const days = h.frequency_days ?? [];
      if (!isScheduledOn(d, type, days)) return;
      scheduled++;
      if (!isCompletedOn(d, h.completions, h.target_count, type, days)) allDone = false;
    });
    if (scheduled > 0 && allDone) count++;
  }
  return count;
}
