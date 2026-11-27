import { type HashAlgorithm, isSupportedAlgorithm } from './hashUtils';

export type AppTheme = 'dark' | 'light';

export interface PreferencesData {
  theme: AppTheme;
  defaultAlgorithm: HashAlgorithm;
  uppercaseOutput: boolean;
  loggingEnabled: boolean;
  showResultDialogs: boolean;
}

export const APP_VERSION = '0.0.1';
export const DEVELOPER_NAME = 'DoctorLestrange';
export const GITHUB_URL = 'https://github.com/DoctorLestrange/HexyWeb';

export const DEFAULT_PREFERENCES: PreferencesData = {
  theme: 'dark',
  defaultAlgorithm: 'MD5',
  uppercaseOutput: false,
  loggingEnabled: true,
  showResultDialogs: true,
};

export const THEME_OPTIONS: ReadonlyArray<{ id: AppTheme; label: string; description: string }> = [
  { id: 'dark', label: 'Dark Graphite', description: 'Deep neutral graphite dark theme' },
  { id: 'light', label: 'Light Off-White', description: 'Warm off-white low-glare light theme' },
];

const STORAGE_KEY = 'hexy.preferences';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage unavailable (e.g., restricted sandbox)
  }
  return null;
}

export function loadPreferences(storage: StorageLike | null = getDefaultStorage()): PreferencesData {
  if (!storage) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<PreferencesData>;
    const theme: AppTheme = parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULT_PREFERENCES.theme;
    const defaultAlgorithm: HashAlgorithm =
      typeof parsed.defaultAlgorithm === 'string' && isSupportedAlgorithm(parsed.defaultAlgorithm)
        ? parsed.defaultAlgorithm
        : DEFAULT_PREFERENCES.defaultAlgorithm;
    const uppercaseOutput =
      typeof parsed.uppercaseOutput === 'boolean' ? parsed.uppercaseOutput : DEFAULT_PREFERENCES.uppercaseOutput;
    const loggingEnabled =
      typeof parsed.loggingEnabled === 'boolean' ? parsed.loggingEnabled : DEFAULT_PREFERENCES.loggingEnabled;
    const showResultDialogs =
      typeof parsed.showResultDialogs === 'boolean'
        ? parsed.showResultDialogs
        : DEFAULT_PREFERENCES.showResultDialogs;

    return {
      theme,
      defaultAlgorithm,
      uppercaseOutput,
      loggingEnabled,
      showResultDialogs,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(
  prefs: PreferencesData,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Never crash if storage quota or privacy mode rejects writes
  }
}

export function resetPreferences(storage: StorageLike | null = getDefaultStorage()): PreferencesData {
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return { ...DEFAULT_PREFERENCES };
}
