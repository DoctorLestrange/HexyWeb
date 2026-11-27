import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  File as FileIcon,
  FolderOpen,
  Hash,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  SUPPORTED_ALGORITHMS,
  describeLengthMismatch,
  formatFileSize,
  formatHashForDisplay,
  getExpectedHexLength,
  getProbableHashAlgorithms,
  isHex,
  parseExpectedHash,
  suggestSaveFileName,
  type HashAlgorithm,
} from './utils/hashUtils';
import {
  APP_VERSION,
  THEME_OPTIONS,
  loadPreferences,
  savePreferences,
  type AppTheme,
  type PreferencesData,
} from './utils/preferences';
import { AppLogger } from './utils/logger';
import { copyTextToClipboard, readTextFromClipboard, saveTextToFile } from './utils/browserIO';
import type { HashWorkerInbound, HashWorkerOutbound } from './workers/hash.worker';
import { MenuBar } from './components/MenuBar';
import { PreferencesModal } from './components/PreferencesModal';
import { LogsModal } from './components/LogsModal';
import { HelpModal } from './components/HelpModal';
import { AboutModal } from './components/AboutModal';
import { NoticeModal, type NoticeState } from './components/NoticeModal';

type ProgressTone = 'idle' | 'working' | 'match' | 'mismatch' | 'done' | 'error';

let hasLoggedAppStartup = false;

export function App() {
  const [preferences, setPreferences] = useState<PreferencesData>(() => loadPreferences());
  const loggerRef = useRef<AppLogger | null>(null);
  if (!loggerRef.current) {
    loggerRef.current = new AppLogger(preferences.loggingEnabled);
  }

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expectedHashInput, setExpectedHashInput] = useState('');
  const [selectAlgoEnabled, setSelectAlgoEnabled] = useState(true);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<HashAlgorithm>(
    preferences.defaultAlgorithm
  );

  const [rawCalculatedHash, setRawCalculatedHash] = useState('');
  const [lastCalculatedFileName, setLastCalculatedFileName] = useState<string | null>(null);
  const [lastCalculatedAlgo, setLastCalculatedAlgo] = useState<HashAlgorithm | null>(null);

  const [isHashing, setIsHashing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Ready');
  const [progressTone, setProgressTone] = useState<ProgressTone>('idle');

  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedBriefly, setCopiedBriefly] = useState(false);
  const [inlineHint, setInlineHint] = useState<string | null>(null);

  // Modals
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  // Refs for worker, preferences, timers & DOM controls
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expectedHashRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef(0);
  const silentCancelRef = useRef(false);
  const dragDepthRef = useRef(0);
  const activeRunMetaRef = useRef<{
    fileName: string;
    algorithms: HashAlgorithm[];
    expectedHex: string | null;
    fromBase64: boolean;
  } | null>(null);

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  }, []);
  const shortcutLabel = isMac ? 'Cmd' : 'Ctrl';

  // Apply Dark Graphite / Light Off-White class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  // Log startup once per session (avoids React StrictMode double entry)
  useEffect(() => {
    if (!hasLoggedAppStartup) {
      hasLoggedAppStartup = true;
      loggerRef.current?.info(`Hexy started (version ${APP_VERSION})`);
    }
  }, []);

  // Clean up worker & timers on unmount
  useEffect(() => {
    return () => {
      activeJobIdRef.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, []);

  const displayedCalculatedHash = useMemo(
    () => formatHashForDisplay(rawCalculatedHash, preferences.uppercaseOutput),
    [rawCalculatedHash, preferences.uppercaseOutput]
  );

  // Quiet live parser preview for Expected Hash (purely informational unboxed helper text)
  const expectedHashPreview = useMemo<{ text: string; tone: 'muted' | 'warning' } | null>(() => {
    const trimmed = expectedHashInput.trim();
    if (!trimmed) return null;
    try {
      const parsed = parseExpectedHash(trimmed);
      if (!parsed) return null;
      const matches = getProbableHashAlgorithms(parsed.hexHash);
      const countLabel =
        matches.length === 1
          ? matches[0]
          : `${matches.length} algorithms (${matches.slice(0, 3).join(', ')}${matches.length > 3 ? ', ...' : ''})`;
      const prefix = parsed.fromBase64
        ? `Base64 decoded to ${parsed.hexHash.length} hex chars`
        : `${parsed.hexHash.length} hex chars`;

      if (selectAlgoEnabled && !matches.includes(selectedAlgorithm)) {
        const expectedLen = getExpectedHexLength(selectedAlgorithm);
        return {
          text: `${prefix} (${matches.join(', ')}) — does not match selected ${selectedAlgorithm} (${expectedLen} hex chars)`,
          tone: 'warning',
        };
      }

      return {
        text: `${prefix} · Compatible with ${countLabel}`,
        tone: 'muted',
      };
    } catch {
      const stripped = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
      const hexCandidate =
        stripped.startsWith('0x') || stripped.startsWith('0X')
          ? stripped.slice(2)
          : stripped.includes(':')
            ? stripped.replace(/:/g, '')
            : stripped;
      if (hexCandidate.length > 0 && isHex(hexCandidate)) {
        return {
          text: `${hexCandidate.length} hex chars — expected 8, 32, 40, 56, 64, 96, or 128`,
          tone: 'muted',
        };
      }
      return {
        text: `${stripped.length} characters entered — enter hexadecimal or Base64 hash`,
        tone: 'muted',
      };
    }
  }, [expectedHashInput, selectAlgoEnabled, selectedAlgorithm]);

  const resetResultDisplay = useCallback(() => {
    setRawCalculatedHash('');
    setLastCalculatedFileName(null);
    setLastCalculatedAlgo(null);
    setProgressPercent(0);
    setProgressLabel('Ready');
    setProgressTone('idle');
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
    setCopiedBriefly(false);
    setInlineHint(null);
  }, []);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const handleFileChosen = useCallback(
    (file: File | null) => {
      if (isHashing) return;
      setSelectedFile(file);
      resetResultDisplay();
    },
    [isHashing, resetResultDisplay]
  );

  const openFilePicker = useCallback(() => {
    if (isHashing) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [isHashing]);

  const updateTheme = useCallback((nextTheme: AppTheme) => {
    setPreferences((prev) => {
      if (prev.theme === nextTheme) return prev;
      const updated = { ...prev, theme: nextTheme };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    updateTheme(preferences.theme === 'dark' ? 'light' : 'dark');
  }, [preferences.theme, updateTheme]);

  const handleSavePreferences = useCallback(
    (next: PreferencesData) => {
      setPreferences(next);
      savePreferences(next);
      loggerRef.current?.setEnabled(next.loggingEnabled);

      // Mirror Java Hexy: if idle and no file/hash active, update active algorithm to new default
      if (!isHashing && !rawCalculatedHash && !selectedFile) {
        setSelectedAlgorithm(next.defaultAlgorithm);
      }
    },
    [isHashing, rawCalculatedHash, selectedFile]
  );

  const handlePasteExpectedHash = useCallback(async () => {
    if (isHashing) return;
    setInlineHint(null);
    const result = await readTextFromClipboard();
    if (result.status === 'ok') {
      setExpectedHashInput(result.text);
      resetResultDisplay();
      return;
    }
    if (result.status === 'empty') {
      setProgressLabel('Clipboard has no text');
      setProgressTone('idle');
      return;
    }
    // Browser / iframe blocked navigator.clipboard.readText()
    expectedHashRef.current?.focus();
    setInlineHint(
      `Browser blocked direct clipboard read — press ${shortcutLabel}+V in the Expected Hash field.`
    );
  }, [isHashing, resetResultDisplay, shortcutLabel]);

  const handleCopyCalculatedHash = useCallback(async () => {
    if (!displayedCalculatedHash) return;
    const ok = await copyTextToClipboard(displayedCalculatedHash);
    if (ok) {
      setCopiedBriefly(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopiedBriefly(false);
        copiedTimerRef.current = null;
      }, 1800);
      if (!isHashing) {
        setProgressLabel('Copied hash to clipboard');
      }
    } else {
      loggerRef.current?.error('Copy to clipboard failed', 'Clipboard access denied');
      setNotice({
        variant: 'error',
        title: 'Error',
        message: 'Could not copy hash to clipboard. Select the hash text and copy manually.',
      });
    }
  }, [displayedCalculatedHash, isHashing]);

  const handleSaveHashToFile = useCallback(async () => {
    if (!displayedCalculatedHash) {
      setNotice({
        variant: 'info',
        title: 'Nothing to Save',
        message: 'Calculate a hash first before saving.',
      });
      return;
    }
    try {
      const suggested = suggestSaveFileName(lastCalculatedFileName, lastCalculatedAlgo);
      const savedName = await saveTextToFile(suggested, `${displayedCalculatedHash}\n`);
      if (savedName) {
        loggerRef.current?.hashSaved(savedName);
        if (!isHashing) {
          setProgressLabel(`Saved hash to ${savedName}`);
        }
      }
    } catch (err) {
      loggerRef.current?.error('Save hash failed', err);
      setNotice({
        variant: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save hash to file.',
      });
    }
  }, [displayedCalculatedHash, isHashing, lastCalculatedAlgo, lastCalculatedFileName]);

  const handleJobEvent = useCallback(
    (msg: HashWorkerOutbound, fallbackAlgo: HashAlgorithm) => {
      if (msg.jobId !== activeJobIdRef.current) {
        return;
      }
      const meta = activeRunMetaRef.current;

      if (msg.type === 'progress') {
        setProgressPercent(msg.percent);
        const multi = (meta?.algorithms.length ?? 1) > 1;
        setProgressLabel(multi ? `${msg.algorithm}: ${msg.percent}%` : `${msg.percent}%`);
        return;
      }

      // Terminal states
      setIsHashing(false);
      terminateWorker();

      if (msg.type === 'cancelled') {
        setProgressPercent(0);
        setProgressLabel('Cancelled');
        setProgressTone('idle');
        setRawCalculatedHash('');
        setLastCalculatedFileName(null);
        setLastCalculatedAlgo(null);
        if (meta) {
          loggerRef.current?.cancelled(meta.fileName);
        }
        if (!silentCancelRef.current) {
          setNotice({
            variant: 'info',
            title: 'Cancelled',
            message: 'Operation cancelled.',
          });
        }
        return;
      }

      if (msg.type === 'error') {
        setProgressPercent(0);
        setProgressLabel('Error');
        setProgressTone('error');
        setRawCalculatedHash('');
        setLastCalculatedFileName(null);
        setLastCalculatedAlgo(null);
        loggerRef.current?.error(
          `Hashing failed for ${meta?.fileName ?? 'file'}`,
          new Error(msg.message)
        );
        setNotice({
          variant: 'error',
          title: 'Error',
          message: msg.message,
        });
        return;
      }

      if (msg.type === 'done') {
        const latestPrefs = preferencesRef.current;
        setProgressPercent(100);
        setRawCalculatedHash(msg.displayHash);
        setLastCalculatedFileName(meta?.fileName ?? null);
        const resolvedAlgo = msg.matched ? msg.matchedAlgo : msg.lastAlgo;
        setLastCalculatedAlgo(resolvedAlgo);

        const formattedHash = formatHashForDisplay(msg.displayHash, latestPrefs.uppercaseOutput);

        if (meta?.expectedHex) {
          const formatNote = meta.fromBase64 ? ' (decoded from Base64)' : '';
          if (msg.matched && msg.matchedAlgo) {
            setProgressLabel(`Match (${msg.matchedAlgo})`);
            setProgressTone('match');
            loggerRef.current?.verificationSucceeded(
              meta.fileName,
              msg.matchedAlgo,
              formattedHash
            );
            if (latestPrefs.showResultDialogs) {
              setNotice({
                variant: 'success',
                title: 'Verification Succeeded',
                message: `Your entered hash${formatNote} matches the calculated ${msg.matchedAlgo} hash.`,
              });
            }
          } else {
            setProgressLabel('Mismatch');
            setProgressTone('mismatch');
            const testedList = meta.algorithms.join(', ');
            loggerRef.current?.verificationFailed(
              meta.fileName,
              testedList,
              formatHashForDisplay(meta.expectedHex, latestPrefs.uppercaseOutput),
              formattedHash
            );
            if (latestPrefs.showResultDialogs) {
              const tested =
                meta.algorithms.length > 1
                  ? `any of the matching algorithms (${testedList})`
                  : `the calculated ${msg.lastAlgo} hash`;
              setNotice({
                variant: 'warning',
                title: 'Verification Failed',
                message: `Your entered hash${formatNote} did not match ${tested}. The file may be corrupted or modified.`,
              });
            }
          }
        } else {
          const doneAlgo = msg.lastAlgo ?? fallbackAlgo;
          setProgressLabel(`Done (${doneAlgo})`);
          setProgressTone('done');
          loggerRef.current?.hashCalculated(meta?.fileName ?? 'file', doneAlgo, formattedHash);
        }
      }
    },
    [terminateWorker]
  );

  const runMainThreadFallback = useCallback(
    async (
      jobId: number,
      file: File,
      algorithms: HashAlgorithm[],
      expectedHex: string | null,
      fallbackAlgo: HashAlgorithm
    ) => {
      const isCancelled = () => activeJobIdRef.current !== jobId;
      let formatErrorFn: ((err: unknown) => string) | null = null;
      try {
        const engine = await import('./utils/hashEngine');
        formatErrorFn = engine.formatHashError;
        if (isCancelled()) return;

        let lastAlgo: HashAlgorithm | null = null;
        let lastHash = '';

        for (const algo of algorithms) {
          if (isCancelled()) return;

          handleJobEvent(
            {
              type: 'progress',
              jobId,
              algorithm: algo,
              percent: 0,
              bytesRead: 0,
              totalBytes: file.size,
            },
            fallbackAlgo
          );

          const hashResult = await engine.calculateBlobHash(
            file,
            algo,
            isCancelled,
            (bytesRead, totalBytes, percent) => {
              if (!isCancelled()) {
                handleJobEvent(
                  {
                    type: 'progress',
                    jobId,
                    algorithm: algo,
                    percent,
                    bytesRead,
                    totalBytes,
                  },
                  fallbackAlgo
                );
              }
            },
            engine.STREAM_CHUNK_SIZE,
            true
          );

          if (isCancelled() || hashResult === null) {
            return;
          }

          lastAlgo = algo;
          lastHash = hashResult;

          if (expectedHex && expectedHex.toLowerCase() === hashResult.toLowerCase()) {
            handleJobEvent(
              {
                type: 'done',
                jobId,
                matched: true,
                matchedAlgo: algo,
                lastAlgo: algo,
                displayHash: hashResult,
              },
              fallbackAlgo
            );
            return;
          }
        }

        handleJobEvent(
          {
            type: 'done',
            jobId,
            matched: false,
            matchedAlgo: null,
            lastAlgo,
            displayHash: lastHash,
          },
          fallbackAlgo
        );
      } catch (err) {
        if (isCancelled()) return;
        const message = formatErrorFn
          ? formatErrorFn(err)
          : err instanceof Error && err.message
            ? err.message
            : 'Hashing failed.';
        handleJobEvent(
          {
            type: 'error',
            jobId,
            message,
          },
          fallbackAlgo
        );
      }
    },
    [handleJobEvent]
  );

  const handleCalculateAndVerify = useCallback(() => {
    if (isHashing) return;
    setInlineHint(null);

    try {
      if (!selectedFile) {
        throw new Error('Please select a file or drag and drop a file to hash.');
      }

      const parsedExpected = parseExpectedHash(expectedHashInput);

      if (!parsedExpected && !selectAlgoEnabled) {
        throw new Error(
          'Please select a hash algorithm, or enter an expected hash to auto-detect matching algorithms.'
        );
      }

      let algorithms: HashAlgorithm[];
      if (selectAlgoEnabled) {
        if (parsedExpected) {
          const probable = getProbableHashAlgorithms(parsedExpected.hexHash);
          if (!probable.includes(selectedAlgorithm)) {
            throw new Error(
              describeLengthMismatch(
                parsedExpected.hexHash,
                selectedAlgorithm,
                parsedExpected.fromBase64
              )
            );
          }
        }
        algorithms = [selectedAlgorithm];
      } else {
        algorithms = getProbableHashAlgorithms(parsedExpected!.hexHash);
        if (algorithms.length === 0) {
          throw new Error('No supported algorithm matches the entered hash length.');
        }
      }

      // Prepare hashing run
      terminateWorker();
      const jobId = activeJobIdRef.current + 1;
      activeJobIdRef.current = jobId;
      silentCancelRef.current = false;

      const expectedHex = parsedExpected ? parsedExpected.hexHash : null;
      const fromBase64 = Boolean(parsedExpected?.fromBase64);
      const currentAlgo = selectedAlgorithm;
      const targetFile = selectedFile;

      activeRunMetaRef.current = {
        fileName: targetFile.name,
        algorithms,
        expectedHex,
        fromBase64,
      };

      setRawCalculatedHash('');
      setLastCalculatedFileName(null);
      setLastCalculatedAlgo(null);
      setIsHashing(true);
      setProgressPercent(0);
      setProgressTone('working');
      setProgressLabel(fromBase64 ? 'Base64 decoded -> 0%' : '0%');

      if (typeof Worker === 'undefined') {
        void runMainThreadFallback(jobId, targetFile, algorithms, expectedHex, currentAlgo);
        return;
      }

      let worker: Worker;
      try {
        worker = new Worker(new URL('./workers/hash.worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch {
        void runMainThreadFallback(jobId, targetFile, algorithms, expectedHex, currentAlgo);
        return;
      }

      workerRef.current = worker;
      let workerStarted = false;

      worker.onmessage = (event: MessageEvent<HashWorkerOutbound>) => {
        workerStarted = true;
        handleJobEvent(event.data, currentAlgo);
      };

      worker.onerror = (err) => {
        if (jobId !== activeJobIdRef.current) return;
        terminateWorker();
        if (!workerStarted) {
          // Module worker blocked or failed to initialize (e.g., strict CSP/older browser) -> fall back transparently
          err.preventDefault?.();
          void runMainThreadFallback(jobId, targetFile, algorithms, expectedHex, currentAlgo);
          return;
        }
        const message = err.message || 'Hashing worker encountered an error.';
        handleJobEvent({ type: 'error', jobId, message }, currentAlgo);
      };

      const startPayload: HashWorkerInbound = {
        type: 'start',
        jobId,
        file: targetFile,
        algorithms,
        expectedHex,
      };
      worker.postMessage(startPayload);
    } catch (err) {
      loggerRef.current?.error('Validation failed', err);
      setNotice({
        variant: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Validation failed.',
      });
    }
  }, [
    expectedHashInput,
    handleJobEvent,
    isHashing,
    runMainThreadFallback,
    selectAlgoEnabled,
    selectedAlgorithm,
    selectedFile,
    terminateWorker,
  ]);

  const handleCancel = useCallback(() => {
    if (!isHashing) {
      resetResultDisplay();
      return;
    }
    silentCancelRef.current = false;
    setProgressLabel('Cancelling...');
    const jobId = activeJobIdRef.current;
    // Invalidate current job & terminate worker immediately for instant cancellation even on large files
    activeJobIdRef.current += 1;
    terminateWorker();
    setIsHashing(false);
    setProgressPercent(0);
    setProgressLabel('Cancelled');
    setProgressTone('idle');
    setRawCalculatedHash('');
    setLastCalculatedFileName(null);
    setLastCalculatedAlgo(null);
    const meta = activeRunMetaRef.current;
    if (meta && jobId > 0) {
      loggerRef.current?.cancelled(meta.fileName);
    }
    setNotice({
      variant: 'info',
      title: 'Cancelled',
      message: 'Operation cancelled.',
    });
  }, [isHashing, resetResultDisplay, terminateWorker]);

  const handleClearAll = useCallback(() => {
    if (isHashing) {
      silentCancelRef.current = true;
      activeJobIdRef.current += 1;
      terminateWorker();
      setIsHashing(false);
      if (activeRunMetaRef.current) {
        loggerRef.current?.cancelled(activeRunMetaRef.current.fileName);
      }
    }
    setSelectedFile(null);
    setExpectedHashInput('');
    setSelectAlgoEnabled(true);
    setSelectedAlgorithm(preferences.defaultAlgorithm);
    resetResultDisplay();
  }, [isHashing, preferences.defaultAlgorithm, resetResultDisplay, terminateWorker]);

  // Global keyboard shortcuts mirroring Java Hexy (Ctrl/Cmd+O, S, ,, L, F1, Enter)
  const anyModalOpen = prefsOpen || logsOpen || helpOpen || aboutOpen || Boolean(notice);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'F1') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (mod && !e.shiftKey && !e.altKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'o') {
          e.preventDefault();
          if (!anyModalOpen) openFilePicker();
          return;
        }
        if (lower === 's') {
          e.preventDefault();
          if (!anyModalOpen && displayedCalculatedHash && !isHashing) {
            void handleSaveHashToFile();
          }
          return;
        }
        if (e.key === ',') {
          e.preventDefault();
          setPrefsOpen(true);
          return;
        }
        if (lower === 'l') {
          e.preventDefault();
          setLogsOpen(true);
          return;
        }
      }

      if (e.key === 'Enter' && !anyModalOpen && !isHashing) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const role = target?.getAttribute?.('role');
        // Let buttons, links, selects, menus, and textareas handle Enter natively
        if (
          tag !== 'BUTTON' &&
          tag !== 'A' &&
          tag !== 'TEXTAREA' &&
          tag !== 'SELECT' &&
          role !== 'menuitem' &&
          !target?.isContentEditable
        ) {
          e.preventDefault();
          handleCalculateAndVerify();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    anyModalOpen,
    displayedCalculatedHash,
    handleCalculateAndVerify,
    handleSaveHashToFile,
    isHashing,
    isMac,
    openFilePicker,
  ]);

  // Window-wide Drag and Drop support (mirrors Java DropTarget on contentPane)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHashing || anyModalOpen) return;
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current += 1;
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHashing || anyModalOpen) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (isHashing || anyModalOpen) return;

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const firstItem = items[0];
      const entry =
        typeof firstItem.webkitGetAsEntry === 'function' ? firstItem.webkitGetAsEntry() : null;
      if (entry && entry.isDirectory) {
        const errMsg = `The dropped item "${entry.name}" is a folder, not a regular file.`;
        loggerRef.current?.error('File drop rejected', new Error(errMsg));
        setNotice({
          variant: 'error',
          title: 'Error',
          message: errMsg,
        });
        return;
      }
    }

    const files = e.dataTransfer.files;
    const file = files?.[0];
    if (file) {
      handleFileChosen(file);
      if (files.length > 1) {
        setInlineHint(
          `Multiple files dropped — loaded "${file.name}" (Hexy hashes one file at a time).`
        );
      }
    }
  };

  const progressBarFillClass = useMemo(() => {
    switch (progressTone) {
      case 'match':
        return 'bg-[var(--success)]';
      case 'mismatch':
        return 'bg-[var(--warning)]';
      case 'error':
        return 'bg-[var(--danger)]';
      case 'done':
      case 'working':
      default:
        return 'bg-[var(--accent)]';
    }
  }, [progressTone]);

  const progressTextClass = useMemo(() => {
    if (progressTone === 'working' && progressPercent > 52) {
      return 'text-white';
    }
    if (progressTone === 'match') return 'text-[var(--success)]';
    if (progressTone === 'mismatch') return 'text-[var(--warning)]';
    if (progressTone === 'error') return 'text-[var(--danger)]';
    return 'text-[var(--text-primary)]';
  }, [progressPercent, progressTone]);

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Select file to hash"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) {
            handleFileChosen(file);
          }
        }}
      />

      {/* Top Navigation & Menu Bar */}
      <MenuBar
        theme={preferences.theme}
        isHashing={isHashing}
        canSaveHash={Boolean(displayedCalculatedHash)}
        shortcutLabel={shortcutLabel}
        onToggleTheme={handleToggleTheme}
        onOpenFile={openFilePicker}
        onSaveHash={() => void handleSaveHashToFile()}
        onClearAll={handleClearAll}
        onOpenPreferences={() => setPrefsOpen(true)}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      {/* Drag-and-drop full-window overlay */}
      {isDragOver && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-6 pointer-events-none"
        >
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--bg-surface)] px-12 py-10 shadow-[var(--shadow-popover)]">
            <Upload className="h-9 w-9 text-[var(--accent)]" />
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Drop file anywhere to hash locally
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Processed strictly in your browser — never uploaded
            </p>
          </div>
        </div>
      )}

      {/* Main Centered Utility Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-[960px] space-y-5">
          {/* Quiet heading lockup */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 px-1">
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
              File Hash &amp; Integrity Verifier
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Private browser engine · 26 algorithms · Streaming chunks
            </p>
          </div>

          {/* Primary Single-Elevation Utility Surface */}
          <section
            aria-label="Hash calculator and verifier"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-8 space-y-5"
          >
            {/* Row 1: File selection */}
            <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr_auto] items-center gap-2.5 sm:gap-3">
              <label
                htmlFor="hexy-file-trigger"
                className="text-sm font-medium text-[var(--text-secondary)]"
              >
                File
              </label>

              <div className="relative flex items-center min-w-0">
                <button
                  id="hexy-file-trigger"
                  type="button"
                  disabled={isHashing}
                  onClick={openFilePicker}
                  className={`h-11 w-full flex items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-sm transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-55 disabled:pointer-events-none ${
                    selectedFile
                      ? 'border-[var(--border-strong)] bg-[var(--bg-inset)] text-[var(--text-primary)]'
                      : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-inset)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <FileIcon
                      className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {selectedFile
                        ? selectedFile.name
                        : 'Select a file or drag and drop anywhere...'}
                    </span>
                  </span>

                  {selectedFile && (
                    <span className="font-mono text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0 tabular-nums pr-7">
                      {formatFileSize(selectedFile.size)}
                    </span>
                  )}
                </button>

                {selectedFile && !isHashing && (
                  <button
                    type="button"
                    aria-label="Clear selected file"
                    onClick={() => handleFileChosen(null)}
                    className="absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={isHashing}
                onClick={openFilePicker}
                title="Choose a file to hash"
                className="inline-flex h-11 sm:w-40 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <FolderOpen className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                Browse
              </button>
            </div>

            {/* Row 2: Expected Hash */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr_auto] items-center gap-2.5 sm:gap-3">
                <label
                  htmlFor="expected-hash-input"
                  className="text-sm font-medium text-[var(--text-secondary)]"
                >
                  Expected Hash
                </label>

                <div className="relative min-w-0">
                  <input
                    ref={expectedHashRef}
                    id="expected-hash-input"
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={isHashing}
                    value={expectedHashInput}
                    onChange={(e) => {
                      setExpectedHashInput(e.target.value);
                      setInlineHint(null);
                      if (!isHashing && rawCalculatedHash) {
                        resetResultDisplay();
                      }
                    }}
                    placeholder="Optional: paste hex or Base64 hash to verify..."
                    className="h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] pl-3.5 pr-9 font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:opacity-55 transition-colors"
                  />
                  {expectedHashInput && !isHashing && (
                    <button
                      type="button"
                      aria-label="Clear expected hash"
                      onClick={() => {
                        setExpectedHashInput('');
                        setInlineHint(null);
                        if (rawCalculatedHash) resetResultDisplay();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isHashing}
                  onClick={() => void handlePasteExpectedHash()}
                  title="Paste expected hash from clipboard"
                  className="inline-flex h-11 sm:w-40 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <ClipboardPaste
                    className="h-4 w-4 text-[var(--text-secondary)]"
                    aria-hidden="true"
                  />
                  Paste
                </button>
              </div>

              {(inlineHint || expectedHashPreview) && (
                <div
                  className={`sm:pl-[144px] text-xs ${
                    !inlineHint && expectedHashPreview?.tone === 'warning'
                      ? 'text-[var(--warning)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {inlineHint ?? expectedHashPreview?.text}
                </div>
              )}
            </div>

            {/* Row 3: Algorithm selection & Theme selector */}
            <div className="pt-1 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-5 border-t border-[var(--border-subtle)]/70">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0 pt-3">
                <label
                  className="inline-flex items-center gap-2.5 text-sm font-medium text-[var(--text-primary)] cursor-pointer select-none whitespace-nowrap shrink-0"
                  title="Uncheck to auto-detect matching algorithms from the expected hash length"
                >
                  <input
                    type="checkbox"
                    checked={selectAlgoEnabled}
                    disabled={isHashing}
                    onChange={(e) => {
                      setSelectAlgoEnabled(e.target.checked);
                      if (!isHashing) {
                        resetResultDisplay();
                      }
                    }}
                    className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>Select Hash Algorithm</span>
                </label>

                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 sm:max-w-[220px]">
                    <select
                      aria-label="Hash algorithm"
                      value={selectedAlgorithm}
                      disabled={isHashing || !selectAlgoEnabled}
                      onChange={(e) => {
                        setSelectedAlgorithm(e.target.value as HashAlgorithm);
                        if (!isHashing) {
                          resetResultDisplay();
                        }
                      }}
                      className="h-10 w-full appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] pl-3 pr-9 font-mono text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer transition-colors"
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

                  <span className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap shrink-0 tabular-nums">
                    {selectAlgoEnabled
                      ? `${getExpectedHexLength(selectedAlgorithm) * 4}-bit`
                      : 'Auto-detect'}
                  </span>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden lg:block h-6 w-px bg-[var(--border-subtle)] mt-3 shrink-0"
              />

              <div className="flex items-center gap-3 lg:pt-3 shrink-0">
                <label
                  htmlFor="workspace-theme-select"
                  className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap shrink-0"
                >
                  Theme
                </label>
                <div className="relative w-full sm:w-44">
                  <select
                    id="workspace-theme-select"
                    value={preferences.theme}
                    onChange={(e) => updateTheme(e.target.value as AppTheme)}
                    className="h-10 w-full appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] pl-3 pr-9 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer transition-colors"
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
            </div>

            {/* Row 4: Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                disabled={isHashing}
                onClick={handleCalculateAndVerify}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-55 disabled:pointer-events-none transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
              >
                <Hash className="h-4 w-4" aria-hidden="true" />
                Calculate &amp; Verify Hash
              </button>

              <button
                type="button"
                disabled={!isHashing}
                onClick={handleCancel}
                className="inline-flex h-11 sm:w-32 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex h-11 sm:w-32 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                Clear All
              </button>
            </div>

            {/* Row 5: Progress & Status Bar */}
            <div className="space-y-1.5">
              <div
                role="progressbar"
                aria-label="Hash calculation progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-valuetext={progressLabel}
                className="relative h-9 w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)]"
              >
                {/* Progress fill (subtle translucent tint on terminal states so centered text stays WCAG AA legible) */}
                <div
                  className={`h-full transition-[width] duration-150 ease-out ${
                    progressTone === 'working'
                      ? progressBarFillClass
                      : progressTone === 'match'
                        ? 'bg-[var(--success-soft)]'
                        : progressTone === 'mismatch'
                          ? 'bg-[var(--warning-soft)]'
                          : progressTone === 'error'
                            ? 'bg-[var(--danger-soft)]'
                            : progressTone === 'done'
                              ? 'bg-[var(--accent-soft)]'
                              : 'bg-transparent'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />

                {/* Centered status label + explicit semantic icon (never hue-only) */}
                <div
                  className={`absolute inset-0 flex items-center justify-center gap-2 px-3 font-mono text-xs font-medium tabular-nums select-none ${progressTextClass}`}
                >
                  {progressTone === 'match' && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {progressTone === 'mismatch' && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {progressTone === 'error' && (
                    <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {progressTone === 'done' && (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                  )}
                  <span className="truncate">{progressLabel}</span>
                </div>
              </div>
            </div>

            {/* Row 6: Calculated Hash output */}
            <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr_auto] items-start gap-2.5 sm:gap-3 pt-1">
              <label
                htmlFor="calculated-hash-output"
                className="text-sm font-medium text-[var(--text-secondary)] sm:pt-3"
              >
                Calculated Hash
              </label>

              <textarea
                id="calculated-hash-output"
                readOnly
                spellCheck={false}
                rows={displayedCalculatedHash.length > 64 ? 2 : 1}
                value={displayedCalculatedHash}
                title={displayedCalculatedHash || undefined}
                placeholder="Calculated hash will appear here..."
                onFocus={(e) => {
                  if (displayedCalculatedHash) e.currentTarget.select();
                }}
                className={`w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3.5 font-mono text-[13px] leading-[1.45] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 min-w-0 break-all ${
                  displayedCalculatedHash.length > 64
                    ? 'py-2.5 min-h-[60px]'
                    : 'h-11 py-[11px] overflow-hidden'
                }`}
              />

              <div className="flex items-center gap-2 sm:w-40 shrink-0">
                <button
                  type="button"
                  disabled={!displayedCalculatedHash || isHashing}
                  onClick={() => void handleCopyCalculatedHash()}
                  title="Copy calculated hash to clipboard"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {copiedBriefly ? (
                    <>
                      <Check className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={!displayedCalculatedHash || isHashing}
                  onClick={() => void handleSaveHashToFile()}
                  title={`Save calculated hash to file (${shortcutLabel}+S)`}
                  aria-label="Save hash to file"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:pointer-events-none transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Download className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          {/* Quiet unboxed privacy & utility footer note */}
          <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              <span>100% client-side</span>
              <span aria-hidden="true">·</span>
              <span>Files never leave your browser</span>
              <span aria-hidden="true">·</span>
              <span>Preferences &amp; logs stored locally</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                How to Use
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                About Hexy
              </button>
            </div>
          </footer>
        </div>
      </main>

      {/* Modals */}
      <PreferencesModal
        open={prefsOpen}
        preferences={preferences}
        onClose={() => setPrefsOpen(false)}
        onSave={handleSavePreferences}
      />

      <LogsModal
        open={logsOpen}
        logger={loggerRef.current}
        onClose={() => setLogsOpen(false)}
        onRequestClearConfirm={(onConfirmed) =>
          setNotice({
            variant: 'confirm',
            title: 'Confirm Clear Logs',
            message: 'Clear all persistent log entries stored in this browser?',
            confirmLabel: 'Clear Logs',
            onConfirm: onConfirmed,
          })
        }
        onNotify={(title, message) =>
          setNotice({
            variant: 'info',
            title,
            message,
          })
        }
      />

      <HelpModal
        open={helpOpen}
        shortcutLabel={shortcutLabel}
        onClose={() => setHelpOpen(false)}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

export default App;
