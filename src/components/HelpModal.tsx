import { useState } from 'react';
import { ALGORITHM_INFO_LIST } from '../utils/hashUtils';
import { Modal } from './Modal';

interface HelpModalProps {
  open: boolean;
  shortcutLabel: string;
  onClose: () => void;
}

export function HelpModal({ open, shortcutLabel, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'algorithms'>('guide');

  return (
    <Modal
      open={open}
      title="How to Use Hexy"
      onClose={onClose}
      maxWidthClass="max-w-2xl"
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
      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="Help sections"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-inset)] p-1 border border-[var(--border-subtle)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guide'}
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Usage &amp; Shortcuts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'algorithms'}
            onClick={() => setActiveTab('algorithms')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'algorithms'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Supported Algorithms (26)
          </button>
        </div>

        {activeTab === 'guide' ? (
          <div className="space-y-5 text-sm leading-relaxed text-[var(--text-secondary)]">
            <div className="space-y-3.5">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">1. Select a File</h3>
                <p className="mt-0.5">
                  Click <strong className="text-[var(--text-primary)]">Browse</strong> (or{' '}
                  <strong className="text-[var(--text-primary)]">File → Open...</strong>), or drag
                  and drop a file directly onto the window. All hashing happens strictly inside your
                  browser using streaming chunks — files never leave your device.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">2. Calculate a Hash</h3>
                <p className="mt-0.5">
                  Leave <strong className="text-[var(--text-primary)]">Expected Hash</strong> empty,
                  pick an algorithm, and click{' '}
                  <strong className="text-[var(--text-primary)]">Calculate &amp; Verify Hash</strong>{' '}
                  (or press <strong className="text-[var(--text-primary)]">Enter</strong>). Use{' '}
                  <strong className="text-[var(--text-primary)]">Copy</strong> or{' '}
                  <strong className="text-[var(--text-primary)]">File → Save Hash...</strong> to
                  copy or save the result.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">
                  3. Verify File Integrity
                </h3>
                <p className="mt-0.5">
                  Paste the expected hash into{' '}
                  <strong className="text-[var(--text-primary)]">Expected Hash</strong>. Hexy
                  accepts lowercase/uppercase hex, space-separated hex,{' '}
                  <code className="px-1 py-0.5 rounded bg-[var(--bg-inset)] text-xs text-[var(--text-primary)]">
                    0x
                  </code>{' '}
                  prefix, colon-separated byte hex, and standard or URL-safe Base64 digests (raw
                  bytes or ASCII hex).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">
                  4. Auto-Detect Algorithm
                </h3>
                <p className="mt-0.5">
                  Uncheck <strong className="text-[var(--text-primary)]">Select Hash Algorithm</strong>{' '}
                  and provide an expected hash to automatically test all algorithms matching its
                  digest length.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">
                  5. Preferences &amp; Persistent Logs
                </h3>
                <p className="mt-0.5">
                  Use <strong className="text-[var(--text-primary)]">Edit → Preferences...</strong>{' '}
                  to configure your default theme, default algorithm, hash case, and popup options.
                  Use <strong className="text-[var(--text-primary)]">Edit → Logs...</strong> to
                  inspect, copy, export, or clear local browser activity logs.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                Keyboard Shortcuts
              </h3>
              <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {[
                      [`${shortcutLabel}+O`, 'Open file'],
                      [`${shortcutLabel}+S`, 'Save calculated hash to file'],
                      [`${shortcutLabel}+,`, 'Open Preferences'],
                      [`${shortcutLabel}+L`, 'View persistent logs'],
                      ['Enter', 'Calculate & Verify Hash'],
                      ['F1', 'Show How to Use'],
                    ].map(([keys, desc]) => (
                      <tr key={keys} className="bg-[var(--bg-inset)]/50">
                        <td className="px-3.5 py-2 font-mono font-medium text-[var(--text-primary)] w-32">
                          {keys}
                        </td>
                        <td className="px-3.5 py-2 text-[var(--text-secondary)]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-secondary)]">
                  <th className="px-3.5 py-2.5 font-semibold">Algorithm</th>
                  <th className="px-3.5 py-2.5 font-semibold">Family</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right">Digest Size</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right">Hex Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {ALGORITHM_INFO_LIST.map((info) => (
                  <tr
                    key={info.name}
                    className="hover:bg-[var(--bg-hover)]/60 transition-colors"
                  >
                    <td className="px-3.5 py-2 font-mono font-medium text-[var(--text-primary)]">
                      {info.name}
                    </td>
                    <td className="px-3.5 py-2 text-[var(--text-secondary)]">{info.family}</td>
                    <td className="px-3.5 py-2 font-mono text-right text-[var(--text-secondary)] tabular-nums">
                      {info.bits}-bit
                    </td>
                    <td className="px-3.5 py-2 font-mono text-right text-[var(--text-secondary)] tabular-nums">
                      {info.hexLength} chars
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
