import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_ALGORITHMS,
  decodeBase64,
  describeLengthMismatch,
  formatFileSize,
  getExpectedHexLength,
  getProbableHashAlgorithms,
  isBase64,
  isHex,
  isValidHexKey,
  parseExpectedHash,
  suggestSaveFileName,
} from './hashUtils';

test('parseExpectedHash supports hex, spaces, 0x prefix, colons, standard & URL-safe Base64, and ASCII-hex Base64', () => {
  const sha256Hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // Uppercase + space-separated hex
  const hexParsed = parseExpectedHash(
    'E3B0 C442 98FC 1C14 9AFB F4C8 996F B924 27AE 41E4 649B 934C A495 991B 7852 B855'
  );
  assert.deepEqual(hexParsed, { hexHash: sha256Hex, fromBase64: false });

  // Base64 of raw SHA-256 digest bytes
  const rawDigest = Buffer.from(sha256Hex, 'hex');
  const rawB64 = rawDigest.toString('base64');
  assert.deepEqual(parseExpectedHash(rawB64), { hexHash: sha256Hex, fromBase64: true });

  // URL-safe Base64 of raw SHA-256 digest bytes
  const urlB64 = rawB64.replace(/\+/g, '-').replace(/\//g, '_');
  assert.deepEqual(parseExpectedHash(urlB64), { hexHash: sha256Hex, fromBase64: true });

  // Base64 of ASCII hex string
  const asciiHexB64 = Buffer.from(sha256Hex, 'ascii').toString('base64');
  assert.deepEqual(parseExpectedHash(asciiHexB64), { hexHash: sha256Hex, fromBase64: true });

  // Blank -> null
  assert.equal(parseExpectedHash('   '), null);
  assert.equal(parseExpectedHash(''), null);

  // Optional 0x prefix
  assert.deepEqual(parseExpectedHash('0x352441c2'), { hexHash: '352441c2', fromBase64: false });
  assert.deepEqual(parseExpectedHash('0X352441C2'), { hexHash: '352441c2', fromBase64: false });

  // Colon-separated hex bytes
  assert.deepEqual(parseExpectedHash('90:01:50:98:3C:D2:4F:B0:D6:96:3F:7D:28:E1:7F:72'), {
    hexHash: '900150983cd24fb0d6963f7d28e17f72',
    fromBase64: false,
  });

  // Unsupported hex length gives specific length error (including 0x prefix and colon-separated hex!)
  assert.throws(() => parseExpectedHash('abcdef1234'), /10 characters/);
  assert.throws(() => parseExpectedHash('0xabcdef1234'), /10 characters/);
  // Regression: 0x + 20 hex chars (22 chars total) must NOT falsely decode as 16-byte Base64!
  assert.throws(() => parseExpectedHash('0x1234567890abcdef1234'), /20 characters/);
  assert.throws(() => parseExpectedHash('90:01:50:98:3C'), /10 characters/);

  // Invisible UTF-8 BOM / zero-width spaces copied from PDFs/web pages are stripped cleanly
  assert.deepEqual(parseExpectedHash(`\uFEFF${sha256Hex}\u200B`), {
    hexHash: sha256Hex,
    fromBase64: false,
  });

  // Invalid non-hash Base64 ("Hello!") & invalid strings
  const nonHashB64 = Buffer.from('Hello!', 'utf-8').toString('base64');
  assert.throws(() => parseExpectedHash(nonHashB64), /Invalid hash value/);
  assert.throws(() => parseExpectedHash('not-a-valid-hash'), /Invalid hash value/);
});

test('describeLengthMismatch mentions actual, matching algos, selected algo, Base64 note, and expected length', () => {
  const msg = describeLengthMismatch('d41d8cd98f00b204e9800998ecf8427e', 'SHA-256');
  assert.ok(msg.includes('32 hex characters'));
  assert.ok(msg.includes('MD5'));
  assert.ok(msg.includes('SHA-256'));
  assert.ok(msg.includes('64 hex characters'));
  assert.equal(msg.includes('decoded from Base64'), false);

  const b64Msg = describeLengthMismatch('d41d8cd98f00b204e9800998ecf8427e', 'SHA-256', true);
  assert.ok(b64Msg.includes('(decoded from Base64)'));
});

test('validation helpers and supported algorithm invariants behave consistently', () => {
  assert.equal(isHex(null), false);
  assert.equal(isHex(''), false);
  assert.equal(isHex('abc xyz'), false);
  assert.equal(isHex('0123456789abcdefABCDEF'), true);

  assert.equal(isValidHexKey('abcd'), false);
  assert.equal(isValidHexKey('00000000'), true);
  assert.equal(isValidHexKey('d41d8cd98f00b204e9800998ecf8427e'), true);

  assert.equal(isBase64(null), false);
  assert.equal(isBase64(''), false);
  assert.equal(isBase64('=='), false);
  assert.equal(isBase64('===='), false);
  assert.equal(decodeBase64('=='), null);
  assert.equal(decodeBase64('===='), null);
  assert.throws(() => parseExpectedHash('===='), /Invalid hash value/);
  assert.equal(decodeBase64('SGVsbG8='), 'Hello');
  assert.equal(decodeBase64('%%%'), null);

  assert.deepEqual(getProbableHashAlgorithms('00000000'), ['CRC32', 'CRC32C', 'ADLER32']);
  assert.deepEqual(getProbableHashAlgorithms('d41d8cd98f00b204e9800998ecf8427e'), ['MD5', 'BLAKE2S-128']);
  assert.deepEqual(getProbableHashAlgorithms('da39a3ee5e6b4b0d3255bfef95601890afd80709'), ['SHA-1', 'RIPEMD160']);
  assert.deepEqual(getProbableHashAlgorithms('0'.repeat(56)), ['SHA-224', 'SHA3-224']);
  assert.equal(getProbableHashAlgorithms('0'.repeat(64)).length, 9);
  assert.deepEqual(getProbableHashAlgorithms('0'.repeat(96)), ['SHA-384', 'SHA3-384', 'BLAKE2B-384']);
  assert.equal(getProbableHashAlgorithms('0'.repeat(128)).length, 5);
  assert.deepEqual(getProbableHashAlgorithms('invalid'), []);

  // Invariant: all 26 supported algorithms have valid hex length and appear in probable algorithms
  assert.equal(SUPPORTED_ALGORITHMS.length, 26);
  for (const algo of SUPPORTED_ALGORITHMS) {
    const hexLen = getExpectedHexLength(algo);
    assert.ok(hexLen > 0, `Expected positive hex length for ${algo}`);
    const dummyHex = '0'.repeat(hexLen);
    assert.equal(isValidHexKey(dummyHex), true);
    assert.ok(getProbableHashAlgorithms(dummyHex).includes(algo));
  }
});

test('suggestSaveFileName and formatFileSize format cleanly', () => {
  assert.equal(suggestSaveFileName('archive.zip', 'SHA-512/256'), 'archive.zip.sha-512-256.txt');
  assert.equal(suggestSaveFileName('a:b/c*d?.iso', 'SHA-256'), 'a_b_c_d_.iso.sha-256.txt');
  assert.equal(suggestSaveFileName(null, 'SHA-256'), 'hexy-sha-256.txt');
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(-5), '0 B');
  assert.equal(formatFileSize(Number.NaN), '0 B');
  assert.equal(formatFileSize(Number.POSITIVE_INFINITY), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1536), '1.50 KB');
});
