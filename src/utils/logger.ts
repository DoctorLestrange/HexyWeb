import type { StorageLike } from './preferences';

const LOG_STORAGE_KEY = 'hexy.activity.log';
const DEFAULT_MAX_LOG_BYTES = 512 * 1024; // 512 KB browser-safe local cap

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatLogTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Browser-local persistent activity logger mirroring Java AppLogger format and behavior.
 * All logs stay strictly inside the user's browser storage.
 */
export class AppLogger {
  private readonly storage: StorageLike | null;
  private readonly maxBytes: number;
  private enabled: boolean;

  constructor(
    enabled: boolean,
    storage: StorageLike | null = getDefaultStorage(),
    maxBytes: number = DEFAULT_MAX_LOG_BYTES
  ) {
    this.enabled = enabled;
    this.storage = storage;
    this.maxBytes = maxBytes;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  hashCalculated(fileName: string, algorithm: string, hash: string): void {
    this.log('HASH', `file="${this.safeName(fileName)}" algo=${algorithm} hash=${hash}`);
  }

  verificationSucceeded(fileName: string, algorithm: string, hash: string): void {
    this.log('MATCH', `file="${this.safeName(fileName)}" algo=${algorithm} hash=${hash}`);
  }

  verificationFailed(
    fileName: string,
    testedAlgos: string,
    expected: string,
    lastCalculated: string
  ): void {
    this.log(
      'MISMATCH',
      `file="${this.safeName(fileName)}" tested=[${testedAlgos}] expected=${expected} calculated=${lastCalculated}`
    );
  }

  cancelled(fileName: string): void {
    this.log('CANCELLED', `file="${this.safeName(fileName)}"`);
  }

  hashSaved(outputFileName: string): void {
    this.log('SAVED', `output="${outputFileName}"`);
  }

  error(context: string, err?: unknown): void {
    const detail =
      err instanceof Error && err.message
        ? err.message
        : typeof err === 'string' && err.length > 0
          ? err
          : 'Unknown error';
    this.log('ERROR', `${context}: ${detail}`);
  }

  log(level: string, message: string): void {
    if (!this.enabled || !this.storage) {
      return;
    }
    try {
      const sanitized = (message ?? '').replace(/[\r\n]+/g, ' ');
      const line = `${formatLogTimestamp()} [${level}] ${sanitized}\n`;
      const existing = this.storage.getItem(LOG_STORAGE_KEY) ?? '';
      let next = existing + line;

      // Rotate/trim oldest lines if exceeding size threshold (keeps most recent ~75%)
      if (next.length > this.maxBytes) {
        const targetStart = Math.max(0, next.length - Math.floor(this.maxBytes * 0.75));
        const newlineIndex = next.indexOf('\n', targetStart);
        next = newlineIndex !== -1 && newlineIndex + 1 < next.length ? next.slice(newlineIndex + 1) : line;
      }

      try {
        this.storage.setItem(LOG_STORAGE_KEY, next);
      } catch {
        // Recover from QuotaExceededError by trimming to the newest 50%, then falling back to the single new entry
        const halfStart = Math.floor(next.length / 2);
        const newlineIndex = next.indexOf('\n', halfStart);
        const trimmed =
          newlineIndex !== -1 && newlineIndex + 1 < next.length ? next.slice(newlineIndex + 1) : line;
        try {
          this.storage.setItem(LOG_STORAGE_KEY, trimmed);
        } catch {
          this.storage.setItem(LOG_STORAGE_KEY, line);
        }
      }
    } catch {
      // Never crash the app if browser storage is full or disabled
    }
  }

  readAll(): string {
    if (!this.storage) {
      return '';
    }
    try {
      return this.storage.getItem(LOG_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  entryCount(): number {
    const content = this.readAll().trim();
    if (!content) return 0;
    return content.split('\n').length;
  }

  clear(): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(LOG_STORAGE_KEY, '');
    } catch {
      // Ignore
    }
  }

  private safeName(name: string | null | undefined): string {
    return name && name.length > 0 ? name : '<unknown>';
  }
}
