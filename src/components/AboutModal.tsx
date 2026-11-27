import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { APP_VERSION, DEVELOPER_NAME, GITHUB_URL } from '../utils/preferences';
import { copyTextToClipboard } from '../utils/browserIO';
import { Modal } from './Modal';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
      setCopiedUrl(false);
    }
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, [open]);

  const handleCopyUrl = async () => {
    const ok = await copyTextToClipboard(GITHUB_URL);
    if (ok) {
      setCopiedUrl(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedUrl(false);
        copyTimerRef.current = null;
      }, 1800);
    }
  };

  return (
    <Modal
      open={open}
      title="About Hexy"
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Close
        </button>
      }
    >
      <div className="flex flex-col items-center text-center space-y-3 py-1">
        {!iconFailed ? (
          <img
            src={`${import.meta.env.BASE_URL}icon.png`}
            alt="Hexy application icon"
            width={64}
            height={64}
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
            className="h-16 w-16 select-none"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-white text-2xl font-bold font-mono"
          >
            #
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Hexy</h3>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5 tabular-nums">
            Version {APP_VERSION} · Web Edition
          </p>
        </div>

        <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
          Lightweight, privacy-first file hashing and integrity verification utility. All
          cryptographic calculations run locally inside your browser — zero data leaves your device.
        </p>

        <div className="w-full pt-3 border-t border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-secondary)]">
          <p>
            Developer:{' '}
            <span className="font-medium text-[var(--text-primary)]">{DEVELOPER_NAME}</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline font-medium"
            >
              <span>{GITHUB_URL}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={handleCopyUrl}
              aria-label="Copy GitHub repository URL"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copiedUrl ? (
                <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-[var(--text-muted)]">Licensed under the MIT License</p>
        </div>
      </div>
    </Modal>
  );
}
