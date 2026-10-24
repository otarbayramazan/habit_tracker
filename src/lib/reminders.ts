import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Habit } from '@/lib/supabase';

/** Напоминания работают только в установленном приложении (Android/iOS). */
export const remindersSupported = Capacitor.isNativePlatform();

const CHANNEL_ID = 'habit-reminders';

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 20_000_000;
}

function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
      status = await LocalNotifications.requestPermissions();
    }
    return status.display === 'granted';
  } catch {
    return false;
  }
}

/** Полностью пересоздаёт расписание уведомлений по текущему списку привычек. */
export async function syncReminders(habits: Habit[], body: string): Promise<void> {
  if (!remindersSupported) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const withReminder = habits.filter((h) => h.reminder_time && parseTime(h.reminder_time));
    if (withReminder.length === 0) return;

    const granted = await requestReminderPermission();
    if (!granted) return;

    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Habit reminders',
      importance: 4,
    });

    const notifications = withReminder.flatMap((h) => {
      const time = parseTime(h.reminder_time as string)!;
      const base = hash(h.id) * 40;
      const common = {
        title: `${h.emoji} ${h.title}`,
        body,
        channelId: CHANNEL_ID,
      };
      const type = h.frequency_type ?? 'everyday';
      const days = h.frequency_days ?? [];

      if (type === 'weekly') {
        // Capacitor: weekday 1 = воскресенье … 7 = суббота; у нас getDay(): 0 = воскресенье
        return days.map((d, i) => ({
          ...common,
          id: base + i,
          schedule: { on: { weekday: d + 1, hour: time.hour, minute: time.minute } },
        }));
      }
      if (type === 'monthly') {
        return days.map((d, i) => ({
          ...common,
          id: base + i,
          schedule: { on: { day: d, hour: time.hour, minute: time.minute } },
        }));
      }
      return [
        {
          ...common,
          id: base,
          schedule: { on: { hour: time.hour, minute: time.minute } },
        },
      ];
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.warn('Reminders sync failed', e);
  }
}
