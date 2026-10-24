import { useEffect } from 'react';

// Сколько окон открыто прямо сейчас (окна могут открываться друг поверх друга).
let openCount = 0;

/**
 * Пока окно открыто, нижняя панель навигации скрыта, чтобы не перекрывать кнопки окна.
 * Работает через класс на <html>: .modal-open прячет панель (см. index.css).
 */
export function useHideNav(active: boolean) {
  useEffect(() => {
    if (!active) return;
    openCount++;
    document.documentElement.classList.add('modal-open');
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.documentElement.classList.remove('modal-open');
    };
  }, [active]);
}
