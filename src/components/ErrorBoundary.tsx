import { Component, type ReactNode } from 'react';
import { translations, type TranslationKey } from '@/lib/i18n';

/** Если где-то в интерфейсе случится ошибка — вместо белого экрана показываем понятную заглушку. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('App crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    let lang: keyof typeof translations = 'en';
    try {
      const l = localStorage.getItem('ht-lang');
      if (l === 'ru' || l === 'kk' || l === 'en') lang = l;
    } catch {
      /* ignore */
    }
    const t = (k: TranslationKey) => (translations[lang] as Record<string, string>)[k] ?? translations.en[k];

    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-6">
        <div className="glass rounded-[26px] p-6 max-w-sm w-full text-center">
          <img src="/icon.svg" alt="" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
          <h1 className="text-fg font-semibold text-lg">{t('crashTitle')}</h1>
          <p className="text-muted text-sm mt-1.5">{t('crashText')}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full bg-fg text-app font-semibold rounded-xl py-3 text-sm press"
          >
            {t('reload')}
          </button>
        </div>
      </div>
    );
  }
}
