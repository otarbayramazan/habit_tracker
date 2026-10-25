import { useRef } from 'react';

/**
 * Нажатие и долгое нажатие на одном элементе.
 * Обычное нажатие вызывает onTap, удержание ~0,45 с — onLongPress (и тогда onTap не срабатывает).
 */
export function useLongPress(onTap: () => void, onLongPress?: () => void, delay = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    // Метка для карточки: здесь своё долгое нажатие, перетаскивание не начинать
    'data-lp': onLongPress ? '' : undefined,
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      if (!onLongPress) return;
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // Палец поехал (прокрутка) — это не долгое нажатие
      if (start.current && (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8)) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      if (onLongPress) e.preventDefault(); // не показывать системное меню при удержании
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}
