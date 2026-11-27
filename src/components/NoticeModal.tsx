import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Modal } from './Modal';

export type NoticeVariant = 'success' | 'warning' | 'error' | 'info' | 'confirm';

export interface NoticeState {
  variant: NoticeVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

interface NoticeModalProps {
  notice: NoticeState | null;
  onClose: () => void;
}

export function NoticeModal({ notice, onClose }: NoticeModalProps) {
  if (!notice) {
    return null;
  }

  const iconMap = {
    success: <CheckCircle2 className="h-5 w-5 text-[var(--success)] shrink-0 mt-0.5" aria-hidden="true" />,
    warning: <AlertTriangle className="h-5 w-5 text-[var(--warning)] shrink-0 mt-0.5" aria-hidden="true" />,
    error: <XCircle className="h-5 w-5 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden="true" />,
    info: <Info className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" aria-hidden="true" />,
    confirm: <AlertTriangle className="h-5 w-5 text-[var(--warning)] shrink-0 mt-0.5" aria-hidden="true" />,
  };

  return (
    <Modal
      open={Boolean(notice)}
      title={notice.title}
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={
        notice.variant === 'confirm' ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                notice.onConfirm?.();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--danger)] text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
            >
              {notice.confirmLabel ?? 'Confirm'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            OK
          </button>
        )
      }
    >
      <div className="flex items-start gap-3.5">
        {iconMap[notice.variant]}
        <p className="text-sm leading-relaxed text-[var(--text-primary)] break-words whitespace-pre-line">
          {notice.message}
        </p>
      </div>
    </Modal>
  );
}
