/**
 * Browser-safe clipboard and file-save helpers with graceful fallbacks for sandboxed iframes.
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand copy below
  }

  try {
    const prevActive = document.activeElement as HTMLElement | null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (prevActive && prevActive.isConnected) {
      prevActive.focus({ preventScroll: true });
    }
    return ok;
  } catch {
    return false;
  }
}

export type ClipboardReadResult =
  | { status: 'ok'; text: string }
  | { status: 'empty' }
  | { status: 'blocked' };

export async function readTextFromClipboard(): Promise<ClipboardReadResult> {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return { status: 'blocked' };
    }
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      return { status: 'empty' };
    }
    return { status: 'ok', text: text.trim() };
  } catch {
    return { status: 'blocked' };
  }
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    name: string;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

/**
 * Saves UTF-8 text to disk via File System Access API when permitted,
 * falling back cleanly to a standard browser download in iframes or Safari/Firefox.
 * Returns the saved file name, or null if the user cancelled the native dialog.
 */
export async function saveTextToFile(suggestedName: string, content: string): Promise<string | null> {
  const win = window as SaveFilePickerWindow;
  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Text & Checksum Files',
            accept: {
              'text/plain': ['.txt', '.sha256', '.sha512', '.md5', '.log'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return handle.name || suggestedName;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      // SecurityError in cross-origin iframe -> fall back cleanly to Blob download
    }
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return suggestedName;
}
