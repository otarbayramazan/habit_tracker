import { ListChecks, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import type { Language } from '@/context/SettingsContext';

export type Tab = 'habits' | 'statistics' | 'settings';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export function BottomNav({ active, onChange }: Props) {
  const { language } = useSettings();
  const t = useT(language as Language);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'habits', label: t('habits'), icon: <ListChecks className="w-5 h-5" /> },
    { id: 'statistics', label: t('statistics'), icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: t('settings'), icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto mx-4 flex items-center gap-1 rounded-[28px] glass-strong px-2 py-2"
        style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-[20px] transition-all press min-w-[76px] ${
                isActive ? 'bg-fg/10' : 'hover:bg-fg/5'
              }`}
            >
              <span className={`transition-colors ${isActive ? 'text-fg' : 'text-muted'}`}>{tab.icon}</span>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-fg' : 'text-muted'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
