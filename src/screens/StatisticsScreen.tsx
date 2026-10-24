import { useState, useMemo } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useSettings } from '@/context/SettingsContext';
import { formatMonthShort, useT } from '@/lib/i18n';
import { ChevronDown, Check, Flame, Trophy, CalendarCheck, Percent, BarChart3, LayoutGrid, CircleCheck, Sparkles } from 'lucide-react';
import { WeekComparison, HabitsComparison, AllTimeRing, perfectDays30 } from '@/components/StatsCharts';
import { isCompletedOn } from '@/lib/dateUtils';
import {
  formatDate,
  addDays,
  startOfWeek,
  parseDate,
  countCompletedDays,
  completionRate,
  calculateFrequencyStreak,
  calculateBestFrequencyStreak,
  isScheduledOn,
  getForgivenDates,
  getMonthlyCounts,
} from '@/lib/dateUtils';
import type { HabitWithCompletions, FrequencyType } from '@/lib/supabase';
import type { Language } from '@/context/SettingsContext';

const ALL = '__all__';

export function StatisticsScreen() {
  const { habits, loading } = useHabits();
  const { language } = useSettings();
  const t = useT(language as Language);
  // По умолчанию открыта общая статистика по всем привычкам
  const [selectedId, setSelectedId] = useState<string>(ALL);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAll = selectedId === ALL;
  const selectedHabit = useMemo<HabitWithCompletions | null>(() => {
    if (habits.length === 0) return null;
    return habits.find((h) => h.id === selectedId) ?? habits[0];
  }, [habits, selectedId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-line2 border-t-sub rounded-full animate-spin" />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-faint" />
        </div>
        <h3 className="text-fg font-semibold text-base">{t('noHabits')}</h3>
        <p className="text-muted text-sm mt-1 max-w-xs">{t('noHabitsDesc')}</p>
      </div>
    );
  }

  const color = selectedHabit?.color ?? '#4f46e5';
  const completions = selectedHabit?.completions ?? {};
  const target = selectedHabit?.target_count ?? 1;
  const year = new Date().getFullYear();

  const completed = countCompletedDays(completions, target);
  const freqType: FrequencyType = selectedHabit?.frequency_type ?? 'everyday';
  const freqDays: number[] = selectedHabit?.frequency_days ?? [];
  const rate = completionRate(
    completions,
    target,
    selectedHabit?.created_at ?? formatDate(new Date()),
    freqType,
    freqDays
  );
  const monthlyCounts = getMonthlyCounts(completions, target, year);
  const monthLabels = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'), t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];
  const currentStreak = calculateFrequencyStreak(completions, target, freqType, freqDays);
  const bestStreak = calculateBestFrequencyStreak(completions, target, freqType, freqDays);


  return (
    <div className="px-4 pt-6 pb-32 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-5">{t('statistics')}</h1>

      {/* Habit selector dropdown */}
      <div className="relative mb-5">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full glass rounded-2xl px-4 py-3.5 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            {isAll ? (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-elev shrink-0">
                <LayoutGrid className="w-[18px] h-[18px] text-fg2" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `${color}1a` }}
              >
                {selectedHabit?.emoji}
              </div>
            )}
            <span className="text-fg font-medium text-sm truncate">
              {isAll ? t('allHabits') : selectedHabit?.title}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute z-30 top-full mt-1 w-full glass-strong rounded-2xl py-1 max-h-72 overflow-y-auto">
            <button
              onClick={() => {
                setSelectedId(ALL);
                setDropdownOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-elev2 transition-colors border-b border-line"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-elev">
                  <LayoutGrid className="w-4 h-4 text-fg2" />
                </div>
                <span className="text-fg text-sm font-semibold">{t('allHabits')}</span>
              </div>
              {isAll && <Check className="w-4 h-4 text-fg" />}
            </button>
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setSelectedId(h.id);
                  setDropdownOpen(false);
                }}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-elev2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style={{ backgroundColor: `${h.color}1a` }}
                  >
                    {h.emoji}
                  </div>
                  <span className="text-fg text-sm font-medium">{h.title}</span>
                </div>
                {!isAll && h.id === (selectedHabit?.id ?? '') && <Check className="w-4 h-4 text-fg" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAll ? (
        <OverallStats habits={habits} t={t} />
      ) : (
        <>
      {/* Year heatmap */}
      <YearHeatmap
        completions={completions}
        target={target}
        color={color}
        year={year}
        frequencyType={freqType}
        frequencyDays={freqDays}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 mt-5">
        <MetricCard
          icon={<CalendarCheck className="w-4 h-4" />}
          value={completed}
          label={t('completedDays')}
          color={color}
        />
        <MetricCard
          icon={<Percent className="w-4 h-4" />}
          value={`${rate}%`}
          label={t('completionRate')}
          color={color}
        />
        <MetricCard
          icon={<Flame className="w-4 h-4" />}
          value={currentStreak}
          label={t('currentStreak')}
          color={color}
        />
        <MetricCard
          icon={<Trophy className="w-4 h-4" />}
          value={bestStreak}
          label={t('bestStreak')}
          color={color}
        />
      </div>

      {/* Эта неделя против прошлой */}
      {selectedHabit && <WeekComparison habit={selectedHabit} t={t} />}

      {/* График по месяцам (как раньше) */}
      <MonthlyLineChart data={monthlyCounts} labels={monthLabels} color={color} />
        </>
      )}
    </div>
  );
}

// ── Общая статистика: две цифры и сравнение привычек ──
function OverallStats({
  habits,
  t,
}: {
  habits: HabitWithCompletions[];
  t: ReturnType<typeof useT>;
}) {
  const now = new Date();
  const todays = habits.filter((h) => isScheduledOn(now, h.frequency_type ?? 'everyday', h.frequency_days ?? []));
  const doneToday = todays.filter((h) =>
    isCompletedOn(now, h.completions, h.target_count, h.frequency_type ?? 'everyday', h.frequency_days ?? [])
  ).length;
  const perfect = perfectDays30(habits);
  const neutral = '#8e8e93';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard
          icon={<Sparkles className="w-4 h-4" />}
          value={perfect}
          label={`${t('perfectDays')} · ${t('last30Days').toLowerCase()}`}
          color={neutral}
        />
        <MetricCard
          icon={<CircleCheck className="w-4 h-4" />}
          value={`${doneToday}/${todays.length}`}
          label={t('todayDone')}
          color={neutral}
        />
      </div>
      <HabitsComparison habits={habits} t={t} />
      <AllTimeRing habits={habits} t={t} />
    </>
  );
}

function MetricCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div
      className="rounded-[26px] glass p-4 transition-colors"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-fg">{value}</p>
      <p className="text-muted text-xs mt-1">{label}</p>
    </div>
  );
}

function YearHeatmap({
  completions,
  target,
  color,
  year,
  frequencyType,
  frequencyDays,
}: {
  completions: Record<string, number>;
  target: number;
  color: string;
  year: number;
  frequencyType: FrequencyType;
  frequencyDays: number[];
}) {
  const { language } = useSettings();
  const t = useT(language as Language);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDate(today);
  const forgiven = useMemo(
    () => getForgivenDates(completions, target, frequencyType, frequencyDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completions, target, frequencyType, JSON.stringify(frequencyDays)]
  );
  const dayLabels = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')];

  // Последние полгода: 26 недель, заканчивая текущей неделей (сегодня — в последней колонке).
  const WEEKS = 26;
  const gridStart = addDays(startOfWeek(today), -(WEEKS - 1) * 7);
  // Подпись месяца ставим над колонкой, в которой месяц начинается (и над первой колонкой).
  const monthCols: { col: number; label: string }[] = [];
  for (let col = 0; col < WEEKS; col++) {
    const weekStart = addDays(gridStart, col * 7);
    const weekEnd = addDays(weekStart, 6);
    let first: Date | null = null;
    if (weekEnd.getDate() <= 7) {
      // В этой неделе начинается новый месяц
      first = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), 1);
    } else if (col === 0 && weekStart.getDate() <= 21) {
      // Первая колонка: подписываем текущий месяц, если до следующего ещё далеко
      first = weekStart;
    }
    if (!first) continue;
    monthCols.push({
      col,
      label: formatMonthShort(language, first),
    });
  }

  const cellStyle = (d: Date): React.CSSProperties | null => {
    const key = formatDate(d);
    const count = completions[key] ?? 0;
    const future = d > today;
    if (count >= target) return { backgroundColor: color };
    if (count > 0) return { backgroundColor: `${color}66` };
    if (!isScheduledOn(d, frequencyType, frequencyDays)) return null; // день отдыха
    if (forgiven.has(key)) return { backgroundColor: `${color}33` };
    return {
      backgroundColor: 'rgb(var(--c-elev))',
      opacity: future ? 0.45 : 1,
    };
  };

  return (
    <div className="rounded-[26px] glass p-4">
      <div className="flex gap-1.5">
        {/* Подписи дней недели */}
        <div className="flex flex-col gap-[3px] pt-[18px] shrink-0 w-5">
          {dayLabels.map((l, i) => (
            <div key={i} className="flex-1 flex items-center">
              <span className="text-[9px] leading-none text-faint">
                {i % 2 === 0 ? l.slice(0, 2) : ''}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {/* Подписи месяцев над колонкой, где месяц начинается */}
          <div
            className="grid gap-[3px] h-[14px] mb-1"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
          >
            {monthCols.map(({ col, label }) => (
              <span
                key={col}
                className="text-[10px] leading-none text-muted capitalize whitespace-nowrap"
                style={{ gridColumn: `${col + 1} / span 4` }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Клетки: колонки — недели, строки — дни недели */}
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
              gridAutoFlow: 'column',
              gridTemplateRows: 'repeat(7, auto)',
            }}
          >
            {Array.from({ length: WEEKS * 7 }, (_, idx) => {
              const d = addDays(gridStart, idx);
              const style = cellStyle(d);
              const isTodayCell = formatDate(d) === todayKey;
              if (!style) {
                return (
                  <div
                    key={idx}
                    className={`aspect-square cell-r bg-elev flex items-center justify-center ${
                      isTodayCell ? 'ring-1 ring-fg/40' : ''
                    }`}
                    style={{ opacity: d > today ? 0.45 : 1 }}
                  >
                    <span
                      className="w-[2px] h-[2px] rounded-full"
                      style={{ backgroundColor: 'rgb(var(--c-muted))' }}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className={`aspect-square cell-r transition-colors ${
                    isTodayCell ? 'ring-1 ring-fg/40' : ''
                  }`}
                  style={style}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center justify-end gap-1.5 mt-4">
        <span className="text-[10px] text-faint">{t('less')}</span>
        <div className="w-3 h-3 cell-r bg-elev" />
        <div className="w-3 h-3 cell-r" style={{ backgroundColor: `${color}66` }} />
        <div className="w-3 h-3 cell-r" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-faint">{t('more')}</span>
      </div>
    </div>
  );
}

function MonthlyLineChart({
  data,
  labels,
  color,
}: {
  data: number[];
  labels: string[];
  color: string;
}) {
  const width = 340;
  const height = 160;
  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data, 1);

  const points = data.map((val, i) => ({
    x: padding.left + (i / 11) * chartW,
    y: padding.top + chartH - (val / maxVal) * chartH,
  }));

  // Build smooth curve path (Catmull-Rom to Bezier)
  const smoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const fillPath = linePath
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : '';

  const gradientId = `chart-gradient-${color.replace('#', '')}`;

  return (
    <div
      className="rounded-[26px] glass p-4"
    >
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padding.left}
            y1={padding.top + chartH * f}
            x2={padding.left + chartW}
            y2={padding.top + chartH * f}
            style={{ stroke: 'rgb(var(--c-elev))' }}
            strokeWidth="1"
          />
        ))}

        {/* Fill */}
        {fillPath && <path d={fillPath} fill={`url(#${gradientId})`} />}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            {data[i] > 0 && (
              <circle
                cx={p.x}
                cy={p.y}
                r="3"
                style={{ fill: 'rgb(var(--c-card))' }}
                stroke={color}
                strokeWidth="2"
              />
            )}
          </g>
        ))}

        {/* Month labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={padding.left + (i / 11) * chartW}
            y={height - 8}
            style={{ fill: 'rgb(var(--c-muted))' }}
            fontSize="8"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
