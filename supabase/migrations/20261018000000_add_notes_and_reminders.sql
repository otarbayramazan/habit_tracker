/*
  # Заметки к дню и напоминания

  1. habits.reminder_time (text, null) — время напоминания 'HH:MM', null = выключено
  2. habit_notes — одна заметка на привычку в день (UNIQUE(habit_id, date))
     RLS: пользователь видит и меняет только свои заметки.
*/

ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time text;

CREATE TABLE IF NOT EXISTS habit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

ALTER TABLE habit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notes" ON habit_notes;
CREATE POLICY "select_own_notes" ON habit_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notes" ON habit_notes;
CREATE POLICY "insert_own_notes" ON habit_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notes" ON habit_notes;
CREATE POLICY "update_own_notes" ON habit_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notes" ON habit_notes;
CREATE POLICY "delete_own_notes" ON habit_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_habit_id ON habit_notes(habit_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON habit_notes(user_id);
