import { CalendarRange, CalendarDays, Calendar, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import type { Language } from '@/context/SettingsContext';

export type Tab = 'week' | 'month' | 'year' | 'statistics' | 'settings';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export function BottomNav({ active, onChange }: Props) {
  const { language } = useSettings();
  const t = useT(language as Language);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'month', label: t('month'), icon: <CalendarRange className="w-5 h-5" /> },
    { id: 'week', label: t('week'), icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'year', label: t('year'), icon: <Calendar className="w-5 h-5" /> },
    { id: 'statistics', label: t('statistics'), icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: t('settings'), icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto mx-4 flex items-center gap-1 rounded-2xl border border-fg/10 px-2 py-2 backdrop-blur-xl shadow-2xl"
        style={{
          backgroundColor: 'rgb(var(--c-card) / 0.85)',
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all press min-w-[56px] ${
                isActive
                  ? 'bg-fg/10'
                  : 'hover:bg-fg/5'
              }`}
            >
              <span
                className={`transition-colors ${
                  isActive ? 'text-fg' : 'text-muted'
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-fg' : 'text-muted'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
