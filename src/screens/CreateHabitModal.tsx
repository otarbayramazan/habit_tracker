import { useState, useRef, useEffect } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useHideNav } from '@/hooks/useHideNav';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import { COLOR_SWATCHES, EMOJI_CHOICES } from '@/lib/constants';
import { X, Check, Plus, Minus, Smile, Bell } from 'lucide-react';
import { remindersSupported, requestReminderPermission } from '@/lib/reminders';
import type { HabitWithCompletions, FrequencyType } from '@/lib/supabase';
import type { Language } from '@/context/SettingsContext';

type Props = {
  open: boolean;
  onClose: () => void;
  editingHabit?: HabitWithCompletions | null;
};

// JS getDay: 0=Sun..6=Sat. Интерфейс начинается с понедельника.
const WEEKDAY_JS = [1, 2, 3, 4, 5, 6, 0];

export function CreateHabitModal({ open, onClose, editingHabit }: Props) {
  const { createHabit, updateHabit } = useHabits();
  const { language } = useSettings();
  const t = useT(language as Language);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[1]);
  const [emoji, setEmoji] = useState('🎯');
  const [targetCount, setTargetCount] = useState(1);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('everyday');
  const [frequencyDays, setFrequencyDays] = useState<number[]>([]);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editingHabit) {
        setTitle(editingHabit.title);
        setDescription(editingHabit.description);
        setColor(editingHabit.color);
        setEmoji(editingHabit.emoji);
        setTargetCount(editingHabit.target_count);
        setFrequencyType(editingHabit.frequency_type ?? 'everyday');
        setFrequencyDays(editingHabit.frequency_days ?? []);
        setReminderTime(editingHabit.reminder_time ?? null);
      } else {
        setTitle('');
        setDescription('');
        setColor(COLOR_SWATCHES[1]);
        setEmoji('🎯');
        setTargetCount(1);
        setFrequencyType('everyday');
        setFrequencyDays([]);
        setReminderTime(null);
      }
      setEmojiOpen(false);
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open, editingHabit]);

  useHideNav(open);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('titleRequired'));
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        color,
        emoji,
        target_count: targetCount,
        frequency_type: frequencyType,
        frequency_days: frequencyDays,
        reminder_time: reminderTime,
      };
      if (editingHabit) {
        await updateHabit(editingHabit.id, payload);
      } else {
        await createHabit(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  const toggleReminder = async () => {
    if (reminderTime) {
      setReminderTime(null);
      return;
    }
    setReminderTime('09:00');
    if (remindersSupported) await requestReminderPermission();
  };

  const weekdayLabels = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')];

  const toggleWeekday = (jsDay: number) => {
    setFrequencyDays((prev) =>
      prev.includes(jsDay) ? prev.filter((d) => d !== jsDay) : [...prev, jsDay].sort()
    );
  };

  const toggleMonthDay = (day: number) => {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-sheet"
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-line2" />
        </div>

        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-fg">
            {editingHabit ? t('edit') : t('createHabit')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-elev flex items-center justify-center text-sub hover:text-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Live preview */}
          <div
            className="rounded-2xl p-4 border transition-colors"
            style={{
              borderColor: `${color}33`,
              background: `linear-gradient(135deg, ${color}0d, transparent)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: `${color}1a` }}
              >
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fg font-semibold text-base truncate">
                  {title || t('habitTitle')}
                </p>
                <p className="text-muted text-sm truncate">
                  {description || t('descPreview')}
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-sub uppercase tracking-wide">
              {t('habitTitle')}
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-elev border border-line2 rounded-xl px-4 py-3 text-fg text-sm focus:border-muted focus:outline-none transition-colors"
              placeholder={t('titlePlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-sub uppercase tracking-wide">
              {t('description')}
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-elev border border-line2 rounded-xl px-4 py-3 text-fg text-sm focus:border-muted focus:outline-none transition-colors"
              placeholder={t('descPlaceholder')}
            />
          </div>

          {/* Frequency selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-sub uppercase tracking-wide">
              {t('frequency')}
            </label>
            {/* Segmented control */}
            <div className="flex gap-1 bg-elev rounded-xl p-1">
              {([
                { key: 'everyday', label: t('everyday') },
                { key: 'weekly', label: t('daysOfWeek') },
                { key: 'monthly', label: t('daysOfMonth') },
              ] as { key: FrequencyType; label: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setFrequencyType(opt.key);
                    setFrequencyDays([]);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    frequencyType === opt.key
                      ? 'bg-fg text-app'
                      : 'text-sub hover:text-fg'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Days of week pills */}
            {frequencyType === 'weekly' && (
              <div className="flex gap-1.5 pt-1">
                {weekdayLabels.map((label, i) => {
                  const jsDay = WEEKDAY_JS[i];
                  const active = frequencyDays.includes(jsDay);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleWeekday(jsDay)}
                      className={`flex-1 h-10 rounded-lg text-xs font-semibold transition-all press ${
                        active
                          ? 'text-white'
                          : 'bg-elev text-muted hover:text-fg2'
                      }`}
                      style={active ? { backgroundColor: color } : {}}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Days of month grid */}
            {frequencyType === 'monthly' && (
              <div className="grid grid-cols-7 gap-1 pt-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const active = frequencyDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleMonthDay(day)}
                      className={`h-8 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? 'text-white'
                          : 'bg-elev text-muted hover:text-fg2'
                      }`}
                      style={active ? { backgroundColor: color } : {}}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Color swatches */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-sub uppercase tracking-wide">
              {t('color')}
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="relative w-8 h-8 rounded-lg overflow-hidden cursor-pointer border border-line2 flex items-center justify-center hover:scale-105 transition-transform"
                style={{
                  background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
                }}
                title={t('customColor')}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Emoji + Target */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-sub uppercase tracking-wide">
                {t('icon')}
              </label>
              <button
                onClick={() => setEmojiOpen(!emojiOpen)}
                className="w-full bg-elev border border-line2 rounded-xl px-4 py-3 flex items-center justify-between text-sm text-fg focus:border-muted focus:outline-none transition-colors"
              >
                <span className="text-xl">{emoji}</span>
                <Smile className="w-4 h-4 text-muted" />
              </button>
              {emojiOpen && (
                <div className="absolute z-20 mt-2 p-3 bg-elev border border-line2 rounded-xl shadow-2xl grid grid-cols-8 gap-1 w-72">
                  {EMOJI_CHOICES.map((em) => (
                    <button
                      key={em}
                      onClick={() => {
                        setEmoji(em);
                        setEmojiOpen(false);
                      }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-elev2 transition-colors ${
                        emoji === em ? 'bg-elev2 ring-1 ring-fg/30' : ''
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-28 space-y-2">
              <label className="text-xs font-medium text-sub uppercase tracking-wide">
                {t('dailyTarget')}
              </label>
              <div className="flex items-center bg-elev border border-line2 rounded-xl px-1 py-1.5">
                <button
                  onClick={() => setTargetCount(Math.max(1, targetCount - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sub hover:text-fg hover:bg-elev2 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="flex-1 text-center text-fg font-semibold text-sm">
                  {targetCount}
                </span>
                <button
                  onClick={() => setTargetCount(Math.min(12, targetCount + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sub hover:text-fg hover:bg-elev2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Reminder */}
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-sub uppercase tracking-wide">
              {t('reminder')}
            </label>
            <div className="flex items-center gap-3 bg-elev border border-line2 rounded-xl px-4 py-3">
              <Bell className="w-4 h-4 text-muted shrink-0" />
              <span className="flex-1 text-sm text-fg">
                {reminderTime ? t('reminderTime') : t('reminderOff')}
              </span>
              {reminderTime && (
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value || null)}
                  className="bg-elev2 rounded-lg px-2 py-1 text-sm text-fg focus:outline-none"
                />
              )}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(reminderTime)}
                onClick={toggleReminder}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: reminderTime ? color : 'rgb(var(--c-line2))' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: reminderTime ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
            {reminderTime && !remindersSupported && (
              <p className="text-xs text-muted px-1">{t('reminderWebHint')}</p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl bg-elev text-fg2 font-medium text-sm hover:bg-elev2 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex-1 py-3.5 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ backgroundColor: color }}
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('save')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
