import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Language = 'en' | 'ru' | 'kk';
export type ThemeMode = 'system' | 'dark' | 'light';

type SettingsContextType = {
  language: Language;
  setLanguage: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function detectLanguage(): Language {
  const stored = readStorage('ht-lang');
  if (stored === 'ru' || stored === 'kk' || stored === 'en') return stored;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('kk')) return 'kk';
  if (nav.startsWith('ru')) return 'ru';
  return 'en';
}

function detectTheme(): ThemeMode {
  const stored = readStorage('ht-theme');
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);
  const [theme, setThemeState] = useState<ThemeMode>(detectTheme);

  useEffect(() => {
    writeStorage('ht-lang', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    writeStorage('ht-theme', theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const bg = dark ? '#000000' : '#f5f5f7';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
        StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
      }
    };

    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage: setLanguageState,
        theme,
        setTheme: setThemeState,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
