import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, openedFromRecoveryLink, authLinkError } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Открыта ссылка «сброс пароля» — нужно показать экран нового пароля */
  recovery: boolean;
  /** Ошибка из ссылки в письме (например, ссылка устарела) */
  linkError: string | null;
  clearLinkError: () => void;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  finishRecovery: () => void;
  changeEmail: (newEmail: string) => Promise<{ error: string | null }>;
  changePassword: (current: string, next: string) => Promise<{ error: 'wrong_password' | string | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(openedFromRecoveryLink);
  const [linkError, setLinkError] = useState<string | null>(authLinkError);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(newSession);
      setLoading(false);
    });

    // Сверяем сохранённую сессию с сервером: при запуске и каждый раз, когда приложение снова видно.
    // Если сессию закрыли (смена почты/пароля на другом устройстве) — выходим локально.
    // Если данные аккаунта поменялись (например, подтверждена новая почта) — обновляем их.
    const verify = async () => {
      const { data: current } = await supabase.auth.getSession();
      if (!current.session) return;
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error && (error.status === 401 || error.status === 403 || error.status === 404)) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        return;
      }
      const fresh = data.user;
      const cached = current.session.user;
      if (fresh && (fresh.email !== cached.email || fresh.new_email !== cached.new_email)) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (mounted && refreshed.session) setSession(refreshed.session);
      }
    };
    verify();
    const onVisible = () => {
      if (document.visibilityState === 'visible') verify();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  // Выход срабатывает всегда: если сервер не узнаёт сессию, просто очищаем её на устройстве
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    setSession(null);
  };

  // Письмо со ссылкой для сброса пароля; ссылка вернёт на этот же сайт
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error?.message ?? null };
  };

  // Смена почты: письмо со ссылкой приходит только на новый адрес (Secure email change в Supabase выключен)
  const changeEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: window.location.origin }
    );
    return { error: error?.message ?? null };
  };

  // Смена пароля: сначала проверяем текущий пароль, потом ставим новый
  const changePassword = async (current: string, next: string) => {
    const email = session?.user?.email;
    if (!email) return { error: 'no_user' };
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) return { error: 'wrong_password' };
    const { error } = await supabase.auth.updateUser({ password: next });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
        recovery,
        linkError,
        clearLinkError: () => setLinkError(null),
        resetPassword,
        updatePassword,
        finishRecovery: () => setRecovery(false),
        changeEmail,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
