import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { MainViews } from '@/screens/MainViews';
import { StatisticsScreen } from '@/screens/StatisticsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { GlassBackground } from '@/components/GlassBackground';

export function AppShell() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('week');

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line2 border-t-sub rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Все вкладки остаются смонтированными (быстрое переключение); показ запускает анимацию.
  const pane = (id: Tab) => (tab === id ? 'tab-enter' : 'hidden');

  return (
    <div className="relative isolate min-h-screen">
      <GlassBackground />
      <div className={pane('week')}>
        <MainViews view="week" />
      </div>
      <div className={pane('month')}>
        <MainViews view="month" />
      </div>
      <div className={pane('year')}>
        <MainViews view="year" />
      </div>
      <div className={pane('statistics')}>
        <StatisticsScreen />
      </div>
      <div className={pane('settings')}>
        <SettingsScreen />
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
