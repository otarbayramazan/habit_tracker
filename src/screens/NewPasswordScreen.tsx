import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import { KeyRound, Lock, Check } from 'lucide-react';

/** Экран после перехода по ссылке из письма «сброс пароля». */
export function NewPasswordScreen() {
  const { updatePassword, finishRecovery } = useAuth();
  const { language } = useSettings();
  const t = useT(language);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('passwordsDontMatch'));
      return;
    }
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    setTimeout(finishRecovery, 1200);
  };

  const input =
    'w-full bg-elev border border-line2 rounded-xl pl-10 pr-4 py-3 text-fg text-sm placeholder:text-faint focus:border-muted focus:outline-none transition-colors';

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold text-fg">{t('newPasswordTitle')}</h1>
          <p className="text-muted text-sm mt-2 text-center">{t('newPasswordSubtitle')}</p>
        </div>

        <div className="glass rounded-[26px] p-6">
          {done ? (
            <div className="text-center space-y-3 py-4 animate-fade">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-500 flex items-center justify-center animate-pop">
                <Check className="w-7 h-7 text-white" strokeWidth={3} />
              </div>
              <p className="text-fg font-medium">{t('passwordUpdated')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-sub uppercase tracking-wide">{t('newPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={input}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-sub uppercase tracking-wide">{t('confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={input}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-fg text-app font-semibold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 press disabled:opacity-50"
              >
                {busy ? (
                  <div className="w-4 h-4 border-2 border-app/30 border-t-app rounded-full animate-spin" />
                ) : (
                  t('savePassword')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
