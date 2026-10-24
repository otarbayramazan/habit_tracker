import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useT } from '@/lib/i18n';
import { Mail, Lock, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp, resetPassword, linkError, clearLinkError } = useAuth();
  const { language } = useSettings();
  const t = useT(language);

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(linkError ? 'forgot' : 'signup');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    linkError ? t('linkProblem').replace('{error}', linkError) : null
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearLinkError();
    setBusy(true);
    if (mode === 'forgot') {
      const { error: err } = await resetPassword(email.trim());
      setBusy(false);
      if (err) setError(err);
      else setSentTo(email.trim());
      return;
    }
    const fn = mode === 'signin' ? signIn : signUp;
    const { error: err } = await fn(email, password);
    setBusy(false);
    if (err) {
      setError(err);
    }
  };

  const goTo = (m: 'signin' | 'signup' | 'forgot') => {
    setMode(m);
    setError(null);
    setSentTo(null);
    clearLinkError();
  };

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/icon.svg"
            alt=""
            className="w-20 h-20 rounded-[22px] shadow-2xl shadow-orange-500/20 mb-4"
          />
          <h1 className="text-3xl font-bold text-fg tracking-tight">{t('appName')}</h1>
          <p className="text-muted text-sm mt-2">
            {mode === 'forgot' ? t('resetSubtitle') : mode === 'signin' ? t('signInSubtitle') : t('signUpSubtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-line rounded-2xl p-6 space-y-5">
          {mode === 'forgot' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo('signin')}
                className="w-8 h-8 rounded-lg bg-elev flex items-center justify-center text-sub hover:text-fg press"
                aria-label={t('backToSignIn')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-fg font-semibold">{t('resetTitle')}</h2>
            </div>
          ) : (
          /* Mode tabs */
          <div className="flex bg-elev rounded-xl p-1">
            <button
              onClick={() => goTo('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-fg text-app'
                  : 'text-sub hover:text-fg'
              }`}
            >
              {t('signUp')}
            </button>
            <button
              onClick={() => goTo('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-fg text-app'
                  : 'text-sub hover:text-fg'
              }`}
            >
              {t('signIn')}
            </button>
          </div>
          )}

          {mode === 'forgot' && sentTo ? (
            // Письмо отправлено
            <div className="text-center space-y-4 animate-fade">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-green-500/15 flex items-center justify-center">
                <MailCheck className="w-7 h-7 text-green-500" />
              </div>
              <p className="text-fg2 text-sm">{t('resetSent').replace('{email}', sentTo)}</p>
              <p className="text-muted text-xs">{t('resendHint')}</p>
              <button
                onClick={() => goTo('signin')}
                className="w-full bg-elev text-fg font-medium rounded-xl py-3 text-sm press"
              >
                {t('backToSignIn')}
              </button>
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sub uppercase tracking-wide">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-elev border border-line2 rounded-xl pl-10 pr-4 py-3 text-fg text-sm placeholder:text-faint focus:border-muted focus:outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sub uppercase tracking-wide">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-elev border border-line2 rounded-xl pl-10 pr-4 py-3 text-fg text-sm placeholder:text-faint focus:border-muted focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {mode === 'signin' && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => goTo('forgot')}
                    className="text-xs text-sub hover:text-fg transition-colors"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
              )}
            </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-fg text-app font-semibold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'forgot' ? t('sendResetLink') : mode === 'signin' ? t('signIn') : t('signUp')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          {/* Toggle */}
          {mode !== 'forgot' && (
          <div className="text-center text-sm text-muted">
            {mode === 'signin' ? t('noAccount') : t('haveAccount')}{' '}
            <button
              onClick={() => goTo(mode === 'signin' ? 'signup' : 'signin')}
              className="text-fg font-medium hover:underline"
            >
              {mode === 'signin' ? t('signUp') : t('signIn')}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
