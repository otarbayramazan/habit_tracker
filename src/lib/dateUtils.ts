// Date utility functions

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function daysInMonth(date: Date): number {
  return endOfMonth(date).getDate();
}

export function getMonthGrid(date: Date): Date[][] {
  const total = daysInMonth(date);
  const weeks: Date[][] = [];
  let week: Date[] = [];
  const first = startOfMonth(date);
  const firstDay = first.getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-based offset

  for (let i = 0; i < offset; i++) week.push(addDays(first, i - offset));
  for (let day = 1; day <= total; day++) {
    week.push(new Date(date.getFullYear(), date.getMonth(), day));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) {
      const last = week[week.length - 1];
      week.push(addDays(last, 1));
    }
    weeks.push(week);
  }
  return weeks;
}

export function getYearDays(year: number): Date[] {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const days: Date[] = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

// Streak calculation: consecutive days up to today where habit was completed
export function calculateCurrentStreak(completions: Record<string, number>, target: number): number {
  let streak = 0;
  let d = new Date();
  d.setHours(0, 0, 0, 0);

  // If today not completed, streak may still be valid up to yesterday
  while (true) {
    const key = formatDate(d);
    if ((completions[key] ?? 0) >= target) {
      streak++;
      d = addDays(d, -1);
    } else {
      break;
    }
  }
  return streak;
}

export function calculateBestStreak(completions: Record<string, number>, target: number): number {
  const dates = Object.keys(completions)
    .filter((d) => (completions[d] ?? 0) >= target)
    .sort();
  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = parseDate(dates[i - 1]);
    const curr = parseDate(dates[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

export function countCompletedDays(completions: Record<string, number>, target: number): number {
  return Object.values(completions).filter((c) => c >= target).length;
}

// Процент выполнения: только запланированные дни от начала до сегодня.
// Дни отдыха в знаменатель не попадают. Сегодняшний ещё не выполненный день тоже не считается.
export function completionRate(
  completions: Record<string, number>,
  target: number,
  startDate: string,
  frequencyType: 'everyday' | 'weekly' | 'monthly' = 'everyday',
  frequencyDays: number[] = []
): number {
  let start = startDate.includes('T') ? new Date(startDate) : parseDate(startDate);
  if (isNaN(start.getTime())) return 0;
  start.setHours(0, 0, 0, 0);

  // Если есть отметки раньше даты создания, начинаем с первой отметки.
  const firstKey = Object.keys(completions).sort()[0];
  if (firstKey) {
    const first = parseDate(firstKey);
    if (first < start) start = first;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDate(today);

  let scheduled = 0;
  let done = 0;
  for (let d = new Date(start), i = 0; d <= today && i < 3660; d = addDays(d, 1), i++) {
    if (!isScheduledOn(d, frequencyType, frequencyDays)) continue;
    if ((completions[formatDate(d)] ?? 0) >= target) {
      scheduled++;
      done++;
    } else if (formatDate(d) !== todayKey) {
      scheduled++;
    }
  }
  if (scheduled === 0) return 0;
  return Math.round((done / scheduled) * 100);
}
export function getMonthlyCounts(completions: Record<string, number>, target: number, year: number): number[] {
  const counts = new Array(12).fill(0);
  for (const [dateStr, count] of Object.entries(completions)) {
    const d = parseDate(dateStr);
    if (d.getFullYear() === year && count >= target) {
      counts[d.getMonth()]++;
    }
  }
  return counts;
}

// Check if a habit is scheduled for a given date based on its frequency
export function isScheduledOn(
  date: Date,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): boolean {
  if (frequencyType === 'everyday') return true;
  if (frequencyType === 'weekly') {
    return frequencyDays.includes(date.getDay());
  }
  if (frequencyType === 'monthly') {
    return frequencyDays.includes(date.getDate());
  }
  return true;
}

// Check if a date was completed (scheduled + met target)
export function isCompletedOn(
  date: Date,
  completions: Record<string, number>,
  target: number,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): boolean {
  if (!isScheduledOn(date, frequencyType, frequencyDays)) return false;
  return (completions[formatDate(date)] ?? 0) >= target;
}

// Build chain segments for a range of dates.
// A segment is a contiguous run of completed scheduled days.
// Between two completed scheduled days that have only non-scheduled days
// between them (no missed scheduled day), the chain continues unbroken.
// Returns array of {startIdx, endIdx} (inclusive indices into the dates array).
export function getChainSegments(
  dates: Date[],
  completions: Record<string, number>,
  target: number,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): { startIdx: number; endIdx: number }[] {
  const segments: { startIdx: number; endIdx: number }[] = [];
  let segStart: number | null = null;
  let lastCompletedIdx: number | null = null;

  for (let i = 0; i < dates.length; i++) {
    const scheduled = isScheduledOn(dates[i], frequencyType, frequencyDays);
    if (!scheduled) continue;

    const completed = (completions[formatDate(dates[i])] ?? 0) >= target;

    if (completed) {
      if (lastCompletedIdx !== null) {
        // Check if there's a missed scheduled day between lastCompletedIdx and i
        let hasMissed = false;
        for (let j = lastCompletedIdx + 1; j < i; j++) {
          if (isScheduledOn(dates[j], frequencyType, frequencyDays)) {
            hasMissed = true;
            break;
          }
        }
        if (hasMissed) {
          // Close previous segment, start new one
          if (segStart !== null) {
            segments.push({ startIdx: segStart, endIdx: lastCompletedIdx });
          }
          segStart = i;
        }
        // else: chain continues through non-scheduled days
      } else {
        segStart = i;
      }
      lastCompletedIdx = i;
    } else {
      // Missed a scheduled day
      if (segStart !== null && lastCompletedIdx !== null) {
        segments.push({ startIdx: segStart, endIdx: lastCompletedIdx });
        segStart = null;
        lastCompletedIdx = null;
      }
    }
  }

  // Close final segment
  if (segStart !== null && lastCompletedIdx !== null) {
    segments.push({ startIdx: segStart, endIdx: lastCompletedIdx });
  }

  return segments;
}

// Серия с «льготным» днём.
// Один пропущенный запланированный день серию НЕ обрывает (но и не увеличивает её).
// Серия сбрасывается, только когда пропущено ДВА запланированных дня подряд.
// Дни, на которые привычка не запланирована, не учитываются вообще.
// Сегодняшний ещё не выполненный день пропуском не считается (день не закончился).
export const MAX_MISSED_IN_ROW = 1;

export function calculateFrequencyStreak(
  completions: Record<string, number>,
  target: number,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): number {
  let streak = 0;
  let missedInRow = 0;
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  const todayKey = formatDate(d);

  for (let i = 0; i < 3660; i++) {
    if (isScheduledOn(d, frequencyType, frequencyDays)) {
      if ((completions[formatDate(d)] ?? 0) >= target) {
        streak++;
        missedInRow = 0;
      } else if (formatDate(d) !== todayKey) {
        missedInRow++;
        if (missedInRow > MAX_MISSED_IN_ROW) break;
      }
    }
    d = addDays(d, -1);
  }
  return streak;
}

// Лучшая серия по тем же правилам (один пропуск прощается, два подряд обнуляют).
export function calculateBestFrequencyStreak(
  completions: Record<string, number>,
  target: number,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): number {
  const keys = Object.keys(completions)
    .filter((k) => (completions[k] ?? 0) >= target)
    .sort();
  if (keys.length === 0) return 0;

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const todayKey = formatDate(end);

  let d = parseDate(keys[0]);
  let best = 0;
  let cur = 0;
  let missedInRow = 0;
  while (d <= end) {
    if (isScheduledOn(d, frequencyType, frequencyDays)) {
      if ((completions[formatDate(d)] ?? 0) >= target) {
        cur++;
        missedInRow = 0;
        best = Math.max(best, cur);
      } else if (formatDate(d) !== todayKey) {
        missedInRow++;
        if (missedInRow > MAX_MISSED_IN_ROW) cur = 0;
      }
    }
    d = addDays(d, 1);
  }
  return best;
}

// Прощённые дни: одиночный пропуск запланированного дня, который не оборвал серию.
// Условия: до него был выполненный день, а следом либо выполненный день,
// либо сегодняшний ещё не закрытый день, либо ничего (запланированных дней больше не было).
// Два пропуска подряд не прощаются, поэтому в таком случае снежинки нет.
export function getForgivenDates(
  completions: Record<string, number>,
  target: number,
  frequencyType: 'everyday' | 'weekly' | 'monthly',
  frequencyDays: number[]
): Set<string> {
  const result = new Set<string>();
  const keys = Object.keys(completions)
    .filter((k) => (completions[k] ?? 0) >= target)
    .sort();
  if (keys.length === 0) return result;

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const todayKey = formatDate(end);

  const days: { key: string; done: boolean }[] = [];
  let d = parseDate(keys[0]);
  while (d <= end) {
    if (isScheduledOn(d, frequencyType, frequencyDays)) {
      const key = formatDate(d);
      days.push({ key, done: (completions[key] ?? 0) >= target });
    }
    d = addDays(d, 1);
  }

  for (let i = 1; i < days.length; i++) {
    const cur = days[i];
    if (cur.done || cur.key === todayKey) continue;
    if (!days[i - 1].done) continue;
    const next = days[i + 1];
    if (!next || next.done || next.key === todayKey) result.add(cur.key);
  }
  return result;
}
