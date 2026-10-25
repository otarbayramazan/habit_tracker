import { useState, useRef, useEffect, useMemo } from 'react';
import type { HabitWithCompletions, FrequencyType } from '@/lib/supabase';
import { useSettings, type Language } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import { Flame, Check, MoreVertical, Pencil, Trash2, Moon, StickyNote, Snowflake } from 'lucide-react';
import {
  formatDate, addDays, startOfWeek, getWeekDays, getMonthGrid,
  parseDate, startOfMonth, isScheduledOn, isCompletedOn,
  calculateFrequencyStreak, getForgivenDates,
} from '@/lib/dateUtils';
import { ProgressRing } from '@/components/ProgressRing';
import { useLongPress } from '@/hooks/useLongPress';

type ViewType = 'week' | 'month' | 'year';

type Props = {
  habit: HabitWithCompletions;
  view: ViewType;
  onToggle: (habitId: string, date: string, target: number) => void;
  onDecrement: (habitId: string, date: string) => void;
  onEdit: (habit: HabitWithCompletions) => void;
  onDelete: (habit: HabitWithCompletions) => void;
  onNote?: (habit: HabitWithCompletions) => void;
  jiggleMode?: boolean;
  jiggleIndex?: number;
  isDragging?: boolean;
  /** Включить режим перестановки карточек (пункт меню «Изменить порядок») */
  onDragStart?: (e: React.PointerEvent) => void;
};

// ── День отдыха: нейтральная клетка с чётко читаемой луной (цвет привычки не используется) ──
function RestDayBox({ size }: { size: 'sm' | 'md' }) {
  const dim = 'w-full aspect-square cell-r';
  return (
    <div
      className={`${dim} flex items-center justify-center bg-elev border border-line2`}
      style={{ width: '100%', aspectRatio: '1' }}
    >
      <Moon
        className={size === 'sm' ? 'w-2.5 h-2.5 text-sub' : 'w-4 h-4 text-sub'}
        strokeWidth={2}
      />
    </div>
  );
}

// ── Square checkbox cell (only for scheduled days) ──
function SquareCell({
  count,
  target,
  color,
  isToday,
  isPast,
  isFuture,
  size,
  onClick,
  onLongPress,
  locked,
  forgiven = false,
}: {
  count: number;
  target: number;
  color: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  size: 'sm' | 'md';
  onClick: () => void;
  onLongPress?: () => void;
  locked: boolean;
  forgiven?: boolean;
}) {
  const press = useLongPress(onClick, count > 0 ? onLongPress : undefined);
  const completed = count >= target;
  const partial = count > 0 && count < target;
  const isMulti = target > 1;
  const dim = 'w-full aspect-square cell-r';
  const isLocked = locked || isPast || isFuture;
  const showFreeze = forgiven && !completed && !partial;

  if (isLocked) {
    return (
      <div
        className={`relative ${dim} flex items-center justify-center ${isToday ? 'ring-1 ring-fg/40' : ''}`}
        style={{
          backgroundColor: completed
            ? color
            : partial
              ? `${color}40`
              : showFreeze
                ? `${color}26`
                : 'rgb(var(--c-elev))',
          width: '100%',
          aspectRatio: '1',
          // Прошлые дни в полную яркость; бледнее только будущие
          opacity: isFuture ? 0.35 : 1,
        }}
      >
        {showFreeze && (
          <Snowflake
            className={size === 'sm' ? 'w-2 h-2' : 'w-3.5 h-3.5'}
            style={{ color, opacity: 0.85 }}
            strokeWidth={2.5}
          />
        )}
        {completed && !isMulti && (
          <Check className={size === 'sm' ? 'w-2 h-2 text-white animate-pop' : 'w-3 h-3 text-white animate-pop'} strokeWidth={3} />
        )}
        {isMulti && count > 0 && (
          <span
            className={`${size === 'sm' ? 'text-[7px]' : 'text-[9px]'} font-bold leading-none text-white`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
          >
            {count}/{target}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      {...press}
      className={`relative ${dim} transition-all active:scale-90 select-none touch-manipulation flex items-center justify-center cursor-pointer hover:brightness-125 ${
        isToday ? 'ring-1 ring-fg/40' : ''
      }`}
      style={{
        backgroundColor: completed ? color : partial ? `${color}40` : `${color}26`,
        width: '100%',
        aspectRatio: '1',
      }}
    >
      {/* Прощённый вчерашний день, который ещё можно отметить */}
      {count === 0 && forgiven && (
        <Snowflake
          className={size === 'sm' ? 'w-2 h-2' : 'w-3.5 h-3.5'}
          style={{ color, opacity: 0.85 }}
          strokeWidth={2.5}
        />
      )}
      {/* Призрачная галочка: подсказывает, что сюда нужно нажать (тот же оттенок, что у снежинки) */}
      {count === 0 && !forgiven && (
        <Check
          className={size === 'sm' ? 'w-2 h-2' : 'w-3.5 h-3.5'}
          style={{ color, opacity: 0.85 }}
          strokeWidth={2.5}
        />
      )}
      {completed && !isMulti && (
        <Check className={size === 'sm' ? 'w-2 h-2 text-white animate-pop' : 'w-3 h-3 text-white animate-pop'} strokeWidth={3} />
      )}
      {isMulti && count > 0 && (
        <span
          className={`${size === 'sm' ? 'text-[7px]' : 'text-[9px]'} font-bold leading-none text-white`}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {count}/{target}
        </span>
      )}
    </button>
  );
}

// ── WEEK VIEW ──
function WeekView({
  dates,
  forgiven,
  completions,
  target,
  color,
  frequencyType,
  frequencyDays,
  dayLabels,
  today,
  onToggle,
  onDecrement,
  jiggleMode,
}: {
  dates: Date[];
  forgiven: Set<string>;
  completions: Record<string, number>;
  target: number;
  color: string;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  dayLabels: string[];
  today: Date;
  onToggle: (date: string) => void;
  onDecrement: (date: string) => void;
  jiggleMode: boolean;
}) {
  const isFuture = (d: Date) => d > today;
  const isToday = (d: Date) => formatDate(d) === formatDate(today);
  // Отмечать можно сегодня и вчера (вдруг человек забыл); более ранние дни закрыты.
  const yesterdayKey = formatDate(addDays(today, -1));
  const isPast = (d: Date) => d < today && formatDate(d) !== yesterdayKey;

  return (
    <div className="relative">
      {/* Day labels — always 7 columns */}
      <div className="grid grid-cols-7 mb-2">
        {dates.map((d, i) => (
          <span key={i} className="text-[10px] text-muted font-medium text-center">
            {dayLabels[i]}
          </span>
        ))}
      </div>

      {/* Grid — always 7 columns */}
      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((d, i) => {
          const scheduled = isScheduledOn(d, frequencyType, frequencyDays);
          const locked = jiggleMode || isFuture(d) || isPast(d);
          return scheduled ? (
            <SquareCell
              key={i}
              count={completions[formatDate(d)] ?? 0}
              target={target}
              color={color}
              isToday={isToday(d)}
              isPast={isPast(d)}
              isFuture={isFuture(d)}
              size="md"
              forgiven={forgiven.has(formatDate(d))}
              onClick={() => {
                if (jiggleMode || isFuture(d) || isPast(d)) return;
                onToggle(formatDate(d));
              }}
              onLongPress={() => {
                if (jiggleMode || isFuture(d) || isPast(d)) return;
                onDecrement(formatDate(d));
              }}
              locked={locked}
            />
          ) : (
            <RestDayBox key={i} size="md" />
          );
        })}
      </div>
    </div>
  );
}

// ── MONTH VIEW ──
function MonthView({
  weeks,
  forgiven,
  dayLabels,
  completions,
  target,
  color,
  frequencyType,
  frequencyDays,
  currentMonth,
  today,
  onToggle,
  onDecrement,
  jiggleMode,
}: {
  weeks: Date[][];
  forgiven: Set<string>;
  dayLabels: string[];
  completions: Record<string, number>;
  target: number;
  color: string;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  currentMonth: number;
  today: Date;
  onToggle: (date: string) => void;
  onDecrement: (date: string) => void;
  jiggleMode: boolean;
}) {
  const isFuture = (d: Date) => d > today;
  const isToday = (d: Date) => formatDate(d) === formatDate(today);
  // Отмечать можно сегодня и вчера (вдруг человек забыл); более ранние дни закрыты.
  const yesterdayKey = formatDate(addDays(today, -1));
  const isPast = (d: Date) => d < today && formatDate(d) !== yesterdayKey;

  const rows = weeks.length;
  const GAP = 2; // px

  // Сетка вписывается в свободное место квадратной карточки:
  // ширина = меньшее из (вся ширина) и (то, что позволяет высота при квадратных клетках).
  return (
    <div className="flex-1 min-h-0 flex items-end justify-center" style={{ containerType: 'size' }}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: GAP,
          width: `min(100cqw, calc((100cqh - ${(rows - 1) * GAP}px) / ${rows} * 7 + ${6 * GAP}px))`,
        }}
      >
        {weeks.flat().map((d, i) => {
          const otherMonth = d.getMonth() !== currentMonth;
          const scheduled = isScheduledOn(d, frequencyType, frequencyDays);
          const locked = jiggleMode || isFuture(d) || isPast(d);

          // Дни соседних месяцев — пустое место для выравнивания календаря
          if (otherMonth) return <div key={i} className="w-full aspect-square" />;

          return scheduled ? (
            <SquareCell
              key={i}
              count={completions[formatDate(d)] ?? 0}
              target={target}
              color={color}
              isToday={isToday(d)}
              isPast={isPast(d)}
              isFuture={isFuture(d)}
              size="sm"
              forgiven={forgiven.has(formatDate(d))}
              onClick={() => {
                if (jiggleMode || isFuture(d) || isPast(d)) return;
                onToggle(formatDate(d));
              }}
              onLongPress={() => {
                if (jiggleMode || isFuture(d) || isPast(d)) return;
                onDecrement(formatDate(d));
              }}
              locked={locked}
            />
          ) : (
            <RestDayBox key={i} size="sm" />
          );
        })}
      </div>
    </div>
  );
}

// ── YEAR VIEW: ровный прямоугольник последних дней ──
// Фиксированная сетка 6 × 26 на любом устройстве (156 дней ≈ 5 месяцев), без неполных рядов.
// Дни идут подряд слева направо и сверху вниз; сегодня всегда в правом нижнем углу.
// Полная история — во вкладке «Статистика».
const YEAR_VIEW_ROWS = 6;
const YEAR_VIEW_COLS = 26;
const YEAR_VIEW_DAYS = YEAR_VIEW_ROWS * YEAR_VIEW_COLS;

function YearView({
  forgiven,
  completions,
  target,
  color,
  frequencyType,
  frequencyDays,
  today,
  onToggle,
  onDecrement,
  jiggleMode,
}: {
  year: number;
  forgiven: Set<string>;
  completions: Record<string, number>;
  target: number;
  color: string;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  today: Date;
  language: Language;
  onToggle: (date: string) => void;
  onDecrement: (date: string) => void;
  jiggleMode: boolean;
}) {
  const todayKey = formatDate(today);
  const yesterdayKey = formatDate(addDays(today, -1));

  // От самого раннего дня к сегодняшнему
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = YEAR_VIEW_DAYS - 1; i >= 0; i--) out.push(addDays(today, -i));
    return out;
  }, [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${YEAR_VIEW_COLS}, minmax(0, 1fr))` }}
    >
      {days.map((d) => {
        const key = formatDate(d);
        const future = d > today;
        const isTodayCell = key === todayKey;
        const scheduled = isScheduledOn(d, frequencyType, frequencyDays);

        // День отдыха: нейтральная клетка с точкой
        if (!scheduled) {
          return (
            <div
              key={key}
              className={`aspect-square cell-r bg-elev flex items-center justify-center ${
                isTodayCell ? 'ring-1 ring-fg/40' : ''
              }`}
              style={{ opacity: future ? 0.35 : 1 }}
            >
              <span
                className="w-[2px] h-[2px] rounded-full"
                style={{ backgroundColor: 'rgb(var(--c-muted))' }}
              />
            </div>
          );
        }

        const count = completions[key] ?? 0;
        const completed = count >= target;
        const partial = count > 0 && count < target;
        const freeze = forgiven.has(key) && !completed && !partial;
        const canTap = (isTodayCell || key === yesterdayKey) && !jiggleMode;
        const waiting = isTodayCell && !completed && !partial;

        return (
          <YearCell
            key={key}
            canTap={canTap}
            onTap={() => onToggle(key)}
            onLongPress={count > 0 ? () => onDecrement(key) : undefined}
            label={key}
            className={`aspect-square cell-r transition-all ${
              canTap ? 'cursor-pointer active:scale-90' : 'cursor-default'
            } ${isTodayCell ? 'ring-1 ring-fg/50' : ''}`}
            style={{
              backgroundColor: completed
                ? color
                : partial
                  ? `${color}66`
                  : freeze || waiting
                    ? `${color}38`
                    : 'rgb(var(--c-elev))',
              opacity: future ? 0.35 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

// Клетка вкладки «История» с поддержкой долгого нажатия
function YearCell({
  canTap,
  onTap,
  onLongPress,
  label,
  className,
  style,
}: {
  canTap: boolean;
  onTap: () => void;
  onLongPress?: () => void;
  label: string;
  className: string;
  style: React.CSSProperties;
}) {
  const press = useLongPress(onTap, onLongPress);
  return (
    <button
      {...(canTap ? press : {})}
      disabled={!canTap}
      aria-label={label}
      className={`${className} select-none touch-manipulation`}
      style={style}
    />
  );
}

export function HabitCard({
  habit,
  view,
  onToggle,
  onDecrement,
  onEdit,
  onDelete,
  onNote,
  jiggleMode = false,
  jiggleIndex = 0,
  isDragging = false,
  onDragStart,
}: Props) {
  const { language } = useSettings();
  const t = useT(language);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const freqType: FrequencyType = habit.frequency_type ?? 'everyday';
  const freqDays: number[] = habit.frequency_days ?? [];
  const streak = calculateFrequencyStreak(habit.completions, habit.target_count, freqType, freqDays);
  const forgiven = useMemo(
    () => getForgivenDates(habit.completions, habit.target_count, freqType, freqDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habit.completions, habit.target_count, freqType, JSON.stringify(freqDays)]
  );
  const todayKey = formatDate(new Date());
  const doneToday = isCompletedOn(new Date(), habit.completions, habit.target_count, freqType, freqDays);
  const hasTodayNote = Boolean(habit.notes?.[todayKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Перетаскивание работает только в режиме перестановки (включается из меню)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (jiggleMode) onDragStart?.(e);
  };
  const handlePointerMove = () => {};
  const handlePointerUp = () => {};
  const handleCardClick = (e: React.MouseEvent) => {
    if (jiggleMode) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = new Date();
  const weekDays = getWeekDays(now);
  const dayLabels = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')];
  const monthGrid = getMonthGrid(now);
  const currentMonth = now.getMonth();

  const year = now.getFullYear();

  const jiggleClass = jiggleMode && !isDragging
    ? `jiggle jiggle-delay-${jiggleIndex % 4}`
    : '';

  const dragStyle: React.CSSProperties = {};

  const handleToggle = (date: string) => onToggle(habit.id, date, habit.target_count);
  const handleDecrement = (date: string) => onDecrement(habit.id, date);
  const scheduledToday = isScheduledOn(new Date(), freqType, freqDays);
  // Кольцо у иконки: нажатие отмечает сегодня, долгое нажатие убирает одну отметку
  const ringPress = useLongPress(
    () => {
      if (!jiggleMode && scheduledToday) handleToggle(todayKey);
    },
    (habit.completions[todayKey] ?? 0) > 0 && !jiggleMode ? () => handleDecrement(todayKey) : undefined
  );

  const renderHeader = (compact: boolean) => (
    <div className={`flex items-start ${compact ? 'mb-2' : 'mb-4'}`}>
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'} min-w-0 flex-1`}>
        <button
          {...ringPress}
          aria-label={t('today')}
          className={`shrink-0 rounded-full select-none touch-manipulation ${
            scheduledToday && !jiggleMode ? 'press cursor-pointer' : 'cursor-default'
          }`}
        >
          <ProgressRing
            emoji={habit.emoji}
            color={habit.color}
            count={habit.completions[todayKey] ?? 0}
            target={habit.target_count}
            size={compact ? 32 : 46}
          />
        </button>
        {compact && (
          <div className="min-w-0 flex-1">
            <h3
              className="text-fg font-semibold text-[12px] leading-tight truncate"
              title={habit.title}
            >
              {habit.title}
            </h3>
          </div>
        )}
        <div className={`min-w-0 ${compact ? 'hidden' : ''}`}>
          <h3 className="text-fg font-semibold text-sm truncate">{habit.title}</h3>
          {!compact && habit.description && (
            <p className="text-muted text-xs truncate">{habit.description}</p>
          )}
          {!compact && habit.target_count > 1 && (
            <p className="text-faint text-[10px] mt-0.5">{habit.target_count}× / {t('days')}</p>
          )}
        </div>
      </div>

      <div className={`flex items-center ${compact ? 'gap-0.5 -mr-1' : 'gap-1.5'} shrink-0`}>
        {hasTodayNote && !compact && (
          <StickyNote
            className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            style={{ color: habit.color }}
          />
        )}
        <div
          className={`flex items-center gap-0.5 ${compact ? 'px-1 py-0.5 rounded-md' : 'px-1.5 py-1 rounded-lg'}`}
          style={{ backgroundColor: streak > 0 ? `${habit.color}1a` : 'rgb(var(--c-elev))' }}
        >
          <Flame
            className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${doneToday && streak > 0 ? 'animate-flame' : ''}`}
            style={{ color: streak > 0 ? habit.color : 'rgb(var(--c-muted))' }}
          />
          <span
            className={`${compact ? 'text-[11px]' : 'text-sm'} font-bold`}
            style={{ color: streak > 0 ? habit.color : 'rgb(var(--c-muted))' }}
          >
            {streak}
          </span>
        </div>

        {!jiggleMode && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`${compact ? 'w-5 h-6' : 'w-7 h-7'} rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-elev transition-colors`}
            >
              <MoreVertical className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-44 glass-menu rounded-xl py-1">
                {onNote && (
                  <button
                    onClick={() => { onNote(habit); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-fg2 hover:bg-elev2 flex items-center gap-2 transition-colors"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    {t('addNote')}
                  </button>
                )}
                <button
                  onClick={() => { onEdit(habit); setMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-fg2 hover:bg-elev2 flex items-center gap-2 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('edit')}
                </button>
                <button
                  onClick={() => { onDelete(habit); setMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── MONTH VIEW ──
  if (view === 'month') {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCardClick}
        className={`aspect-square flex flex-col rounded-[22px] glass p-3 transition-colors ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
        style={dragStyle}
      >
        {renderHeader(true)}
        <MonthView
          weeks={monthGrid}
          forgiven={forgiven}
          dayLabels={dayLabels}
          completions={habit.completions}
          target={habit.target_count}
          color={habit.color}
          frequencyType={freqType}
          frequencyDays={freqDays}
          currentMonth={currentMonth}
          today={today}
          onToggle={handleToggle}
          onDecrement={handleDecrement}
          jiggleMode={jiggleMode}
        />
      </div>
    );
  }

  // ── WEEK VIEW ──
  if (view === 'week') {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCardClick}
        className={`rounded-[26px] glass p-4 transition-colors ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
        style={dragStyle}
      >
        {renderHeader(false)}
        <WeekView
          dates={weekDays}
          forgiven={forgiven}
          completions={habit.completions}
          target={habit.target_count}
          color={habit.color}
          frequencyType={freqType}
          frequencyDays={freqDays}
          dayLabels={dayLabels}
          today={today}
          onToggle={handleToggle}
          onDecrement={handleDecrement}
          jiggleMode={jiggleMode}
        />
      </div>
    );
  }

  // ── YEAR VIEW ──
  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleCardClick}
      className={`rounded-[26px] glass p-4 transition-colors ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
      style={dragStyle}
    >
      {renderHeader(false)}
      <YearView
        forgiven={forgiven}
        completions={habit.completions}
        target={habit.target_count}
        color={habit.color}
        frequencyType={freqType}
        frequencyDays={freqDays}
        year={year}
        today={today}
        language={language}
        onToggle={handleToggle}
          onDecrement={handleDecrement}
        jiggleMode={jiggleMode}
      />
    </div>
  );
}
