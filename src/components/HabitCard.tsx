import { useState, useRef, useEffect, useMemo } from 'react';
import type { HabitWithCompletions, FrequencyType } from '@/lib/supabase';
import { useSettings, type Language } from '@/context/SettingsContext';
import { LOCALES, useT } from '@/lib/i18n';
import { Flame, Check, MoreVertical, Pencil, Trash2, Moon, StickyNote, Snowflake } from 'lucide-react';
import {
  formatDate, addDays, startOfWeek, getWeekDays, getMonthGrid,
  parseDate, startOfMonth, isScheduledOn, isCompletedOn,
  calculateFrequencyStreak, getForgivenDates,
} from '@/lib/dateUtils';

type ViewType = 'week' | 'month' | 'year';

type Props = {
  habit: HabitWithCompletions;
  view: ViewType;
  onToggle: (habitId: string, date: string, target: number) => void;
  onEdit: (habit: HabitWithCompletions) => void;
  onDelete: (habit: HabitWithCompletions) => void;
  onNote?: (habit: HabitWithCompletions) => void;
  jiggleMode?: boolean;
  jiggleIndex?: number;
  isDragging?: boolean;
  onLongPress?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
};

// ── День отдыха: нейтральная клетка с чётко читаемой луной (цвет привычки не используется) ──
function RestDayBox({ size }: { size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-full aspect-square rounded-[3px]' : 'w-full aspect-square rounded-md';
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
  locked: boolean;
  forgiven?: boolean;
}) {
  const completed = count >= target;
  const partial = count > 0 && count < target;
  const isMulti = target > 1;
  const dim = size === 'sm' ? 'w-full aspect-square rounded-[3px]' : 'w-full aspect-square rounded-md';
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
      onClick={onClick}
      className={`relative ${dim} transition-all active:scale-90 flex items-center justify-center cursor-pointer hover:brightness-125 ${
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
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayLabels.map((l, i) => (
          <span key={i} className="text-[8px] text-faint text-center font-medium">{l.slice(0, 2)}</span>
        ))}
      </div>

      {/* Grid — always 7 columns per row */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
          {week.map((d, di) => {
            const otherMonth = d.getMonth() !== currentMonth;
            const scheduled = isScheduledOn(d, frequencyType, frequencyDays);
            const locked = jiggleMode || isFuture(d) || isPast(d);

            // Other-month days: transparent placeholder for calendar alignment
            if (otherMonth) {
              return <div key={di} className="w-full aspect-square" />;
            }

            // Same-month: scheduled → SquareCell, rest day → RestDayBox
            return scheduled ? (
              <SquareCell
                key={di}
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
                locked={locked}
              />
            ) : (
              <RestDayBox key={di} size="sm" />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── YEAR VIEW: 12 мини-календарей ──
function YearView({
  year,
  forgiven,
  completions,
  target,
  color,
  frequencyType,
  frequencyDays,
  today,
  language,
  onToggle,
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
  jiggleMode: boolean;
}) {
  const todayKey = formatDate(today);
  const yesterdayKey = formatDate(addDays(today, -1));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const weeks = getMonthGrid(first);
        const title = first.toLocaleDateString(LOCALES[language], { month: 'long' });
        const isCurrent = year === today.getFullYear() && m === today.getMonth();

        return (
          <div key={m} className="min-w-0">
            <p
              className={`text-[11px] font-medium mb-1.5 truncate capitalize ${
                isCurrent ? 'text-fg' : 'text-muted'
              }`}
            >
              {title}
            </p>
            <div className="grid grid-cols-7 gap-[2px]">
              {weeks.flat().map((d, i) => {
                if (d.getMonth() !== m) return <div key={i} className="aspect-square" />;

                const key = formatDate(d);
                const future = d > today;
                const isTodayCell = key === todayKey;
                const scheduled = isScheduledOn(d, frequencyType, frequencyDays);

                // День отдыха: нейтральная клетка с точкой (значок на такой клетке не помещается)
                if (!scheduled) {
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-[3px] bg-elev flex items-center justify-center"
                      style={{ opacity: future ? 0.5 : 1 }}
                    >
                      <span
                        className="w-[3px] h-[3px] rounded-full"
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
                  <button
                    key={i}
                    disabled={!canTap}
                    onClick={() => onToggle(key)}
                    className={`aspect-square rounded-[3px] flex items-center justify-center transition-all ${
                      canTap ? 'cursor-pointer active:scale-90' : 'cursor-default'
                    } ${isTodayCell ? 'ring-1 ring-fg/40' : ''}`}
                    style={{
                      backgroundColor: completed
                        ? color
                        : partial
                          ? `${color}59`
                          : freeze || waiting
                            ? `${color}33`
                            : 'rgb(var(--c-elev))',
                      opacity: future ? 0.5 : 1,
                    }}
                  >
                    {freeze && (
                      <Snowflake className="w-[7px] h-[7px]" style={{ color }} strokeWidth={3} />
                    )}
                    {waiting && canTap && (
                      <Check
                        className="w-[7px] h-[7px] animate-pop"
                        style={{ color, opacity: 0.85 }}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HabitCard({
  habit,
  view,
  onToggle,
  onEdit,
  onDelete,
  onNote,
  jiggleMode = false,
  jiggleIndex = 0,
  isDragging = false,
  onLongPress,
  onDragStart,
}: Props) {
  const { language } = useSettings();
  const t = useT(language);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (jiggleMode) {
      onDragStart?.(e);
      return;
    }
    longPressFired.current = false;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onLongPress?.();
    }, 400);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!jiggleMode && longPressTimer.current && pointerStart.current) {
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (longPressFired.current || jiggleMode) {
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
  const monthLabel = now.toLocaleDateString(LOCALES[language], { month: 'long' });
  const currentMonth = now.getMonth();

  const year = now.getFullYear();

  const jiggleClass = jiggleMode && !isDragging
    ? `jiggle jiggle-delay-${jiggleIndex % 4}`
    : '';

  const dragStyle: React.CSSProperties = isDragging
    ? { opacity: 0.4, transform: 'scale(0.98)' }
    : {};

  const handleToggle = (date: string) => onToggle(habit.id, date, habit.target_count);

  const renderHeader = (compact: boolean) => (
    <div className={`flex items-start ${compact ? 'mb-2' : 'mb-4'}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`${compact ? 'w-8 h-8 text-base' : 'w-11 h-11 text-xl'} rounded-xl flex items-center justify-center shrink-0`}
          style={{ backgroundColor: `${habit.color}1a` }}
        >
          {habit.emoji}
        </div>
        <div className="min-w-0">
          <h3 className="text-fg font-semibold text-sm truncate">{habit.title}</h3>
          {!compact && habit.description && (
            <p className="text-muted text-xs truncate">{habit.description}</p>
          )}
          {!compact && habit.target_count > 1 && (
            <p className="text-faint text-[10px] mt-0.5">{habit.target_count}× / {t('days')}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {hasTodayNote && (
          <StickyNote
            className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            style={{ color: habit.color }}
          />
        )}
        <div
          className={`flex items-center gap-0.5 px-1.5 ${compact ? 'py-0.5' : 'py-1'} rounded-lg`}
          style={{ backgroundColor: streak > 0 ? `${habit.color}1a` : 'rgb(var(--c-elev))' }}
        >
          <Flame
            className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${doneToday && streak > 0 ? 'animate-flame' : ''}`}
            style={{ color: streak > 0 ? habit.color : 'rgb(var(--c-muted))' }}
          />
          <span
            className={`${compact ? 'text-xs' : 'text-sm'} font-bold`}
            style={{ color: streak > 0 ? habit.color : 'rgb(var(--c-muted))' }}
          >
            {streak}
          </span>
        </div>

        {!jiggleMode && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-elev transition-colors`}
            >
              <MoreVertical className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-40 bg-elev border border-line2 rounded-xl shadow-2xl py-1">
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
        className={`rounded-2xl bg-card border border-line p-3 transition-colors hover:border-line2 ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
        style={dragStyle}
      >
        {renderHeader(true)}
        <span className="text-[10px] text-sub font-medium block text-center mb-1.5">{monthLabel}</span>
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
        className={`rounded-2xl bg-card border border-line p-4 transition-colors hover:border-line2 ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
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
      className={`rounded-2xl bg-card border border-line p-4 transition-colors hover:border-line2 ${jiggleClass} ${jiggleMode ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
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
        jiggleMode={jiggleMode}
      />
    </div>
  );
}
