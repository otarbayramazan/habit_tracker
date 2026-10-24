import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { useHideNav } from '@/hooks/useHideNav';
import { useSettings } from '@/context/SettingsContext';
import { LOCALES, useT } from '@/lib/i18n';
import { addDays, formatDate, parseDate } from '@/lib/dateUtils';
import type { HabitWithCompletions } from '@/lib/supabase';

type Props = {
  habit: HabitWithCompletions | null;
  onClose: () => void;
};

const MAX_LEN = 500;

export function NoteSheet({ habit, onClose }: Props) {
  const { habits, saveNote } = useHabits();
  const { language } = useSettings();
  const t = useT(language);
  const todayKey = formatDate(new Date());

  const [date, setDate] = useState(todayKey);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Берём актуальную версию привычки из общего состояния (заметки могли обновиться).
  const live = habit ? habits.find((h) => h.id === habit.id) ?? habit : null;

  useEffect(() => {
    if (habit) {
      setDate(todayKey);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.id]);

  useEffect(() => {
    if (live) {
      setText(live.notes[date] ?? '');
      setError(null);
      setTimeout(() => areaRef.current?.focus(), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.id, date]);

  useHideNav(Boolean(habit));

  if (!habit || !live) return null;

  const isToday = date === todayKey;
  const label = parseDate(date).toLocaleDateString(LOCALES[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const shift = (delta: number) => {
    const next = formatDate(addDays(parseDate(date), delta));
    if (next > todayKey) return;
    setDate(next);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveNote(live.id, date, text);
      onClose();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-6 animate-sheet"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: `${live.color}1a` }}
          >
            {live.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-fg font-semibold truncate">{live.title}</h2>
            <p className="text-muted text-xs">{t('notes')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-elev flex items-center justify-center text-sub hover:text-fg press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between bg-elev rounded-xl px-1 py-1 mb-3">
          <button
            onClick={() => shift(-1)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sub hover:bg-elev2 press"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-fg capitalize">
            {isToday ? `${t('today')}, ` : ''}
            {label}
          </span>
          <button
            onClick={() => shift(1)}
            disabled={isToday}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sub hover:bg-elev2 press disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <textarea
          ref={areaRef}
          value={text}
          maxLength={MAX_LEN}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t('notePlaceholder')}
          className="w-full resize-none bg-elev border border-line2 rounded-xl px-4 py-3 text-fg text-sm placeholder-faint focus:border-muted focus:outline-none transition-colors"
        />
        <div className="flex justify-end text-[11px] text-faint mt-1">
          {text.length}/{MAX_LEN}
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5 mt-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-elev text-fg2 font-medium text-sm press">
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 py-3.5 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 press"
            style={{ backgroundColor: live.color }}
          >
            <Check className="w-4 h-4" />
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
