import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useSettings } from '@/context/SettingsContext';
import { formatMonthYear, useT } from '@/lib/i18n';
import { HabitCard } from '@/components/HabitCard';
import { CreateHabitModal } from '@/screens/CreateHabitModal';
import { NoteSheet } from '@/components/NoteSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, CalendarDays, Check, CloudOff } from 'lucide-react';
import { Celebration, CELEBRATION_MS } from '@/components/Celebration';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { isScheduledOn, isCompletedOn } from '@/lib/dateUtils';
import type { HabitWithCompletions } from '@/lib/supabase';
import type { Language } from '@/context/SettingsContext';

export type ViewType = 'week' | 'month' | 'year';

// Готовые привычки для первого запуска
const PRESETS: { key: TranslationKey; emoji: string; color: string; target?: number }[] = [
  { key: 'presetWater', emoji: '💧', color: '#0a84ff', target: 4 },
  { key: 'presetRead', emoji: '📚', color: '#ff9500' },
  { key: 'presetSport', emoji: '🏋️', color: '#ff1f3d' },
  { key: 'presetSleep', emoji: '😴', color: '#8a2cff' },
  { key: 'presetMeditate', emoji: '🧘', color: '#00c4a0' },
  { key: 'presetWalk', emoji: '🚶', color: '#00d65f' },
];

export function MainViews({ view, onViewChange }: { view: ViewType; onViewChange: (v: ViewType) => void }) {
  const {
    habits,
    loading,
    toggleCompletion,
    decrementCompletion,
    reorderHabits,
    deleteHabit,
    createHabit,
    pendingSync,
  } = useHabits();
  const { language } = useSettings();
  const t = useT(language as Language);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithCompletions | null>(null);
  const [noteHabit, setNoteHabit] = useState<HabitWithCompletions | null>(null);
  const [deleting, setDeleting] = useState<HabitWithCompletions | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Перетаскивание: карточка едет за пальцем, остальные плавно уступают место
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const prevPos = useRef(new Map<string, { x: number; y: number }>());
  const drag = useRef<{
    id: string;
    pointerId: number;
    grabX: number;
    grabY: number;
    x: number;
    y: number;
    order: string[];
    moved: boolean;
  } | null>(null);
  const scrollRaf = useRef<number | null>(null);
  // Ожидание долгого нажатия на карточку
  const pending = useRef<{ id: string; pointerId: number; x0: number; y0: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const now = new Date();
  const dateLabel = formatMonthYear(language, now);

  const todaysHabits = habits.filter((h) =>
    isScheduledOn(now, h.frequency_type ?? 'everyday', h.frequency_days ?? [])
  );

  // Сводка на сегодня: сколько запланированных на сегодня привычек уже выполнено
  const doneToday = todaysHabits.filter((h) =>
    isCompletedOn(now, h.completions, h.target_count, h.frequency_type ?? 'everyday', h.frequency_days ?? [])
  ).length;
  const totalToday = todaysHabits.length;
  const allDone = totalToday > 0 && doneToday === totalToday;

  // Праздник: показываем, когда последняя привычка дня только что отмечена (не при открытии приложения)
  const [celebrate, setCelebrate] = useState(false);
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return;
    const before = prevDone.current;
    prevDone.current = doneToday;
    if (before !== null && before < doneToday && allDone) {
      successHaptic();
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), CELEBRATION_MS);
      return () => clearTimeout(timer);
    }
  }, [doneToday, allDone, loading]);

  const [adding, setAdding] = useState<string | null>(null);
  const addPreset = async (p: (typeof PRESETS)[number]) => {
    setAdding(p.key);
    try {
      await createHabit({
        title: t(p.key),
        description: '',
        color: p.color,
        emoji: p.emoji,
        target_count: p.target ?? 1,
      });
    } finally {
      setAdding(null);
    }
  };

  const viewOptions: { id: ViewType; label: string }[] = [
    { id: 'week', label: t('week') },
    { id: 'month', label: t('month') },
    { id: 'year', label: t('history') },
  ];

  // ── Неделя / Месяц / История как страницы: листаются пальцем ──
  // Все три вида лежат рядом в «ленте»; лента едет за пальцем, при отпускании
  // докатывается до ближайшей страницы. Половинки обеих страниц видны, пока держишь палец.
  const ORDER: ViewType[] = ['week', 'month', 'year'];
  const GAP = 24;
  const pagerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const pillTextRef = useRef<HTMLDivElement>(null);
  // Тёмные подписи видны только внутри белой плашки — цвет текста меняется ровно по её краю
  const pillClip = (pos: number) =>
    `inset(0 ${((ORDER.length - 1 - pos) / ORDER.length) * 100}% 0 ${(pos / ORDER.length) * 100}% round 0.75rem)`;
  const viewRef = useRef(view);
  viewRef.current = view;
  const paging = useRef(false); // идёт докатывание — новые жесты ждут
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const pageStep = () => (trackRef.current?.offsetWidth ?? window.innerWidth) + GAP;
  const pageRefs = useRef(new Map<ViewType, HTMLDivElement>());

  // Соседние страницы не выше текущей (и экрана) — иначе страницу можно было бы прокрутить в пустоту
  const fitPages = () => {
    const active = pageRefs.current.get(viewRef.current);
    if (!active) return;
    const h = Math.max(active.offsetHeight, window.innerHeight);
    pageRefs.current.forEach((el, v) => {
      const isActive = v === viewRef.current;
      el.style.maxHeight = isActive ? '' : `${h}px`;
      el.style.overflow = isActive ? '' : 'hidden';
    });
  };
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fitPages);
    pageRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, habits.length > 0, todaysHabits.length > 0]);

  const setTrack = (px: number, ms = 0) => {
    const track = trackRef.current;
    const pill = pillRef.current;
    const tr = ms ? `transform ${ms}ms ${EASE}` : 'none';
    if (track) {
      track.style.transition = tr;
      track.style.transform = px ? `translate3d(${px}px, 0, 0)` : '';
    }
    if (pill) {
      // «Таблетка» в переключателе едет вместе с пальцем
      const pos = ORDER.indexOf(viewRef.current) - px / pageStep();
      pill.style.transition = tr;
      pill.style.transform = `translateX(${pos * 100}%)`;
      const txt = pillTextRef.current;
      if (txt) {
        txt.style.transition = ms ? `clip-path ${ms}ms ${EASE}` : 'none';
        txt.style.clipPath = pillClip(pos);
      }
    }
  };

  // Докатить ленту до страницы next и сделать её текущей
  const goTo = (next: ViewType, ms = 380) => {
    const delta = ORDER.indexOf(next) - ORDER.indexOf(viewRef.current);
    if (!delta) {
      setTrack(0, 260);
      return;
    }
    paging.current = true;
    setTrack(-delta * pageStep(), ms);
    window.setTimeout(() => {
      onViewChange(next);
    }, ms);
  };

  // После смены вида лента без анимации возвращается в ноль — визуально ничего не прыгает
  useLayoutEffect(() => {
    setTrack(0);
    fitPages();
    paging.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const switchView = (next: ViewType) => {
    if (next === view || paging.current) return;
    goTo(next);
  };

  // Жест пальцем (свои обработчики, чтобы можно было запретить прокрутку страницы во время листания)
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let g: {
      x: number;
      y: number;
      lock: 'x' | 'y' | null;
      off: number;
      samples: { t: number; x: number }[];
    } | null = null;

    const start = (e: TouchEvent) => {
      const tch = e.touches[0];
      // У краёв экрана — системный жест «назад», не мешаем ему
      if (
        e.touches.length !== 1 ||
        paging.current ||
        drag.current ||
        !trackRef.current ||
        tch.clientX < 24 ||
        tch.clientX > window.innerWidth - 24
      ) {
        g = null;
        return;
      }
      g = { x: tch.clientX, y: tch.clientY, lock: null, off: 0, samples: [{ t: e.timeStamp, x: tch.clientX }] };
    };

    const move = (e: TouchEvent) => {
      if (!g) return;
      if (drag.current) {
        g = null;
        return;
      }
      const tch = e.touches[0];
      const dx = tch.clientX - g.x;
      const dy = tch.clientY - g.y;
      if (!g.lock) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          g.lock = 'x';
          cancelPending(); // это листание, а не удержание карточки
        } else if (Math.abs(dy) > 10) {
          g.lock = 'y';
        }
      }
      if (g.lock !== 'x') return;
      e.preventDefault();
      const idx = ORDER.indexOf(viewRef.current);
      const atEdge = (idx === 0 && dx > 0) || (idx === ORDER.length - 1 && dx < 0);
      g.off = atEdge ? dx * 0.25 : dx; // на крайней странице — «резинка»
      g.samples.push({ t: e.timeStamp, x: tch.clientX });
      if (g.samples.length > 5) g.samples.shift();
      setTrack(g.off);
    };

    const end = () => {
      const s0 = g;
      g = null;
      if (!s0 || s0.lock !== 'x') return;
      const a = s0.samples[0];
      const b = s0.samples[s0.samples.length - 1];
      const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/мс
      const idx = ORDER.indexOf(viewRef.current);
      const step = pageStep();
      let dir = 0;
      if ((s0.off < -step * 0.3 || v < -0.4) && s0.off < 0) dir = 1;
      else if ((s0.off > step * 0.3 || v > 0.4) && s0.off > 0) dir = -1;
      const next = ORDER[idx + dir];
      if (dir && next) {
        // Чем быстрее смахнул, тем быстрее докатывается
        const left = step - Math.abs(s0.off);
        const ms = Math.round(Math.min(420, Math.max(220, left / Math.max(Math.abs(v), 0.9))));
        goTo(next, ms);
      } else {
        setTrack(0, 320);
      }
    };

    host.addEventListener('touchstart', start, { passive: true });
    host.addEventListener('touchmove', move, { passive: false });
    host.addEventListener('touchend', end);
    host.addEventListener('touchcancel', end);
    return () => {
      host.removeEventListener('touchstart', start);
      host.removeEventListener('touchmove', move);
      host.removeEventListener('touchend', end);
      host.removeEventListener('touchcancel', end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  const openEdit = (h: HabitWithCompletions) => {
    setEditingHabit(h);
    setModalOpen(true);
  };

  const handleDelete = (h: HabitWithCompletions) => setDeleting(h);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteHabit(deleting.id);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Перетаскивание ──
  const snapshotPositions = () => {
    const m = new Map<string, { x: number; y: number }>();
    itemRefs.current.forEach((el, id) => m.set(id, { x: el.offsetLeft, y: el.offsetTop }));
    prevPos.current = m;
  };

  // Ставим перетаскиваемую карточку точно под палец (offsetTop не зависит от transform)
  const positionDragged = () => {
    const d = drag.current;
    const list = listRef.current;
    const el = d && itemRefs.current.get(d.id);
    if (!d || !list || !el) return;
    const lr = list.getBoundingClientRect();
    const dx = d.x - d.grabX - (lr.left + el.offsetLeft);
    const dy = d.y - d.grabY - (lr.top + el.offsetTop);
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.03)`;
  };

  // Под какой карточкой палец — туда и переносим
  const updateTarget = () => {
    const d = drag.current;
    const list = listRef.current;
    if (!d || !list) return;
    const lr = list.getBoundingClientRect();
    const dragged = itemRefs.current.get(d.id);
    if (!dragged) return;
    // Считаем по центру перетаскиваемой карточки, а не по пальцу — так соседи уступают вовремя
    const px = d.x - d.grabX - lr.left + dragged.offsetWidth / 2;
    const py = d.y - d.grabY - lr.top + dragged.offsetHeight / 2;
    const from = d.order.indexOf(d.id);
    let to = from;
    if (view === 'month') {
      // Сетка: куда попал центр карточки
      for (let j = 0; j < d.order.length; j++) {
        const el = itemRefs.current.get(d.order[j]);
        if (!el || j === from) continue;
        const { offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h } = el;
        if (px >= x && px <= x + w && py >= y && py <= y + h) to = j;
      }
    } else {
      // Список: сосед уступает место, когда карточка накрыла его наполовину
      const top = py - dragged.offsetHeight / 2;
      const bottom = py + dragged.offsetHeight / 2;
      for (let j = from + 1; j < d.order.length; j++) {
        const el = itemRefs.current.get(d.order[j]);
        if (el && bottom > el.offsetTop + el.offsetHeight / 2) to = j;
      }
      for (let j = from - 1; j >= 0; j--) {
        const el = itemRefs.current.get(d.order[j]);
        if (el && top < el.offsetTop + el.offsetHeight / 2) to = j;
      }
    }
    if (to === from) return;
    const next = [...d.order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    snapshotPositions();
    d.order = next;
    setLiveOrder(next);
    tapHaptic();
  };

  // Остальные карточки плавно переезжают на новые места (FLIP)
  useLayoutEffect(() => {
    if (!liveOrder) return;
    const dragId = drag.current?.id;
    itemRefs.current.forEach((el, id) => {
      if (id === dragId) return;
      const prev = prevPos.current.get(id);
      if (!prev) return;
      const dx = prev.x - el.offsetLeft;
      const dy = prev.y - el.offsetTop;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      void el.offsetHeight;
      el.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = '';
    });
    positionDragged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOrder]);

  // Автопрокрутка, когда палец у верхнего или нижнего края экрана
  const autoScroll = () => {
    const d = drag.current;
    if (!d) return;
    const edgeTop = 90;
    const edgeBottom = window.innerHeight - 130;
    let v = 0;
    if (d.y < edgeTop) v = -Math.ceil((edgeTop - d.y) / 6);
    else if (d.y > edgeBottom) v = Math.ceil((d.y - edgeBottom) / 6);
    if (v) {
      window.scrollBy(0, v);
      positionDragged();
      updateTarget();
    }
    scrollRaf.current = requestAnimationFrame(autoScroll);
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved = true;
    positionDragged();
    updateTarget();
  };

  const finishDrag = () => {
    const d = drag.current;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', finishDrag);
    window.removeEventListener('pointercancel', finishDrag);
    document.removeEventListener('touchmove', blockTouchScroll);
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = null;
    if (!d) return;
    // Клик, который браузер шлёт после отпускания, не должен отметить клеточку
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 350);
    const el = itemRefs.current.get(d.id);
    if (el) {
      // Мягко «кладём» карточку на её место
      el.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = '';
      setTimeout(() => {
        el.style.transition = '';
      }, 220);
    }
    const original = todaysHabits.map((h) => h.id);
    if (d.order.join() !== original.join()) {
      const todaySet = new Set(original);
      const otherIds = habits.filter((h) => !todaySet.has(h.id)).map((h) => h.id);
      reorderHabits([...d.order, ...otherIds]);
    }
    drag.current = null;
    setDraggingId(null);
    setLiveOrder(null);
  };

  // Пока карточка поднята, страница не должна прокручиваться пальцем
  const blockTouchScroll = (e: TouchEvent) => {
    if (drag.current) e.preventDefault();
  };

  const liftCard = () => {
    const p = pending.current;
    pending.current = null;
    if (!p || drag.current) return;
    const el = itemRefs.current.get(p.id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = {
      id: p.id,
      pointerId: p.pointerId,
      grabX: p.x - r.left,
      grabY: p.y - r.top,
      x: p.x,
      y: p.y,
      order: todaysHabits.map((h) => h.id),
      moved: false,
    };
    window.getSelection?.()?.removeAllRanges();
    el.style.transition = 'transform 160ms ease';
    el.style.transform = 'scale(1.03)';
    setTimeout(() => {
      if (drag.current?.id === p.id) el.style.transition = 'none';
    }, 160);
    tapHaptic();
    setDraggingId(p.id);
    document.addEventListener('touchmove', blockTouchScroll, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    scrollRaf.current = requestAnimationFrame(autoScroll);
  };

  const cancelPending = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };

  // Зажал карточку ~0,4 с — она поднимается и едет за пальцем. Отпустил — встала на место.
  const handlePressStart = (e: React.PointerEvent, id: string) => {
    if (drag.current || todaysHabits.length < 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // У клеточек с отметкой и у кольца своё долгое нажатие (убрать отметку)
    if ((e.target as HTMLElement).closest('[data-lp]')) return;
    cancelPending();
    pending.current = {
      id,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(liftCard, 400),
    };
  };

  const handlePressMove = (e: React.PointerEvent) => {
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    p.x = e.clientX;
    p.y = e.clientY;
    // Палец поехал раньше времени — это прокрутка, а не перетаскивание
    if (Math.abs(p.x - p.x0) > 8 || Math.abs(p.y - p.y0) > 8) cancelPending();
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      document.removeEventListener('touchmove', blockTouchScroll);
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
      cancelPending();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const shownHabits = liveOrder
    ? liveOrder
        .map((id) => todaysHabits.find((h) => h.id === id))
        .filter((h): h is HabitWithCompletions => Boolean(h))
    : todaysHabits;

  // Список карточек одного вида. Перетаскивать можно только на текущей странице.
  const renderList = (v: ViewType, active: boolean) => (
    <div
      ref={active ? listRef : undefined}
      className={`relative ${v === 'month' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}`}
    >
      {(active ? shownHabits : todaysHabits).map((habit, idx) => {
        const isDragging = active && draggingId === habit.id;
        return (
          <div
            key={habit.id}
            ref={
              active
                ? (el) => {
                    if (el) itemRefs.current.set(habit.id, el);
                    else itemRefs.current.delete(habit.id);
                  }
                : undefined
            }
            onPointerDown={active ? (e) => handlePressStart(e, habit.id) : undefined}
            onPointerMove={active ? handlePressMove : undefined}
            onPointerUp={active ? cancelPending : undefined}
            onPointerCancel={active ? cancelPending : undefined}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative select-none no-callout ${isDragging ? 'z-30' : ''}`}
          >
            <div
              className={`card-rise rounded-[26px] transition-shadow ${isDragging ? 'shadow-2xl shadow-black/60' : ''}`}
              style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
            >
              <HabitCard
                habit={habit}
                view={v}
                onToggle={toggleCompletion}
                onDecrement={decrementCompletion}
                onEdit={openEdit}
                onDelete={handleDelete}
                onNote={setNoteHabit}
                isDragging={isDragging}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="px-4 pt-6 pb-32 max-w-2xl mx-auto min-h-[100dvh]"
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${totalToday > 0 ? 'mb-4' : 'mb-6'}`}>
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('habits')}</h1>
          <p className="text-muted text-sm flex items-center gap-1.5 mt-0.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="w-11 h-11 rounded-xl bg-fg text-app flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
        </div>
      </div>

      {/* Масштаб: Неделя | Месяц | История */}
      {habits.length > 0 && (
        <div className="relative flex glass rounded-2xl p-1 mb-4" role="tablist">
          <div
            ref={pillRef}
            className="absolute top-1 bottom-1 left-1 rounded-xl bg-fg shadow"
            style={{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${ORDER.indexOf(view) * 100}%)` }}
          />
          {viewOptions.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={view === o.id}
              onClick={() => switchView(o.id)}
              className="relative flex-1 py-2 rounded-xl text-xs font-semibold text-sub hover:text-fg transition-colors"
            >
              {o.label}
            </button>
          ))}
          <div
            ref={pillTextRef}
            aria-hidden="true"
            className="absolute inset-1 flex pointer-events-none"
            style={{ clipPath: pillClip(ORDER.indexOf(view)) }}
          >
            {viewOptions.map((o) => (
              <span key={o.id} className="flex-1 py-2 text-center text-xs font-semibold text-app">
                {o.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Сводка на сегодня: тихая строка с тонкой полоской прогресса */}
      {!loading && totalToday > 0 && (
        <div className="mb-5 animate-fade">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs ${allDone ? 'text-fg2' : 'text-muted'}`}>
              {allDone
                ? t('allDoneToday')
                : t('todaySummary')
                    .replace('{done}', String(doneToday))
                    .replace('{total}', String(totalToday))}
            </span>
            {allDone && <Check className="w-3.5 h-3.5 text-fg2 animate-pop" strokeWidth={2.5} />}
          </div>
          <div className="h-1 rounded-full bg-elev overflow-hidden">
            <div
              className="h-full rounded-full bg-fg/50 transition-[width] duration-500 ease-out"
              style={{ width: `${(doneToday / totalToday) * 100}%` }}
            />
          </div>
        </div>
      )}

      {pendingSync > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-500 -mt-2 mb-4">
          <CloudOff className="w-3.5 h-3.5" />
          {t('offlinePending').replace('{n}', String(pendingSync))}
        </p>
      )}

      {/* Habits */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-line2 border-t-sub rounded-full animate-spin" />
          <p className="text-muted text-sm mt-3">{t('loadingHabits')}</p>
        </div>
      ) : habits.length === 0 ? (
        // Первый запуск: готовые привычки в одно нажатие
        <div className="pt-4 animate-fade">
          <h3 className="text-fg font-semibold text-base text-center">{t('presetsTitle')}</h3>
          <p className="text-muted text-xs text-center mt-1 mb-5">{t('presetsHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => addPreset(p)}
                disabled={adding !== null}
                className="glass rounded-[22px] p-4 flex items-center gap-3 text-left press disabled:opacity-60"
              >
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: `${p.color}26` }}
                >
                  {adding === p.key ? (
                    <span className="w-4 h-4 border-2 border-line2 border-t-sub rounded-full animate-spin" />
                  ) : (
                    p.emoji
                  )}
                </span>
                <span className="text-fg text-sm font-medium leading-tight">{t(p.key)}</span>
              </button>
            ))}
          </div>
          <button
            onClick={openCreate}
            className="mt-5 w-full py-3 rounded-2xl border border-dashed border-line2 text-sub text-sm font-medium flex items-center justify-center gap-2 press"
          >
            <Plus className="w-4 h-4" />
            {t('orCreateOwn')}
          </button>
        </div>
      ) : todaysHabits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-faint" />
          </div>
          <h3 className="text-fg font-semibold text-base">{t('noHabits')}</h3>
          <p className="text-muted text-sm mt-1 max-w-xs">{t('noHabitsDesc')}</p>
          <button
            onClick={openCreate}
            className="mt-5 px-5 py-2.5 rounded-xl bg-fg text-app font-medium text-sm hover:opacity-90 press"
          >
            {t('addHabit')}
          </button>
        </div>
      ) : (
        <div ref={pagerRef} className="overflow-x-clip -mx-4 px-4">
          <div ref={trackRef} className="relative" style={{ willChange: 'transform' }}>
            {ORDER.map((v) => {
              const pos = ORDER.indexOf(v) - ORDER.indexOf(view);
              const setRef = (el: HTMLDivElement | null) => {
                if (el) pageRefs.current.set(v, el);
                else pageRefs.current.delete(v);
              };
              return pos === 0 ? (
                <div key={v} ref={setRef}>
                  {renderList(v, true)}
                </div>
              ) : (
                <div
                  key={v}
                  ref={setRef}
                  aria-hidden="true"
                  className="absolute top-0 left-0 w-full pointer-events-none"
                  style={{ transform: `translateX(calc(${pos} * (100% + ${GAP}px)))` }}
                >
                  {renderList(v, false)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {celebrate && <Celebration colors={todaysHabits.map((h) => h.color)} />}

      <CreateHabitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingHabit={editingHabit}
      />

      <NoteSheet habit={noteHabit} onClose={() => setNoteHabit(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
