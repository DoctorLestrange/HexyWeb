import { useEffect, useRef, useState } from 'react';
import { Copy, Download, RefreshCw, Trash2 } from 'lucide-react';
import type { AppLogger } from '../utils/logger';
import { copyTextToClipboard, saveTextToFile } from '../utils/browserIO';
import { Modal } from './Modal';

interface LogsModalProps {
  open: boolean;
  logger: AppLogger;
  onClose: () => void;
  onRequestClearConfirm: (onConfirmed: () => void) => void;
  onNotify: (title: string, message: string) => void;
}

export function LogsModal({
  open,
  logger,
  onClose,
  onRequestClearConfirm,
  onNotify,
}: LogsModalProps) {
  const [content, setContent] = useState('');
  const [entryCount, setEntryCount] = useState(0);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const reload = () => {
    const text = logger.readAll();
    setContent(text);
    setEntryCount(logger.entryCount());
    setStatusFeedback(null);
    requestAnimationFrame(() => {
      if (preRef.current) {
        preRef.current.scrollTop = preRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    if (open) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    if (!content.trim()) {
      onNotify('Nothing to Copy', 'There are no log entries recorded yet.');
      return;
    }
    const ok = await copyTextToClipboard(content);
    setStatusFeedback(ok ? 'Logs copied to clipboard' : 'Unable to access clipboard');
  };

  const handleExport = async () => {
    if (!content.trim()) {
      onNotify('Nothing to Export', 'There are no log entries to export yet.');
      return;
    }
    try {
      const savedName = await saveTextToFile('hexy-logs.txt', content);
      if (savedName) {
        setStatusFeedback(`Exported to ${savedName}`);
      }
    } catch {
      setStatusFeedback('Failed to export logs');
    }
  };

  const handleClear = () => {
    onRequestClearConfirm(() => {
      logger.clear();
      reload();
      setStatusFeedback('Logs cleared');
    });
  };

  return (
    <Modal
      open={open}
      title="Persistent Logs"
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!content.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!content.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export...
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!content.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear Logs
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Close
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span>Stored locally in this browser</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          {statusFeedback && (
            <span className="text-[var(--accent)] font-medium">{statusFeedback}</span>
          )}
        </div>

        <pre
          ref={preRef}
          className="h-80 w-full overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-4 font-mono text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-all"
        >
          {content.trim() ? content : 'No log entries recorded yet.'}
        </pre>
      </div>
    </Modal>
  );
}
