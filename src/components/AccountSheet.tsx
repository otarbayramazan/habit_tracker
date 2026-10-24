import { useEffect, useState } from 'react';
import { X, Mail, Lock, Check, MailCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import { useHideNav } from '@/hooks/useHideNav';

export type AccountSheetMode = 'email' | 'password' | null;

/** Шторка «Сменить почту» / «Сменить пароль» из настроек. */
export function AccountSheet({ mode, onClose }: { mode: AccountSheetMode; onClose: () => void }) {
  const { user, changeEmail, changePassword } = useAuth();
  const { language } = useSettings();
  const t = useT(language);

  const [newEmail, setNewEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (mode) {
      setNewEmail('');
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
      setDone(null);
    }
  }, [mode]);

  useHideNav(mode !== null);
  if (!mode) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'email') {
      const target = newEmail.trim().toLowerCase();
      if (target === (user?.email ?? '').toLowerCase()) {
        setError(t('sameEmail'));
        return;
      }
      setBusy(true);
      const { error: err } = await changeEmail(target);
      setBusy(false);
      if (err) setError(err);
      else
        setDone(
          t('emailChangeSent')
            .replace('{old}', user?.email ?? '')
            .replace('{new}', target)
        );
      return;
    }

    if (next !== confirm) {
      setError(t('passwordsDontMatch'));
      return;
    }
    setBusy(true);
    const { error: err } = await changePassword(current, next);
    setBusy(false);
    if (err === 'wrong_password') setError(t('wrongPassword'));
    else if (err) setError(err);
    else setDone(t('passwordChanged'));
  };

  const input =
    'w-full bg-elev border border-line2 rounded-xl pl-10 pr-4 py-3 text-fg text-sm placeholder:text-faint focus:border-muted focus:outline-none transition-colors';

  const Field = ({
    label,
    icon,
    ...props
  }: { label: string; icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-sub uppercase tracking-wide">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        <input {...props} className={input} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-6 animate-sheet"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-fg">
            {mode === 'email' ? t('changeEmail') : t('changePassword')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-elev flex items-center justify-center text-sub hover:text-fg press"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-2 animate-fade">
            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center animate-pop ${
                mode === 'email' ? 'bg-green-500/15' : 'bg-green-500'
              }`}
            >
              {mode === 'email' ? (
                <MailCheck className="w-7 h-7 text-green-500" />
              ) : (
                <Check className="w-7 h-7 text-white" strokeWidth={3} />
              )}
            </div>
            <p className="text-fg2 text-sm">{done}</p>
            {mode === 'email' && <p className="text-muted text-xs">{t('resendHint')}</p>}
            <button onClick={onClose} className="w-full bg-elev text-fg font-medium rounded-xl py-3 text-sm press">
              {t('close')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'email' ? (
              Field({
                label: t('newEmail'),
                icon: <Mail className="w-4 h-4" />,
                type: 'email',
                required: true,
                autoComplete: 'email',
                value: newEmail,
                onChange: (e) => setNewEmail(e.target.value),
                placeholder: 'you@example.com',
              })
            ) : (
              <>
                {Field({
                  label: t('currentPassword'),
                  icon: <Lock className="w-4 h-4" />,
                  type: 'password',
                  required: true,
                  autoComplete: 'current-password',
                  value: current,
                  onChange: (e) => setCurrent(e.target.value),
                  placeholder: '••••••••',
                })}
                {Field({
                  label: t('newPassword'),
                  icon: <Lock className="w-4 h-4" />,
                  type: 'password',
                  required: true,
                  minLength: 6,
                  autoComplete: 'new-password',
                  value: next,
                  onChange: (e) => setNext(e.target.value),
                  placeholder: '••••••••',
                })}
                {Field({
                  label: t('confirmPassword'),
                  icon: <Lock className="w-4 h-4" />,
                  type: 'password',
                  required: true,
                  minLength: 6,
                  autoComplete: 'new-password',
                  value: confirm,
                  onChange: (e) => setConfirm(e.target.value),
                  placeholder: '••••••••',
                })}
              </>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-fg text-app font-semibold rounded-xl py-3.5 text-sm flex items-center justify-center press disabled:opacity-50"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-app/30 border-t-app rounded-full animate-spin" />
              ) : (
                t('save')
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
