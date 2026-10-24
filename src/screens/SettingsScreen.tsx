import { useAuth } from '@/context/AuthContext';
import { useSettings, type Language, type ThemeMode } from '@/context/SettingsContext';
import { LANGUAGE_NAMES, useT } from '@/lib/i18n';
import { LogOut, Globe, User, Check, Monitor, Moon, Sun } from 'lucide-react';

const LANGUAGES: Language[] = ['kk', 'ru', 'en'];

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, theme, setTheme } = useSettings();
  const t = useT(language);

  const themes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'system', label: t('themeSystem'), icon: <Monitor className="w-5 h-5" /> },
    { id: 'dark', label: t('themeDark'), icon: <Moon className="w-5 h-5" /> },
    { id: 'light', label: t('themeLight'), icon: <Sun className="w-5 h-5" /> },
  ];

  return (
    <div className="px-4 pt-6 pb-32 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-6">{t('settings')}</h1>

      {/* Account */}
      <Section title={t('account')}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-elev flex items-center justify-center">
            <User className="w-5 h-5 text-sub" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-xs">{t('email')}</p>
            <p className="text-fg text-sm font-medium truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 p-4 text-red-400 hover:bg-red-950/20 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-red-950/30 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">{t('signOut')}</span>
        </button>
      </Section>

      {/* Appearance */}
      <Section title={t('appearance')}>
        {themes.map((th) => (
          <OptionRow
            key={th.id}
            icon={th.icon}
            label={th.label}
            active={theme === th.id}
            onClick={() => setTheme(th.id)}
          />
        ))}
      </Section>

      {/* Language */}
      <Section title={t('language')}>
        {LANGUAGES.map((l) => (
          <OptionRow
            key={l}
            icon={<Globe className="w-5 h-5" />}
            label={LANGUAGE_NAMES[l]}
            active={language === l}
            onClick={() => setLanguage(l)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 px-1">{title}</h2>
      <div className="rounded-[26px] glass divide-y divide-line overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-elev transition-colors press"
    >
      <div className="w-10 h-10 rounded-xl bg-elev flex items-center justify-center text-sub">
        {icon}
      </div>
      <span className="flex-1 text-left text-fg text-sm font-medium">{label}</span>
      {active && (
        <div className="w-6 h-6 rounded-full bg-fg flex items-center justify-center animate-pop">
          <Check className="w-3.5 h-3.5 text-app" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
