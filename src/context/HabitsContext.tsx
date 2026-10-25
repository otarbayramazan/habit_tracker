import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  supabase,
  type FrequencyType,
  type Habit,
  type HabitCompletion,
  type HabitNote,
  type HabitWithCompletions,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { translations } from '@/lib/i18n';
import { syncReminders } from '@/lib/reminders';
import { successHaptic, tapHaptic } from '@/lib/haptics';

export type HabitInput = {
  title: string;
  description: string;
  color: string;
  emoji: string;
  target_count: number;
  frequency_type?: FrequencyType;
  frequency_days?: number[];
  reminder_time?: string | null;
};

type HabitsContextType = {
  habits: HabitWithCompletions[];
  rawHabits: Habit[];
  completions: HabitCompletion[];
  loading: boolean;
  createHabit: (data: HabitInput) => Promise<Habit | null>;
  updateHabit: (id: string, data: Partial<HabitInput>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  reorderHabits: (orderedIds: string[]) => Promise<void>;
  /** Нажатие: цель 1 раз — вкл/выкл; цель N раз — +1 (на полной цели ничего не делает) */
  toggleCompletion: (habitId: string, date: string, target: number) => Promise<void>;
  /** Долгое нажатие: убрать одну отметку */
  decrementCompletion: (habitId: string, date: string) => Promise<void>;
  /** Сколько отметок ждут отправки (нет интернета) */
  pendingSync: number;
  saveNote: (habitId: string, date: string, text: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

// ── Работа без интернета ──
// Последние загруженные данные хранятся на устройстве (показываем их сразу и без сети),
// а отметки, которые не удалось отправить, ждут в очереди и уходят, когда сеть вернётся.
type QueuedCount = { habitId: string; date: string; count: number };
type Cache = { habits: Habit[]; completions: HabitCompletion[]; notes: HabitNote[] };

const cacheKey = (uid: string) => `ht-cache-${uid}`;
const queueKey = (uid: string) => `ht-queue-${uid}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* память переполнена или недоступна — не критично */
  }
}
function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  return /Failed to fetch|NetworkError|Load failed|network/i.test(msg);
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { language } = useSettings();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [notes, setNotes] = useState<HabitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const inflight = useRef<Set<string>>(new Set());

  // Записать количество отметок за день на сервер (0 — удалить запись)
  const persistCount = useCallback(async (habitId: string, date: string, count: number) => {
    if (count <= 0) {
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habitId)
        .eq('date', date);
      if (error) throw error;
      return null;
    }
    const { data, error } = await supabase
      .from('habit_completions')
      .upsert({ habit_id: habitId, date, count }, { onConflict: 'habit_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data as HabitCompletion;
  }, []);

  const enqueue = useCallback(
    (item: QueuedCount) => {
      if (!user) return;
      const q = readJSON<Record<string, QueuedCount>>(queueKey(user.id), {});
      q[`${item.habitId}:${item.date}`] = item; // важна только последняя отметка за день
      writeJSON(queueKey(user.id), q);
      setPendingSync(Object.keys(q).length);
    },
    [user]
  );

  // Отправить всё, что накопилось без интернета
  const flushQueue = useCallback(async () => {
    if (!user) return;
    const q = readJSON<Record<string, QueuedCount>>(queueKey(user.id), {});
    const keys = Object.keys(q);
    for (const k of keys) {
      try {
        await persistCount(q[k].habitId, q[k].date, q[k].count);
        delete q[k];
      } catch (e) {
        if (isNetworkError(e)) break; // сети всё ещё нет — попробуем позже
        delete q[k]; // ошибка данных (например, привычку удалили) — отбрасываем
      }
    }
    writeJSON(queueKey(user.id), q);
    setPendingSync(Object.keys(q).length);
  }, [user, persistCount]);

  // Показать сохранённые данные сразу, ещё до ответа сервера
  useEffect(() => {
    if (!user) return;
    const cached = readJSON<Cache | null>(cacheKey(user.id), null);
    if (cached) {
      setHabits(cached.habits);
      setCompletions(cached.completions);
      setNotes(cached.notes);
      setLoading(false);
    }
    setPendingSync(Object.keys(readJSON<Record<string, QueuedCount>>(queueKey(user.id), {})).length);
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setHabits([]);
      setCompletions([]);
      setNotes([]);
      setLoading(false);
      return;
    }
    await flushQueue();
    const [habitRes, compRes, noteRes] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('habit_completions').select('*').eq('user_id', user.id),
      supabase.from('habit_notes').select('*').eq('user_id', user.id),
    ]);
    if (habitRes.error && isNetworkError(habitRes.error)) {
      // Нет интернета: остаёмся на сохранённых данных
      setLoading(false);
      return;
    }
    if (habitRes.data) setHabits(habitRes.data as Habit[]);
    if (compRes.data) {
      // Отметки, которые ещё ждут отправки, важнее данных с сервера
      const q = readJSON<Record<string, QueuedCount>>(queueKey(user.id), {});
      const rows = (compRes.data as HabitCompletion[]).filter((c) => !q[`${c.habit_id}:${c.date}`]);
      const queued: HabitCompletion[] = Object.values(q)
        .filter((x) => x.count > 0)
        .map((x) => ({
          id: `tmp-${x.habitId}:${x.date}`,
          habit_id: x.habitId,
          user_id: user.id,
          date: x.date,
          count: x.count,
          created_at: new Date().toISOString(),
        }));
      setCompletions([...rows, ...queued]);
    }
    // Если миграция с заметками ещё не применена, приложение продолжает работать без них.
    if (noteRes.data) setNotes(noteRes.data as HabitNote[]);
    setLoading(false);
  }, [user, flushQueue]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Сеть вернулась — отправляем очередь и обновляем данные
  useEffect(() => {
    const onOnline = () => fetchAll();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [fetchAll]);

  // Сохраняем актуальные данные на устройстве
  useEffect(() => {
    if (!user || loading) return;
    writeJSON(cacheKey(user.id), { habits, completions, notes } satisfies Cache);
  }, [user, loading, habits, completions, notes]);

  // Напоминания: пересоздаём расписание при изменении привычек или языка.
  useEffect(() => {
    if (loading) return;
    syncReminders(habits, translations[language].reminderBody);
  }, [habits, language, loading]);

  const habitsWithData = useMemo<HabitWithCompletions[]>(
    () =>
      habits.map((h) => ({
        ...h,
        completions: Object.fromEntries(
          completions.filter((c) => c.habit_id === h.id).map((c) => [c.date, c.count])
        ),
        notes: Object.fromEntries(
          notes.filter((n) => n.habit_id === h.id).map((n) => [n.date, n.text])
        ),
      })),
    [habits, completions, notes]
  );

  const createHabit = async (data: HabitInput) => {
    const maxPos = habits.reduce((mx, h) => Math.max(mx, h.position), 0);
    const { data: row, error } = await supabase
      .from('habits')
      .insert({
        title: data.title,
        description: data.description,
        color: data.color,
        emoji: data.emoji,
        target_count: data.target_count,
        frequency_type: data.frequency_type ?? 'everyday',
        frequency_days: data.frequency_days ?? [],
        reminder_time: data.reminder_time ?? null,
        position: maxPos + 1,
      })
      .select()
      .single();
    if (error) throw error;
    if (row) setHabits((prev) => [...prev, row as Habit]);
    return (row as Habit) ?? null;
  };

  const updateHabit = async (id: string, data: Partial<HabitInput>) => {
    const { data: row, error } = await supabase
      .from('habits')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (row) setHabits((prev) => prev.map((h) => (h.id === id ? (row as Habit) : h)));
  };

  const deleteHabit = async (id: string) => {
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) throw error;
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setCompletions((prev) => prev.filter((c) => c.habit_id !== id));
    setNotes((prev) => prev.filter((n) => n.habit_id !== id));
  };

  const reorderHabits = useCallback(
    async (orderedIds: string[]) => {
      setHabits((prev) => {
        const map = new Map(prev.map((h) => [h.id, h]));
        return orderedIds
          .map((id, idx) => {
            const h = map.get(id);
            return h ? { ...h, position: idx + 1 } : null;
          })
          .filter((h): h is Habit => h !== null);
      });

      const results = await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('habits').update({ position: idx + 1 }).eq('id', id)
        )
      );
      // supabase-js не бросает исключение, а возвращает error — проверяем явно.
      if (results.some((r) => r.error)) await fetchAll();
    },
    [fetchAll]
  );

  // Поставить количество отметок за день: интерфейс меняется сразу, сервер — следом.
  // Без интернета отметка ждёт в очереди и уйдёт позже.
  const setCount = async (habitId: string, date: string, count: number) => {
    if (!user) return;
    const key = `${habitId}:${date}`;
    const tempId = `tmp-${key}`;
    setCompletions((prev) => {
      const rest = prev.filter((c) => !(c.habit_id === habitId && c.date === date));
      if (count <= 0) return rest;
      const old = prev.find((c) => c.habit_id === habitId && c.date === date);
      return [
        ...rest,
        old
          ? { ...old, count }
          : { id: tempId, habit_id: habitId, user_id: user.id, date, count, created_at: new Date().toISOString() },
      ];
    });

    if (inflight.current.has(key)) {
      // Предыдущая запись ещё идёт — запомним последнее значение в очереди
      enqueue({ habitId, date, count });
      return;
    }
    inflight.current.add(key);
    try {
      const row = await persistCount(habitId, date, count);
      if (row) setCompletions((prev) => prev.map((c) => (c.habit_id === habitId && c.date === date ? row : c)));
    } catch (e) {
      if (isNetworkError(e)) enqueue({ habitId, date, count });
      else await fetchAll();
    } finally {
      inflight.current.delete(key);
      // Если за время записи успели нажать ещё раз — дошлём последнее значение
      const q = readJSON<Record<string, QueuedCount>>(queueKey(user.id), {});
      if (q[key] && navigator.onLine) flushQueue();
    }
  };

  const currentCount = (habitId: string, date: string) =>
    completions.find((c) => c.habit_id === habitId && c.date === date)?.count ?? 0;

  const toggleCompletion = async (habitId: string, date: string, target: number) => {
    const count = currentCount(habitId, date);
    if (target <= 1) {
      if (count >= 1) tapHaptic();
      else successHaptic();
      return setCount(habitId, date, count >= 1 ? 0 : 1);
    }
    if (count >= target) {
      tapHaptic(); // цель уже выполнена; убрать отметку — долгим нажатием
      return;
    }
    if (count + 1 >= target) successHaptic();
    else tapHaptic();
    return setCount(habitId, date, count + 1);
  };

  const decrementCompletion = async (habitId: string, date: string) => {
    const count = currentCount(habitId, date);
    if (count <= 0) return;
    tapHaptic();
    return setCount(habitId, date, count - 1);
  };

  const saveNote = async (habitId: string, date: string, text: string) => {
    const trimmed = text.trim();
    const existing = notes.find((n) => n.habit_id === habitId && n.date === date);

    if (!trimmed) {
      if (!existing) return;
      const { error } = await supabase.from('habit_notes').delete().eq('id', existing.id);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== existing.id));
      return;
    }

    const { data: row, error } = await supabase
      .from('habit_notes')
      .upsert(
        { habit_id: habitId, date, text: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'habit_id,date' }
      )
      .select()
      .single();
    if (error) throw error;
    setNotes((prev) => [
      ...prev.filter((n) => !(n.habit_id === habitId && n.date === date)),
      row as HabitNote,
    ]);
  };

  return (
    <HabitsContext.Provider
      value={{
        habits: habitsWithData,
        rawHabits: habits,
        completions,
        loading,
        createHabit,
        updateHabit,
        deleteHabit,
        reorderHabits,
        toggleCompletion,
        decrementCompletion,
        pendingSync,
        saveNote,
        refetch: fetchAll,
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHabits() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within HabitsProvider');
  return ctx;
}
