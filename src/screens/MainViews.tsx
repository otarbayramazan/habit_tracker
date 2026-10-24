import { useState, useRef, useEffect, useCallback } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useSettings } from '@/context/SettingsContext';
import { LOCALES, useT } from '@/lib/i18n';
import { HabitCard } from '@/components/HabitCard';
import { CreateHabitModal } from '@/screens/CreateHabitModal';
import { NoteSheet } from '@/components/NoteSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, CalendarDays, Check } from 'lucide-react';
import { isScheduledOn, isCompletedOn } from '@/lib/dateUtils';
import type { HabitWithCompletions } from '@/lib/supabase';
import type { Language } from '@/context/SettingsContext';

type ViewType = 'week' | 'month' | 'year';

export function MainViews({ view }: { view: ViewType }) {
  const { habits, loading, toggleCompletion, reorderHabits, deleteHabit } = useHabits();
  const { language } = useSettings();
  const t = useT(language as Language);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithCompletions | null>(null);
  const [jiggleMode, setJiggleMode] = useState(false);
  const [noteHabit, setNoteHabit] = useState<HabitWithCompletions | null>(null);
  const [deleting, setDeleting] = useState<HabitWithCompletions | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const dateLabel = now.toLocaleDateString(LOCALES[language], {
    month: 'long',
    year: 'numeric',
  });

  const todaysHabits = habits.filter((h) =>
    isScheduledOn(now, h.frequency_type ?? 'everyday', h.frequency_days ?? [])
  );

  // Сводка на сегодня: сколько запланированных на сегодня привычек уже выполнено
  const doneToday = todaysHabits.filter((h) =>
    isCompletedOn(now, h.completions, h.target_count, h.frequency_type ?? 'everyday', h.frequency_days ?? [])
  ).length;
  const totalToday = todaysHabits.length;
  const allDone = totalToday > 0 && doneToday === totalToday;

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

  // Exit jiggle mode
  const exitJiggleMode = useCallback(() => {
    setJiggleMode(false);
    setDraggingId(null);
    setDragOverId(null);
    dragIdRef.current = null;
  }, []);

  // Esc to exit jiggle mode
  useEffect(() => {
    if (!jiggleMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitJiggleMode();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [jiggleMode, exitJiggleMode]);

  // Drag handlers
  const handleDragStart = (e: React.PointerEvent, id: string) => {
    if (!jiggleMode) return;
    e.preventDefault();
    dragIdRef.current = id;
    setDraggingId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleDragOver = (e: React.PointerEvent, id: string) => {
    if (!jiggleMode || !dragIdRef.current || dragIdRef.current === id) return;
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (e: React.PointerEvent, targetId: string) => {
    e.preventDefault();
    const dragId = dragIdRef.current;
    if (!dragId || dragId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      dragIdRef.current = null;
      return;
    }

    const ids = todaysHabits.map((h) => h.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Reorder the array
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);

    // Build full ordered list preserving non-today habits at the end
    const todaySet = new Set(todaysHabits.map((h) => h.id));
    const otherIds = habits.filter((h) => !todaySet.has(h.id)).map((h) => h.id);
    reorderHabits([...ids, ...otherIds]);

    setDraggingId(null);
    setDragOverId(null);
    dragIdRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    dragIdRef.current = null;
  };

  // Click outside cards to exit jiggle mode
  const handleContainerClick = (e: React.MouseEvent) => {
    if (!jiggleMode) return;
    // If the click target is the container itself (not a card), exit
    if (e.target === containerRef.current) {
      exitJiggleMode();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="px-4 pt-6 pb-32 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${totalToday > 0 ? 'mb-4' : 'mb-6'}`}>
        <div>
          <h1 className="text-2xl font-bold text-fg capitalize">{t(view)}</h1>
          <p className="text-muted text-sm flex items-center gap-1.5 mt-0.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {jiggleMode && (
            <button
              onClick={exitJiggleMode}
              className="h-11 px-4 rounded-xl bg-fg text-app flex items-center text-sm font-semibold transition-all active:scale-95"
            >
              {t('done')}
            </button>
          )}
          {!jiggleMode && (
            <button
              onClick={openCreate}
              className="w-11 h-11 rounded-xl bg-fg text-app flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

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

      {/* Habits */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-line2 border-t-sub rounded-full animate-spin" />
          <p className="text-muted text-sm mt-3">{t('loadingHabits')}</p>
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
        <div className={view === 'month' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
          {todaysHabits.map((habit, idx) => {
            const isDragging = draggingId === habit.id;
            const isDragOver = dragOverId === habit.id && !isDragging;
            return (
              <div
                key={habit.id}
                onPointerOver={(e) => handleDragOver(e, habit.id)}
                onPointerUp={(e) => handleDrop(e, habit.id)}
                onPointerCancel={handleDragEnd}
                className={`card-rise ${isDragOver ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}
                style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
              >
                <HabitCard
                  habit={habit}
                  view={view}
                  onToggle={toggleCompletion}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onNote={setNoteHabit}
                  jiggleMode={jiggleMode}
                  jiggleIndex={idx}
                  isDragging={isDragging}
                  onLongPress={() => setJiggleMode(true)}
                  onDragStart={(e) => handleDragStart(e, habit.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Invisible backdrop in jiggle mode for tap-outside-to-exit */}
      {jiggleMode && (
        <div
          className="fixed inset-0 -z-10"
          onClick={exitJiggleMode}
        />
      )}

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
