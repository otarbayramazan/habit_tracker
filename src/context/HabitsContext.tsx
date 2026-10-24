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
  toggleCompletion: (habitId: string, date: string, target: number) => Promise<void>;
  saveNote: (habitId: string, date: string, text: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { language } = useSettings();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [notes, setNotes] = useState<HabitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const inflight = useRef<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!user) {
      setHabits([]);
      setCompletions([]);
      setNotes([]);
      setLoading(false);
      return;
    }
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
    if (habitRes.data) setHabits(habitRes.data as Habit[]);
    if (compRes.data) setCompletions(compRes.data as HabitCompletion[]);
    // Если миграция с заметками ещё не применена, приложение продолжает работать без них.
    if (noteRes.data) setNotes(noteRes.data as HabitNote[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

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

  // Оптимистичное обновление: интерфейс реагирует мгновенно, при ошибке откатываемся.
  const toggleCompletion = async (habitId: string, date: string, target: number) => {
    if (!user) return;
    const key = `${habitId}:${date}`;
    if (inflight.current.has(key)) return;
    inflight.current.add(key);

    const existing = completions.find((c) => c.habit_id === habitId && c.date === date);

    try {
      if (existing) {
        if (existing.count >= target) {
          tapHaptic();
          setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
          const { error } = await supabase
            .from('habit_completions')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const newCount = existing.count + 1;
          if (newCount >= target) successHaptic();
          else tapHaptic();
          setCompletions((prev) =>
            prev.map((c) => (c.id === existing.id ? { ...c, count: newCount } : c))
          );
          const { error } = await supabase
            .from('habit_completions')
            .update({ count: newCount })
            .eq('id', existing.id);
          if (error) throw error;
        }
      } else {
        if (target <= 1) successHaptic();
        else tapHaptic();
        const tempId = `tmp-${key}`;
        const temp: HabitCompletion = {
          id: tempId,
          habit_id: habitId,
          user_id: user.id,
          date,
          count: 1,
          created_at: new Date().toISOString(),
        };
        setCompletions((prev) => [...prev, temp]);
        const { data: row, error } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, date, count: 1 })
          .select()
          .single();
        if (error) throw error;
        setCompletions((prev) => prev.map((c) => (c.id === tempId ? (row as HabitCompletion) : c)));
      }
    } catch {
      await fetchAll();
    } finally {
      inflight.current.delete(key);
    }
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
