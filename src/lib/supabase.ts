import { createClient } from '@supabase/supabase-js';

// Ключи берутся из .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// Anon-ключ публичный по дизайну: данные защищены политиками RLS в базе.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fjbadogrszjqhqwqntxj.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYmFkb2dyc3pqcWhxd3FudHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYzODgsImV4cCI6MjEwMzgzMjM4OH0.ERjzGulHNVS2jtm5czLMQ8-UmLWv-ksU94Mt4yNoMRQ';

// Ссылка из письма «сброс пароля» открывает сайт с #...type=recovery в адресе.
// supabase-js сразу стирает эту часть адреса, поэтому запоминаем её заранее.
const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
export const openedFromRecoveryLink = /type=recovery/.test(initialHash);
export const authLinkError = (() => {
  const m = /error_description=([^&]+)/.exec(initialHash);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FrequencyType = 'everyday' | 'weekly' | 'monthly';

export type Habit = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  color: string;
  emoji: string;
  target_count: number;
  frequency_type: FrequencyType;
  frequency_days: number[];
  position: number;
  reminder_time: string | null; // 'HH:MM' или null
  created_at: string;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  count: number;
  created_at: string;
};

export type HabitNote = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  text: string;
  updated_at: string;
};

export type HabitWithCompletions = Habit & {
  completions: Record<string, number>;
  notes: Record<string, string>;
};
