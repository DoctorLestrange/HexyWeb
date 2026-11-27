import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBlobHash, calculateBytesHash, formatHashError } from './hashEngine';

const EMPTY_VECTORS: Record<string, string> = {
  MD5: 'd41d8cd98f00b204e9800998ecf8427e',
  'SHA-1': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
  'SHA-224': 'd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f',
  'SHA-256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'SHA-384': '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
  'SHA-512': 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  'SHA-512/256': 'c672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967a',
  'SHA3-224': '6b4e03423667dbb73b6e15454f0eb1abd4597f9a1b078e3f5b5a6bc7',
  'SHA3-256': 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
  'SHA3-384': '0c63a75b845e4f7d01107d852e4c2485c51a50aaaa94fc61995e71bbee983a2ac3713831264adb47fb6bd1e058d5f004',
  'SHA3-512': 'a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26',
  'SHAKE128-256': '7f9c2ba4e88f827d616045507605853ed73b8093f6efbc88eb1a6eacfa66ef26',
  'SHAKE256-512': '46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762fd75dc4ddd8c0f200cb05019d67b592f6fc821c49479ab48640292eacb3b7c4be',
  'BLAKE2S-128': '64550d6ffe2c0a01a14aba1eade0200c',
  'BLAKE2S-256': '69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9',
  'BLAKE2B-256': '0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8',
  'BLAKE2B-384': 'b32811423377f52d7862286ee1a72ee540524380fda1724a6f25d7978c6fd3244a6caf0498812673c5e05ef583825100',
  'BLAKE2B-512': '786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce',
  'BLAKE3-256': 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262',
  'ASCON-HASH256': '0b3be5850f2f6b98caf29f8fdea89b64a1fa70aa249b8f839bd53baa304d92b2',
  RIPEMD160: '9c1185a5c5e9fc54612808977ee8f548b2258d31',
  WHIRLPOOL: '19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3',
  SM3: '1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b',
  CRC32: '00000000',
  CRC32C: '00000000',
  ADLER32: '00000001',
};

const ABC_VECTORS: Record<string, string> = {
  MD5: '900150983cd24fb0d6963f7d28e17f72',
  'SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
  'SHA-224': '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7',
  'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-384': 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
  'SHA-512/256': '53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23',
  'SHA3-224': 'e642824c3f8cf24ad09234ee7d3c766fc9a3a5168d0c94ad73b46fdf',
  'SHA3-256': '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
  'SHA3-384': 'ec01498288516fc926459f58e2c6ad8df9b473cb0fc08c2596da7cf0e49be4b298d88cea927ac7f539f1edf228376d25',
  'SHAKE128-256': '5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8',
  'SHAKE256-512': '483366601360a8771c6863080cc4114d8db44530f8f1e1ee4f94ea37e78b5739d5a15bef186a5386c75744c0527e1faa9f8726e462a12a4feb06bd8801e751e4',
  'BLAKE2S-256': '508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982',
  'BLAKE2B-384': '6f56a82c8e7ef526dfe182eb5212f7db9df1317e57815dbda46083fc30f54ee6c66ba83be64b302d7cba6ce15bb556f4',
  'BLAKE2B-512': 'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923',
  'BLAKE3-256': '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
  'ASCON-HASH256': '45aa03431c3c829b3b066f33e844b0cc4d20a45af92d3dcfdf34f40fc20935cf',
  RIPEMD160: '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc',
  WHIRLPOOL: '4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5',
  SM3: '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0',
  CRC32: '352441c2',
  CRC32C: '364b3fb7',
  ADLER32: '024d0127',
};

test('all 26 supported algorithms match Java/Bouncy Castle empty-file vectors', async () => {
  const emptyBlob = new Blob([]);
  for (const [algo, expected] of Object.entries(EMPTY_VECTORS)) {
    const actual = await calculateBlobHash(emptyBlob, algo);
    assert.equal(actual, expected, `Empty-file mismatch for ${algo}`);
  }
});

test('all supported algorithms match Java/Bouncy Castle "abc" vectors', async () => {
  const abcBlob = new Blob([new TextEncoder().encode('abc')]);
  for (const [algo, expected] of Object.entries(ABC_VECTORS)) {
    const actual = await calculateBlobHash(abcBlob, algo);
    assert.equal(actual, expected, `"abc" mismatch for ${algo}`);
  }
});

test('CRC32 pads leading zeroes correctly on "123456"', async () => {
  const blob = new Blob([new TextEncoder().encode('123456')]);
  const crc = await calculateBlobHash(blob, 'CRC32');
  assert.equal(crc, '0972d361');
  assert.equal(crc?.length, 8);
});

test('multi-chunk streaming progress and hashes match single-shot across custom and noble algorithms', async () => {
  const data = new Uint8Array(600 * 1024 + 17);
  for (let i = 0; i < data.length; i++) {
    data[i] = i & 0xff;
  }
  const blob = new Blob([data]);

  const percents: number[] = [];
  const sha256 = await calculateBlobHash(
    blob,
    'SHA-256',
    () => false,
    (_read, _total, pct) => percents.push(pct),
    128 * 1024
  );
  assert.ok(sha256);
  assert.equal(sha256.length, 64);
  assert.ok(percents.length > 1);
  assert.equal(percents[percents.length - 1], 100);
  for (let i = 1; i < percents.length; i++) {
    assert.ok(percents[i] >= percents[i - 1]);
    assert.ok(percents[i] <= 100);
  }

  // Verify chunked streaming matches single-shot for custom algorithms too
  for (const algo of ['ASCON-HASH256', 'SM3', 'WHIRLPOOL', 'CRC32', 'CRC32C', 'ADLER32'] as const) {
    const single = calculateBytesHash(data, algo, () => false, undefined, data.length);
    const chunked = await calculateBlobHash(blob, algo, () => false, undefined, 77777);
    assert.equal(chunked, single, `Chunked vs single-shot mismatch for ${algo}`);
  }
});

test('cancellation returns null early during multi-chunk hashing', async () => {
  const data = new Uint8Array(1024 * 1024);
  const blob = new Blob([data]);
  let cancelled = false;
  const result = await calculateBlobHash(
    blob,
    'SHA-256',
    () => cancelled,
    () => {
      cancelled = true;
    },
    128 * 1024
  );
  assert.equal(result, null);
});

test('custom algorithms match single-shot across block-boundary lengths and 1-byte/odd chunks', async () => {
  const boundaryLengths = [0, 1, 7, 8, 9, 31, 32, 33, 55, 56, 57, 63, 64, 65, 128];
  const algos = ['ASCON-HASH256', 'SM3', 'WHIRLPOOL'] as const;

  for (const len of boundaryLengths) {
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buf[i] = (i * 37 + 13) & 0xff;
    }
    for (const algo of algos) {
      const single = calculateBytesHash(buf, algo, () => false, undefined, Math.max(1, len));
      const oneByte = calculateBytesHash(buf, algo, () => false, undefined, 1);
      const sevenByte = await calculateBlobHash(new Blob([buf]), algo, () => false, undefined, 7, true);
      assert.equal(oneByte, single, `1-byte chunk mismatch for ${algo} len=${len}`);
      assert.equal(sevenByte, single, `7-byte fallback chunk mismatch for ${algo} len=${len}`);
    }
  }
});

test('formatHashError translates NotReadableError DOMException cleanly', () => {
  const notReadable = new DOMException('The requested file could not be read', 'NotReadableError');
  const formatted = formatHashError(notReadable);
  assert.ok(formatted.includes('Could not read the selected file'));
  assert.equal(formatHashError(new Error('boom')), 'boom');
  assert.equal(formatHashError(null), 'Hashing failed.');
});
