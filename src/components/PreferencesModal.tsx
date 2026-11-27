import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SUPPORTED_ALGORITHMS, type HashAlgorithm } from '../utils/hashUtils';
import {
  DEFAULT_PREFERENCES,
  THEME_OPTIONS,
  type AppTheme,
  type PreferencesData,
} from '../utils/preferences';
import { Modal } from './Modal';

interface PreferencesModalProps {
  open: boolean;
  preferences: PreferencesData;
  onClose: () => void;
  onSave: (next: PreferencesData) => void;
}

export function PreferencesModal({ open, preferences, onClose, onSave }: PreferencesModalProps) {
  const [draft, setDraft] = useState<PreferencesData>(preferences);

  useEffect(() => {
    if (open) {
      setDraft(preferences);
    }
  }, [open, preferences]);

  const handleReset = () => {
    setDraft({ ...DEFAULT_PREFERENCES });
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Preferences"
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={handleReset}
            className="mr-auto px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-2 sm:gap-3">
          <label htmlFor="pref-theme" className="text-sm font-medium text-[var(--text-secondary)]">
            Default Theme
          </label>
          <div className="relative">
            <select
              id="pref-theme"
              value={draft.theme}
              onChange={(e) => setDraft((prev) => ({ ...prev, theme: e.target.value as AppTheme }))}
              className="h-10 w-full appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] pl-3 pr-9 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-2 sm:gap-3">
          <label htmlFor="pref-algo" className="text-sm font-medium text-[var(--text-secondary)]">
            Default Algorithm
          </label>
          <div className="relative">
            <select
              id="pref-algo"
              value={draft.defaultAlgorithm}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, defaultAlgorithm: e.target.value as HashAlgorithm }))
              }
              className="h-10 w-full appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] pl-3 pr-9 text-sm font-mono text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
            >
              {SUPPORTED_ALGORITHMS.map((algo) => (
                <option key={algo} value={algo}>
                  {algo}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.uppercaseOutput}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, uppercaseOutput: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-sm text-[var(--text-primary)]">
              Display calculated hashes in uppercase
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.loggingEnabled}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, loggingEnabled: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-sm text-[var(--text-primary)]">
              Enable persistent activity logging (stored locally in browser)
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.showResultDialogs}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, showResultDialogs: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-sm text-[var(--text-primary)]">
              Show verification result popups
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
