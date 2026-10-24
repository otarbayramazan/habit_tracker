import { Trash2 } from 'lucide-react';
import { useHideNav } from '@/hooks/useHideNav';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  useHideNav(open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl glass-strong p-6 animate-rise"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-fg font-semibold text-lg">{title}</h3>
        <p className="text-muted text-sm mt-1.5">{description}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-elev text-fg2 font-medium text-sm press"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm press disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
