import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  resetPreferences,
  savePreferences,
  type StorageLike,
} from './preferences';
import { AppLogger } from './logger';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('preferences persist, validate, and reset cleanly', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadPreferences(storage), DEFAULT_PREFERENCES);

  savePreferences(
    {
      theme: 'light',
      defaultAlgorithm: 'SHA-256',
      uppercaseOutput: true,
      loggingEnabled: false,
      showResultDialogs: false,
    },
    storage
  );

  const reloaded = loadPreferences(storage);
  assert.equal(reloaded.theme, 'light');
  assert.equal(reloaded.defaultAlgorithm, 'SHA-256');
  assert.equal(reloaded.uppercaseOutput, true);
  assert.equal(reloaded.loggingEnabled, false);
  assert.equal(reloaded.showResultDialogs, false);

  const reset = resetPreferences(storage);
  assert.deepEqual(reset, DEFAULT_PREFERENCES);
  assert.deepEqual(loadPreferences(storage), DEFAULT_PREFERENCES);
});

test('AppLogger writes formatted entries, respects enabled flag, rotates, and clears', () => {
  const storage = createMemoryStorage();
  const logger = new AppLogger(true, storage, 200);

  logger.info('Started');
  logger.hashCalculated('sample.txt', 'SHA-256', 'abcd');
  logger.verificationSucceeded('sample.txt', 'SHA-256', 'abcd');
  logger.verificationFailed('sample.txt', 'SHA-256', '1234', 'abcd');
  logger.hashSaved('out.txt');
  logger.error('Read', new Error('disk error'));

  const content = logger.readAll();
  assert.ok(content.includes('[SAVED]'));
  assert.ok(content.includes('[ERROR] Read: disk error'));
  assert.ok(content.length <= 200, 'Logger should trim/rotate when exceeding maxBytes');

  logger.setEnabled(false);
  logger.info('Should not be written');
  assert.equal(logger.readAll().includes('Should not be written'), false);

  logger.clear();
  assert.equal(logger.readAll(), '');
  assert.equal(logger.entryCount(), 0);
});

test('AppLogger recovers from QuotaExceededError by trimming older entries and retaining the new line', () => {
  const map = new Map<string, string>();
  let failOnceOverLimit = true;
  const quotaStorage: StorageLike = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (failOnceOverLimit && value.length > 120) {
        failOnceOverLimit = false;
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };

  const logger = new AppLogger(true, quotaStorage, 50_000);
  logger.info('First entry with some text');
  logger.info('Second entry with some text');
  logger.info('Third entry with some text');
  logger.info('Latest critical entry');

  const stored = logger.readAll();
  assert.ok(stored.includes('Latest critical entry'), 'Newest entry should survive quota trimming');
  assert.ok(stored.length <= 160, 'Stored logs should have been trimmed after quota failure');
});
