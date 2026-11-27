/**
 * Core hashing metadata, validation, and encoding utilities for Hexy.
 */

export const SUPPORTED_ALGORITHMS = [
  'MD5',
  'SHA-1',
  'SHA-224',
  'SHA-256',
  'SHA-384',
  'SHA-512',
  'SHA-512/256',
  'SHA3-224',
  'SHA3-256',
  'SHA3-384',
  'SHA3-512',
  'SHAKE128-256',
  'SHAKE256-512',
  'BLAKE2S-128',
  'BLAKE2S-256',
  'BLAKE2B-256',
  'BLAKE2B-384',
  'BLAKE2B-512',
  'BLAKE3-256',
  'ASCON-HASH256',
  'RIPEMD160',
  'WHIRLPOOL',
  'SM3',
  'CRC32',
  'CRC32C',
  'ADLER32',
] as const;

export type HashAlgorithm = (typeof SUPPORTED_ALGORITHMS)[number];

export interface AlgorithmInfo {
  name: HashAlgorithm;
  bits: number;
  hexLength: number;
  family: string;
}

export const ALGORITHM_INFO_LIST: readonly AlgorithmInfo[] = [
  { name: 'MD5', bits: 128, hexLength: 32, family: 'Legacy' },
  { name: 'SHA-1', bits: 160, hexLength: 40, family: 'Legacy' },
  { name: 'SHA-224', bits: 224, hexLength: 56, family: 'SHA-2' },
  { name: 'SHA-256', bits: 256, hexLength: 64, family: 'SHA-2' },
  { name: 'SHA-384', bits: 384, hexLength: 96, family: 'SHA-2' },
  { name: 'SHA-512', bits: 512, hexLength: 128, family: 'SHA-2' },
  { name: 'SHA-512/256', bits: 256, hexLength: 64, family: 'SHA-2' },
  { name: 'SHA3-224', bits: 224, hexLength: 56, family: 'SHA-3' },
  { name: 'SHA3-256', bits: 256, hexLength: 64, family: 'SHA-3' },
  { name: 'SHA3-384', bits: 384, hexLength: 96, family: 'SHA-3' },
  { name: 'SHA3-512', bits: 512, hexLength: 128, family: 'SHA-3' },
  { name: 'SHAKE128-256', bits: 256, hexLength: 64, family: 'SHA-3 XOF' },
  { name: 'SHAKE256-512', bits: 512, hexLength: 128, family: 'SHA-3 XOF' },
  { name: 'BLAKE2S-128', bits: 128, hexLength: 32, family: 'BLAKE' },
  { name: 'BLAKE2S-256', bits: 256, hexLength: 64, family: 'BLAKE' },
  { name: 'BLAKE2B-256', bits: 256, hexLength: 64, family: 'BLAKE' },
  { name: 'BLAKE2B-384', bits: 384, hexLength: 96, family: 'BLAKE' },
  { name: 'BLAKE2B-512', bits: 512, hexLength: 128, family: 'BLAKE' },
  { name: 'BLAKE3-256', bits: 256, hexLength: 64, family: 'BLAKE' },
  { name: 'ASCON-HASH256', bits: 256, hexLength: 64, family: 'NIST Lightweight' },
  { name: 'RIPEMD160', bits: 160, hexLength: 40, family: 'Ecosystem' },
  { name: 'WHIRLPOOL', bits: 512, hexLength: 128, family: 'Ecosystem' },
  { name: 'SM3', bits: 256, hexLength: 64, family: 'Ecosystem' },
  { name: 'CRC32', bits: 32, hexLength: 8, family: 'Checksum' },
  { name: 'CRC32C', bits: 32, hexLength: 8, family: 'Checksum' },
  { name: 'ADLER32', bits: 32, hexLength: 8, family: 'Checksum' },
];

export interface ParsedExpectedHash {
  hexHash: string;
  fromBase64: boolean;
}

const VALID_HEX_LENGTHS = new Set([8, 32, 40, 56, 64, 96, 128]);
const VALID_DIGEST_BYTE_LENGTHS = new Set([4, 16, 20, 28, 32, 48, 64]);
const COLON_HEX_PATTERN = /^([0-9a-fA-F]{2}:)+[0-9a-fA-F]{2}$/;
const BASE64_STD_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]*={0,2}$/;

const HEX_DIGITS = '0123456789abcdef';

export function isSupportedAlgorithm(value: string): value is HashAlgorithm {
  return (SUPPORTED_ALGORITHMS as readonly string[]).includes(value);
}

/**
 * Converts a Uint8Array to a lowercase hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += HEX_DIGITS[(b >>> 4) & 0xf] + HEX_DIGITS[b & 0xf];
  }
  return out;
}

/**
 * Checks whether `str` consists exclusively of one or more ASCII hexadecimal characters.
 */
export function isHex(str: string | null | undefined): boolean {
  if (!str || str.length === 0) {
    return false;
  }
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 70;
    const isLower = code >= 97 && code <= 102;
    if (!isDigit && !isUpper && !isLower) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether `hexKey` is a valid hexadecimal digest for any supported algorithm.
 */
export function isValidHexKey(hexKey: string | null | undefined): boolean {
  return Boolean(hexKey && isHex(hexKey) && VALID_HEX_LENGTHS.has(hexKey.length));
}

function decodeBase64Strict(str: string, urlSafe: boolean): Uint8Array | null {
  if (!str || str.length === 0) {
    return null;
  }
  const pattern = urlSafe ? BASE64_URL_PATTERN : BASE64_STD_PATTERN;
  if (!pattern.test(str)) {
    return null;
  }
  // Reject empty payloads (e.g., "==", "====") and invalid single trailing character mod 4 === 1
  const unpadded = str.replace(/=+$/, '');
  if (unpadded.length === 0 || unpadded.length % 4 === 1) {
    return null;
  }
  // If padding is present, total length must be a multiple of 4
  if (str.includes('=') && str.length % 4 !== 0) {
    return null;
  }

  let normalized = urlSafe ? unpadded.replace(/-/g, '+').replace(/_/g, '/') : unpadded;
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Checks whether `str` is a valid standard Base64 string.
 */
export function isBase64(str: string | null | undefined): boolean {
  if (!str || str.length === 0) {
    return false;
  }
  return decodeBase64Strict(str, false) !== null;
}

/**
 * Decodes a standard Base64 string as UTF-8 text, or returns null if invalid.
 */
export function decodeBase64(base64Str: string | null | undefined): string | null {
  if (!base64Str) {
    return null;
  }
  const bytes = decodeBase64Strict(base64Str, false);
  if (!bytes) {
    return null;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function tryDecodeBase64Bytes(str: string): Uint8Array | null {
  return decodeBase64Strict(str, false) ?? decodeBase64Strict(str, true);
}

/**
 * Decodes a Base64-encoded hash (either raw digest bytes or Base64-encoded ASCII hex)
 * into a lowercase hexadecimal string, or returns null if invalid.
 */
export function decodeBase64HashToHex(base64Str: string | null | undefined): string | null {
  if (!base64Str || base64Str.length === 0) {
    return null;
  }
  const decodedBytes = tryDecodeBase64Bytes(base64Str);
  if (!decodedBytes || decodedBytes.length === 0) {
    return null;
  }

  // First check if the Base64 payload itself encodes an ASCII hex digest string.
  let isPureAscii = true;
  let ascii = '';
  for (let i = 0; i < decodedBytes.length; i++) {
    if (decodedBytes[i] > 0x7f) {
      isPureAscii = false;
      break;
    }
    ascii += String.fromCharCode(decodedBytes[i]);
  }
  if (isPureAscii && isValidHexKey(ascii)) {
    return ascii.toLowerCase();
  }

  // Otherwise check if the raw decoded bytes match a supported digest length.
  if (VALID_DIGEST_BYTE_LENGTHS.has(decodedBytes.length)) {
    return bytesToHex(decodedBytes);
  }

  return null;
}

const INVISIBLE_CHARS_PATTERN = /[\u200B-\u200D\uFEFF]/g;

function buildInvalidHexLengthError(length: number): Error {
  return new Error(
    `Invalid hex hash length (${length} characters). ` +
      'Supported hex lengths: 8 (CRC32, CRC32C, ADLER32), 32 (MD5, BLAKE2S-128), ' +
      '40 (SHA-1, RIPEMD160), 56 (SHA-224, SHA3-224), ' +
      '64 (256-bit SHA-2/SHA-3/SHAKE128/BLAKE2/BLAKE3/ASCON/SM3), ' +
      '96 (SHA-384, SHA3-384, BLAKE2B-384), and ' +
      '128 (512-bit SHA-2/SHA-3/SHAKE256/BLAKE2B/WHIRLPOOL).'
  );
}

/**
 * Parses and normalizes an expected hash input (hexadecimal or Base64).
 * Returns null if rawInput is blank. Throws Error if non-blank and invalid.
 */
export function parseExpectedHash(rawInput: string | null | undefined): ParsedExpectedHash | null {
  if (!rawInput) {
    return null;
  }
  const cleaned = rawInput.replace(INVISIBLE_CHARS_PATTERN, '').replace(/\s+/g, '');
  if (cleaned.length === 0) {
    return null;
  }

  if (isValidHexKey(cleaned)) {
    return { hexHash: cleaned.toLowerCase(), fromBase64: false };
  }

  // Support optional 0x / 0X prefix (do not fall through to Base64 when payload is hex)
  if ((cleaned.startsWith('0x') || cleaned.startsWith('0X')) && cleaned.length > 2) {
    const withoutPrefix = cleaned.slice(2);
    if (isValidHexKey(withoutPrefix)) {
      return { hexHash: withoutPrefix.toLowerCase(), fromBase64: false };
    }
    if (isHex(withoutPrefix)) {
      throw buildInvalidHexLengthError(withoutPrefix.length);
    }
  }

  // Support colon-separated byte hex (e.g., 90:01:50:98:...)
  if (COLON_HEX_PATTERN.test(cleaned)) {
    const uncoloned = cleaned.replace(/:/g, '');
    if (isValidHexKey(uncoloned)) {
      return { hexHash: uncoloned.toLowerCase(), fromBase64: false };
    }
    throw buildInvalidHexLengthError(uncoloned.length);
  }

  const decodedHex = decodeBase64HashToHex(cleaned);
  if (decodedHex !== null) {
    return { hexHash: decodedHex, fromBase64: true };
  }

  if (isHex(cleaned)) {
    throw buildInvalidHexLengthError(cleaned.length);
  }

  throw new Error(
    'Invalid hash value. Enter a valid hexadecimal or Base64-encoded hash for a supported algorithm.'
  );
}

/**
 * Returns probable algorithm names matching the length of hexHash (in exact Java priority order).
 */
export function getProbableHashAlgorithms(hexHash: string | null | undefined): HashAlgorithm[] {
  if (!hexHash || !isHex(hexHash)) {
    return [];
  }

  switch (hexHash.length) {
    case 8:
      return ['CRC32', 'CRC32C', 'ADLER32'];
    case 32:
      return ['MD5', 'BLAKE2S-128'];
    case 40:
      return ['SHA-1', 'RIPEMD160'];
    case 56:
      return ['SHA-224', 'SHA3-224'];
    case 64:
      return [
        'SHA-256',
        'SHA3-256',
        'BLAKE2S-256',
        'BLAKE2B-256',
        'BLAKE3-256',
        'SHA-512/256',
        'SHAKE128-256',
        'SM3',
        'ASCON-HASH256',
      ];
    case 96:
      return ['SHA-384', 'SHA3-384', 'BLAKE2B-384'];
    case 128:
      return ['SHA-512', 'SHA3-512', 'BLAKE2B-512', 'SHAKE256-512', 'WHIRLPOOL'];
    default:
      return [];
  }
}

/**
 * Returns the expected hexadecimal digest character length for a supported algorithm, or -1 if unknown.
 */
export function getExpectedHexLength(algorithm: string | null | undefined): number {
  if (!algorithm) {
    return -1;
  }
  switch (algorithm.trim().toUpperCase()) {
    case 'CRC32':
    case 'CRC32C':
    case 'ADLER32':
      return 8;
    case 'MD5':
    case 'BLAKE2S-128':
      return 32;
    case 'SHA-1':
    case 'RIPEMD160':
      return 40;
    case 'SHA-224':
    case 'SHA3-224':
      return 56;
    case 'SHA-256':
    case 'SHA-512/256':
    case 'SHA3-256':
    case 'SHAKE128-256':
    case 'BLAKE2S-256':
    case 'BLAKE2B-256':
    case 'BLAKE3-256':
    case 'ASCON-HASH256':
    case 'SM3':
      return 64;
    case 'SHA-384':
    case 'SHA3-384':
    case 'BLAKE2B-384':
      return 96;
    case 'SHA-512':
    case 'SHA3-512':
    case 'SHAKE256-512':
    case 'BLAKE2B-512':
    case 'WHIRLPOOL':
      return 128;
    default:
      return -1;
  }
}

/**
 * Formats an informative mismatch message when an expected hash's length does not match selectedAlgo.
 */
export function describeLengthMismatch(
  expectedHex: string,
  selectedAlgo: string,
  fromBase64: boolean = false
): string {
  const actualLen = expectedHex ? expectedHex.length : 0;
  const expectedLen = getExpectedHexLength(selectedAlgo);
  const matchingAlgos = getProbableHashAlgorithms(expectedHex);
  const matchingHint = matchingAlgos.length === 0 ? '' : ` (${matchingAlgos.join(', ')})`;
  const expectedHint = expectedLen > 0 ? ` (expects ${expectedLen} hex characters)` : '';
  const sourceNote = fromBase64 ? ' (decoded from Base64)' : '';
  return `The entered hash${sourceNote} is ${actualLen} hex characters${matchingHint}, which is incompatible with ${selectedAlgo}${expectedHint}.`;
}

/**
 * Formats a hex digest according to user case preference.
 */
export function formatHashForDisplay(hexHash: string | null | undefined, uppercase: boolean): string {
  if (!hexHash) {
    return '';
  }
  return uppercase ? hexHash.toUpperCase() : hexHash.toLowerCase();
}

/**
 * Suggests a filesystem-safe filename for saving a calculated hash, matching Java Hexy's naming convention.
 */
export function suggestSaveFileName(fileName: string | null, algo: string | null): string {
  const algoSuffix = algo ? algo.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') : 'hash';
  if (fileName && fileName.trim().length > 0) {
    const safeBase = fileName
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+$/, 'file');
    if (safeBase.length > 0) {
      return `${safeBase}.${algoSuffix}.txt`;
    }
  }
  return `hexy-${algoSuffix}.txt`;
}

/**
 * Formats a byte size into a compact human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return exp === 0 ? `${Math.round(bytes)} B` : `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exp]}`;
}
