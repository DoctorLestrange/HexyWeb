import { bytesToHex } from './hashUtils';

/**
 * Unified streaming interface for all hash & checksum implementations.
 */
export interface StreamingHasher {
  update(chunk: Uint8Array): void;
  digestHex(): string;
}

/* ============================================================================
 * CRC32 (IEEE 802.3) & CRC32C (Castagnoli)
 * ========================================================================== */

function buildCrcTable(polynomial: number): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ polynomial : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

const CRC32_TABLE = buildCrcTable(0xedb88320);
const CRC32C_TABLE = buildCrcTable(0x82f63b78);

function createCrcHasher(table: Uint32Array): StreamingHasher {
  let crc = 0xffffffff;
  return {
    update(chunk: Uint8Array) {
      let c = crc;
      for (let i = 0; i < chunk.length; i++) {
        c = table[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
      }
      crc = c;
    },
    digestHex() {
      return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
    },
  };
}

export function createCrc32Hasher(): StreamingHasher {
  return createCrcHasher(CRC32_TABLE);
}

export function createCrc32cHasher(): StreamingHasher {
  return createCrcHasher(CRC32C_TABLE);
}

/* ============================================================================
 * ADLER32 (RFC 1950)
 * ========================================================================== */

export function createAdler32Hasher(): StreamingHasher {
  const MOD_ADLER = 65521;
  const NMAX = 5552;
  let a = 1;
  let b = 0;

  return {
    update(chunk: Uint8Array) {
      let offset = 0;
      const len = chunk.length;
      while (offset < len) {
        const end = Math.min(offset + NMAX, len);
        for (let i = offset; i < end; i++) {
          a += chunk[i];
          b += a;
        }
        a %= MOD_ADLER;
        b %= MOD_ADLER;
        offset = end;
      }
    },
    digestHex() {
      const value = (((b & 0xffff) << 16) | (a & 0xffff)) >>> 0;
      return value.toString(16).padStart(8, '0');
    },
  };
}

/* ============================================================================
 * SM3 (GM/T 0004-2012)
 * ========================================================================== */

function rotl32(x: number, n: number): number {
  const shift = n & 31;
  return shift === 0 ? x >>> 0 : ((x << shift) | (x >>> (32 - shift))) >>> 0;
}

export function createSm3Hasher(): StreamingHasher {
  const V = new Uint32Array([
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
    0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
  ]);
  const block = new Uint8Array(64);
  const W = new Uint32Array(68);
  const W1 = new Uint32Array(64);
  let blockLen = 0;
  let totalBytes = 0n;

  function compress(buf: Uint8Array, offset: number): void {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      W[i] = ((buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]) >>> 0;
    }
    for (let j = 16; j < 68; j++) {
      const x = (W[j - 16] ^ W[j - 9] ^ rotl32(W[j - 3], 15)) >>> 0;
      const p1 = (x ^ rotl32(x, 15) ^ rotl32(x, 23)) >>> 0;
      W[j] = (p1 ^ rotl32(W[j - 13], 7) ^ W[j - 6]) >>> 0;
    }
    for (let j = 0; j < 64; j++) {
      W1[j] = (W[j] ^ W[j + 4]) >>> 0;
    }

    let A = V[0];
    let B = V[1];
    let C = V[2];
    let D = V[3];
    let E = V[4];
    let F = V[5];
    let G = V[6];
    let H = V[7];

    for (let j = 0; j < 64; j++) {
      const tj = j < 16 ? 0x79cc4519 : 0x7a879d8a;
      const ss1 = rotl32((rotl32(A, 12) + E + rotl32(tj, j)) >>> 0, 7);
      const ss2 = (ss1 ^ rotl32(A, 12)) >>> 0;
      const ff = j < 16 ? (A ^ B ^ C) >>> 0 : ((A & B) | (A & C) | (B & C)) >>> 0;
      const gg = j < 16 ? (E ^ F ^ G) >>> 0 : ((E & F) | ((~E) & G)) >>> 0;
      const tt1 = (ff + D + ss2 + W1[j]) >>> 0;
      const tt2 = (gg + H + ss1 + W[j]) >>> 0;

      D = C;
      C = rotl32(B, 9);
      B = A;
      A = tt1;
      H = G;
      G = rotl32(F, 19);
      F = E;
      E = (tt2 ^ rotl32(tt2, 9) ^ rotl32(tt2, 17)) >>> 0;
    }

    V[0] = (V[0] ^ A) >>> 0;
    V[1] = (V[1] ^ B) >>> 0;
    V[2] = (V[2] ^ C) >>> 0;
    V[3] = (V[3] ^ D) >>> 0;
    V[4] = (V[4] ^ E) >>> 0;
    V[5] = (V[5] ^ F) >>> 0;
    V[6] = (V[6] ^ G) >>> 0;
    V[7] = (V[7] ^ H) >>> 0;
  }

  return {
    update(chunk: Uint8Array) {
      totalBytes += BigInt(chunk.length);
      let offset = 0;
      if (blockLen > 0) {
        const need = 64 - blockLen;
        if (chunk.length < need) {
          block.set(chunk, blockLen);
          blockLen += chunk.length;
          return;
        }
        block.set(chunk.subarray(0, need), blockLen);
        compress(block, 0);
        blockLen = 0;
        offset = need;
      }
      while (offset + 64 <= chunk.length) {
        compress(chunk, offset);
        offset += 64;
      }
      if (offset < chunk.length) {
        block.set(chunk.subarray(offset), 0);
        blockLen = chunk.length - offset;
      }
    },
    digestHex() {
      const bitLen = totalBytes * 8n;
      block[blockLen++] = 0x80;
      if (blockLen > 56) {
        block.fill(0, blockLen, 64);
        compress(block, 0);
        blockLen = 0;
      }
      block.fill(0, blockLen, 56);
      const view = new DataView(block.buffer, block.byteOffset, 64);
      view.setUint32(56, Number((bitLen >> 32n) & 0xffffffffn), false);
      view.setUint32(60, Number(bitLen & 0xffffffffn), false);
      compress(block, 0);

      const out = new Uint8Array(32);
      const outView = new DataView(out.buffer);
      for (let i = 0; i < 8; i++) {
        outView.setUint32(i * 4, V[i], false);
      }
      return bytesToHex(out);
    },
  };
}

/* ============================================================================
 * ASCON-HASH256 (NIST SP 800-232) — 32-bit split-word zero-allocation engine
 * ========================================================================== */

const ASCON_RC = new Uint32Array([
  0xf0, 0xe1, 0xd2, 0xc3, 0xb4, 0xa5,
  0x96, 0x87, 0x78, 0x69, 0x5a, 0x4b,
]);

function asconPermute12(sH: Uint32Array, sL: Uint32Array): void {
  let x0H = sH[0], x0L = sL[0];
  let x1H = sH[1], x1L = sL[1];
  let x2H = sH[2], x2L = sL[2];
  let x3H = sH[3], x3L = sL[3];
  let x4H = sH[4], x4L = sL[4];

  for (let i = 0; i < 12; i++) {
    // Add round constant to low byte of x2
    x2L ^= ASCON_RC[i];

    // Substitution layer (5-bit bitsliced S-box)
    x0H ^= x4H; x0L ^= x4L;
    x4H ^= x3H; x4L ^= x3L;
    x2H ^= x1H; x2L ^= x1L;

    const t0H = ~x0H & x1H, t0L = ~x0L & x1L;
    const t1H = ~x1H & x2H, t1L = ~x1L & x2L;
    const t2H = ~x2H & x3H, t2L = ~x2L & x3L;
    const t3H = ~x3H & x4H, t3L = ~x3L & x4L;
    const t4H = ~x4H & x0H, t4L = ~x4L & x0L;

    x0H ^= t1H; x0L ^= t1L;
    x1H ^= t2H; x1L ^= t2L;
    x2H ^= t3H; x2L ^= t3L;
    x3H ^= t4H; x3L ^= t4L;
    x4H ^= t0H; x4L ^= t0L;

    x1H ^= x0H; x1L ^= x0L;
    x0H ^= x4H; x0L ^= x4L;
    x3H ^= x2H; x3L ^= x2L;
    x2H = ~x2H; x2L = ~x2L;

    // Linear diffusion layer:
    // x0 ^= rotr(x0, 19) ^ rotr(x0, 28)
    let r1H = (x0H >>> 19) | (x0L << 13);
    let r1L = (x0L >>> 19) | (x0H << 13);
    let r2H = (x0H >>> 28) | (x0L << 4);
    let r2L = (x0L >>> 28) | (x0H << 4);
    x0H ^= r1H ^ r2H;
    x0L ^= r1L ^ r2L;

    // x1 ^= rotr(x1, 61) ^ rotr(x1, 39)  (61 = 32 + 29, 39 = 32 + 7)
    r1H = (x1L >>> 29) | (x1H << 3);
    r1L = (x1H >>> 29) | (x1L << 3);
    r2H = (x1L >>> 7) | (x1H << 25);
    r2L = (x1H >>> 7) | (x1L << 25);
    x1H ^= r1H ^ r2H;
    x1L ^= r1L ^ r2L;

    // x2 ^= rotr(x2, 1) ^ rotr(x2, 6)
    r1H = (x2H >>> 1) | (x2L << 31);
    r1L = (x2L >>> 1) | (x2H << 31);
    r2H = (x2H >>> 6) | (x2L << 26);
    r2L = (x2L >>> 6) | (x2H << 26);
    x2H ^= r1H ^ r2H;
    x2L ^= r1L ^ r2L;

    // x3 ^= rotr(x3, 10) ^ rotr(x3, 17)
    r1H = (x3H >>> 10) | (x3L << 22);
    r1L = (x3L >>> 10) | (x3H << 22);
    r2H = (x3H >>> 17) | (x3L << 15);
    r2L = (x3L >>> 17) | (x3H << 15);
    x3H ^= r1H ^ r2H;
    x3L ^= r1L ^ r2L;

    // x4 ^= rotr(x4, 7) ^ rotr(x4, 41)  (41 = 32 + 9)
    r1H = (x4H >>> 7) | (x4L << 25);
    r1L = (x4L >>> 7) | (x4H << 25);
    r2H = (x4L >>> 9) | (x4H << 23);
    r2L = (x4H >>> 9) | (x4L << 23);
    x4H ^= r1H ^ r2H;
    x4L ^= r1L ^ r2L;
  }

  sH[0] = x0H >>> 0; sL[0] = x0L >>> 0;
  sH[1] = x1H >>> 0; sL[1] = x1L >>> 0;
  sH[2] = x2H >>> 0; sL[2] = x2L >>> 0;
  sH[3] = x3H >>> 0; sL[3] = x3L >>> 0;
  sH[4] = x4H >>> 0; sL[4] = x4L >>> 0;
}

const { ASCON_INIT_H, ASCON_INIT_L } = (() => {
  const sH = new Uint32Array(5);
  const sL = new Uint32Array(5);
  sH[0] = 0x00000801;
  sL[0] = 0x00cc0002;
  asconPermute12(sH, sL);
  return { ASCON_INIT_H: sH, ASCON_INIT_L: sL };
})();

export function createAsconHash256Hasher(): StreamingHasher {
  const sH = new Uint32Array(ASCON_INIT_H);
  const sL = new Uint32Array(ASCON_INIT_L);
  const block = new Uint8Array(8);
  let blockLen = 0;

  function absorb8(buf: Uint8Array, o: number): void {
    const lo = (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0;
    const hi = (buf[o + 4] | (buf[o + 5] << 8) | (buf[o + 6] << 16) | (buf[o + 7] << 24)) >>> 0;
    sL[0] = (sL[0] ^ lo) >>> 0;
    sH[0] = (sH[0] ^ hi) >>> 0;
    asconPermute12(sH, sL);
  }

  return {
    update(chunk: Uint8Array) {
      let offset = 0;
      if (blockLen > 0) {
        const need = 8 - blockLen;
        if (chunk.length < need) {
          block.set(chunk, blockLen);
          blockLen += chunk.length;
          return;
        }
        block.set(chunk.subarray(0, need), blockLen);
        absorb8(block, 0);
        blockLen = 0;
        offset = need;
      }
      while (offset + 8 <= chunk.length) {
        absorb8(chunk, offset);
        offset += 8;
      }
      if (offset < chunk.length) {
        block.set(chunk.subarray(offset), 0);
        blockLen = chunk.length - offset;
      }
    },
    digestHex() {
      // Absorb final partial block + NIST SP 800-232 0x01 pad byte
      block.fill(0, blockLen, 8);
      block[blockLen] = 0x01;
      absorb8(block, 0);

      // Squeeze 32 bytes (4 x 64-bit little-endian blocks)
      const out = new Uint8Array(32);
      for (let blk = 0; blk < 4; blk++) {
        const lo = sL[0];
        const hi = sH[0];
        const base = blk * 8;
        out[base] = lo & 0xff;
        out[base + 1] = (lo >>> 8) & 0xff;
        out[base + 2] = (lo >>> 16) & 0xff;
        out[base + 3] = (lo >>> 24) & 0xff;
        out[base + 4] = hi & 0xff;
        out[base + 5] = (hi >>> 8) & 0xff;
        out[base + 6] = (hi >>> 16) & 0xff;
        out[base + 7] = (hi >>> 24) & 0xff;
        if (blk < 3) {
          asconPermute12(sH, sL);
        }
      }
      return bytesToHex(out);
    },
  };
}

/* ============================================================================
 * WHIRLPOOL (ISO/IEC 10118-3)
 * ========================================================================== */

const WHIRLPOOL_SBOX = new Uint8Array([
  0x18, 0x23, 0xc6, 0xe8, 0x87, 0xb8, 0x01, 0x4f, 0x36, 0xa6, 0xd2, 0xf5, 0x79, 0x6f, 0x91, 0x52,
  0x60, 0xbc, 0x9b, 0x8e, 0xa3, 0x0c, 0x7b, 0x35, 0x1d, 0xe0, 0xd7, 0xc2, 0x2e, 0x4b, 0xfe, 0x57,
  0x15, 0x77, 0x37, 0xe5, 0x9f, 0xf0, 0x4a, 0xda, 0x58, 0xc9, 0x29, 0x0a, 0xb1, 0xa0, 0x6b, 0x85,
  0xbd, 0x5d, 0x10, 0xf4, 0xcb, 0x3e, 0x05, 0x67, 0xe4, 0x27, 0x41, 0x8b, 0xa7, 0x7d, 0x95, 0xd8,
  0xfb, 0xee, 0x7c, 0x66, 0xdd, 0x17, 0x47, 0x9e, 0xca, 0x2d, 0xbf, 0x07, 0xad, 0x5a, 0x83, 0x33,
  0x63, 0x02, 0xaa, 0x71, 0xc8, 0x19, 0x49, 0xd9, 0xf2, 0xe3, 0x5b, 0x88, 0x9a, 0x26, 0x32, 0xb0,
  0xe9, 0x0f, 0xd5, 0x80, 0xbe, 0xcd, 0x34, 0x48, 0xff, 0x7a, 0x90, 0x5f, 0x20, 0x68, 0x1a, 0xae,
  0xb4, 0x54, 0x93, 0x22, 0x64, 0xf1, 0x73, 0x12, 0x40, 0x08, 0xc3, 0xec, 0xdb, 0xa1, 0x8d, 0x3d,
  0x97, 0x00, 0xcf, 0x2b, 0x76, 0x82, 0xd6, 0x1b, 0xb5, 0xaf, 0x6a, 0x50, 0x45, 0xf3, 0x30, 0xef,
  0x3f, 0x55, 0xa2, 0xea, 0x65, 0xba, 0x2f, 0xc0, 0xde, 0x1c, 0xfd, 0x4d, 0x92, 0x75, 0x06, 0x8a,
  0xb2, 0xe6, 0x0e, 0x1f, 0x62, 0xd4, 0xa8, 0x96, 0xf9, 0xc5, 0x25, 0x59, 0x84, 0x72, 0x39, 0x4c,
  0x5e, 0x78, 0x38, 0x8c, 0xd1, 0xa5, 0xe2, 0x61, 0xb3, 0x21, 0x9c, 0x1e, 0x43, 0xc7, 0xfc, 0x04,
  0x51, 0x99, 0x6d, 0x0d, 0xfa, 0xdf, 0x7e, 0x24, 0x3b, 0xab, 0xce, 0x11, 0x8f, 0x4e, 0xb7, 0xeb,
  0x3c, 0x81, 0x94, 0xf7, 0xb9, 0x13, 0x2c, 0xd3, 0xe7, 0x6e, 0xc4, 0x03, 0x56, 0x44, 0x7f, 0xa9,
  0x2a, 0xbb, 0xc1, 0x53, 0xdc, 0x0b, 0x9d, 0x6c, 0x31, 0x74, 0xf6, 0x46, 0xac, 0x89, 0x14, 0xe1,
  0x16, 0x3a, 0x69, 0x09, 0x70, 0xb6, 0xd0, 0xed, 0xcc, 0x42, 0x98, 0xa4, 0x28, 0x5c, 0xf8, 0x86,
]);

// Precompute 8 circulant T-tables (split into hi/lo Uint32Array for high-speed execution without BigInt overhead)
const { WP_C_HI, WP_C_LO, WP_RC_HI, WP_RC_LO } = (() => {
  const cHi: Uint32Array[] = Array.from({ length: 8 }, () => new Uint32Array(256));
  const cLo: Uint32Array[] = Array.from({ length: 8 }, () => new Uint32Array(256));

  function mulGf256(a: number, b: number): number {
    let p = 0;
    let aa = a;
    let bb = b;
    for (let i = 0; i < 8; i++) {
      if ((bb & 1) !== 0) p ^= aa;
      const hi = aa & 0x80;
      aa = (aa << 1) & 0xff;
      if (hi !== 0) aa ^= 0x1d; // x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
      bb >>>= 1;
    }
    return p;
  }

  // MDS circulant first row: [1, 1, 4, 1, 8, 5, 2, 9]
  const mds = [1, 1, 4, 1, 8, 5, 2, 9];
  for (let x = 0; x < 256; x++) {
    const s = WHIRLPOOL_SBOX[x];
    const row = mds.map((m) => mulGf256(s, m));
    // C0[x] has bytes [row[0], row[1], ..., row[7]]
    let hi = ((row[0] << 24) | (row[1] << 16) | (row[2] << 8) | row[3]) >>> 0;
    let lo = ((row[4] << 24) | (row[5] << 16) | (row[6] << 8) | row[7]) >>> 0;
    cHi[0][x] = hi;
    cLo[0][x] = lo;
    // Ct[x] is C0[x] rotated right by t bytes (8*t bits)
    for (let t = 1; t < 8; t++) {
      const nextHi = (((lo & 0xff) << 24) | (hi >>> 8)) >>> 0;
      const nextLo = (((hi & 0xff) << 24) | (lo >>> 8)) >>> 0;
      hi = nextHi;
      lo = nextLo;
      cHi[t][x] = hi;
      cLo[t][x] = lo;
    }
  }

  const rcHi = new Uint32Array(11);
  const rcLo = new Uint32Array(11);
  for (let r = 1; r <= 10; r++) {
    const i = 8 * (r - 1);
    rcHi[r] =
      ((WHIRLPOOL_SBOX[i] << 24) |
        (WHIRLPOOL_SBOX[i + 1] << 16) |
        (WHIRLPOOL_SBOX[i + 2] << 8) |
        WHIRLPOOL_SBOX[i + 3]) >>>
      0;
    rcLo[r] =
      ((WHIRLPOOL_SBOX[i + 4] << 24) |
        (WHIRLPOOL_SBOX[i + 5] << 16) |
        (WHIRLPOOL_SBOX[i + 6] << 8) |
        WHIRLPOOL_SBOX[i + 7]) >>>
      0;
  }

  return { WP_C_HI: cHi, WP_C_LO: cLo, WP_RC_HI: rcHi, WP_RC_LO: rcLo };
})();

export function createWhirlpoolHasher(): StreamingHasher {
  const hashHi = new Uint32Array(8);
  const hashLo = new Uint32Array(8);
  const blockHi = new Uint32Array(8);
  const blockLo = new Uint32Array(8);
  const KHi = new Uint32Array(8);
  const KLo = new Uint32Array(8);
  const LHi = new Uint32Array(8);
  const LLo = new Uint32Array(8);
  const stateHi = new Uint32Array(8);
  const stateLo = new Uint32Array(8);

  const buffer = new Uint8Array(64);
  let bufLen = 0;
  let totalBytes = 0n;

  const C0H = WP_C_HI[0], C1H = WP_C_HI[1], C2H = WP_C_HI[2], C3H = WP_C_HI[3];
  const C4H = WP_C_HI[4], C5H = WP_C_HI[5], C6H = WP_C_HI[6], C7H = WP_C_HI[7];
  const C0L = WP_C_LO[0], C1L = WP_C_LO[1], C2L = WP_C_LO[2], C3L = WP_C_LO[3];
  const C4L = WP_C_LO[4], C5L = WP_C_LO[5], C6L = WP_C_LO[6], C7L = WP_C_LO[7];

  function compress(buf: Uint8Array, offset: number): void {
    for (let i = 0; i < 8; i++) {
      const p = offset + i * 8;
      blockHi[i] = ((buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]) >>> 0;
      blockLo[i] = ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0;
      KHi[i] = hashHi[i];
      KLo[i] = hashLo[i];
      stateHi[i] = (blockHi[i] ^ KHi[i]) >>> 0;
      stateLo[i] = (blockLo[i] ^ KLo[i]) >>> 0;
    }

    for (let r = 1; r <= 10; r++) {
      // Key schedule round
      for (let i = 0; i < 8; i++) {
        const i0 = i;
        const i1 = (i + 7) & 7;
        const i2 = (i + 6) & 7;
        const i3 = (i + 5) & 7;
        const i4 = (i + 4) & 7;
        const i5 = (i + 3) & 7;
        const i6 = (i + 2) & 7;
        const i7 = (i + 1) & 7;

        const b0 = (KHi[i0] >>> 24) & 0xff;
        const b1 = (KHi[i1] >>> 16) & 0xff;
        const b2 = (KHi[i2] >>> 8) & 0xff;
        const b3 = KHi[i3] & 0xff;
        const b4 = (KLo[i4] >>> 24) & 0xff;
        const b5 = (KLo[i5] >>> 16) & 0xff;
        const b6 = (KLo[i6] >>> 8) & 0xff;
        const b7 = KLo[i7] & 0xff;

        LHi[i] = (C0H[b0] ^ C1H[b1] ^ C2H[b2] ^ C3H[b3] ^ C4H[b4] ^ C5H[b5] ^ C6H[b6] ^ C7H[b7]) >>> 0;
        LLo[i] = (C0L[b0] ^ C1L[b1] ^ C2L[b2] ^ C3L[b3] ^ C4L[b4] ^ C5L[b5] ^ C6L[b6] ^ C7L[b7]) >>> 0;
      }
      LHi[0] = (LHi[0] ^ WP_RC_HI[r]) >>> 0;
      LLo[0] = (LLo[0] ^ WP_RC_LO[r]) >>> 0;
      for (let i = 0; i < 8; i++) {
        KHi[i] = LHi[i];
        KLo[i] = LLo[i];
      }

      // State round
      for (let i = 0; i < 8; i++) {
        const i0 = i;
        const i1 = (i + 7) & 7;
        const i2 = (i + 6) & 7;
        const i3 = (i + 5) & 7;
        const i4 = (i + 4) & 7;
        const i5 = (i + 3) & 7;
        const i6 = (i + 2) & 7;
        const i7 = (i + 1) & 7;

        const b0 = (stateHi[i0] >>> 24) & 0xff;
        const b1 = (stateHi[i1] >>> 16) & 0xff;
        const b2 = (stateHi[i2] >>> 8) & 0xff;
        const b3 = stateHi[i3] & 0xff;
        const b4 = (stateLo[i4] >>> 24) & 0xff;
        const b5 = (stateLo[i5] >>> 16) & 0xff;
        const b6 = (stateLo[i6] >>> 8) & 0xff;
        const b7 = stateLo[i7] & 0xff;

        LHi[i] = (C0H[b0] ^ C1H[b1] ^ C2H[b2] ^ C3H[b3] ^ C4H[b4] ^ C5H[b5] ^ C6H[b6] ^ C7H[b7] ^ KHi[i]) >>> 0;
        LLo[i] = (C0L[b0] ^ C1L[b1] ^ C2L[b2] ^ C3L[b3] ^ C4L[b4] ^ C5L[b5] ^ C6L[b6] ^ C7L[b7] ^ KLo[i]) >>> 0;
      }
      for (let i = 0; i < 8; i++) {
        stateHi[i] = LHi[i];
        stateLo[i] = LLo[i];
      }
    }

    // Miyaguchi-Preneel feed-forward
    for (let i = 0; i < 8; i++) {
      hashHi[i] = (hashHi[i] ^ stateHi[i] ^ blockHi[i]) >>> 0;
      hashLo[i] = (hashLo[i] ^ stateLo[i] ^ blockLo[i]) >>> 0;
    }
  }

  return {
    update(chunk: Uint8Array) {
      totalBytes += BigInt(chunk.length);
      let offset = 0;
      if (bufLen > 0) {
        const need = 64 - bufLen;
        if (chunk.length < need) {
          buffer.set(chunk, bufLen);
          bufLen += chunk.length;
          return;
        }
        buffer.set(chunk.subarray(0, need), bufLen);
        compress(buffer, 0);
        bufLen = 0;
        offset = need;
      }
      while (offset + 64 <= chunk.length) {
        compress(chunk, offset);
        offset += 64;
      }
      if (offset < chunk.length) {
        buffer.set(chunk.subarray(offset), 0);
        bufLen = chunk.length - offset;
      }
    },
    digestHex() {
      const bitLen = totalBytes * 8n;
      buffer[bufLen++] = 0x80;
      if (bufLen > 32) {
        buffer.fill(0, bufLen, 64);
        compress(buffer, 0);
        bufLen = 0;
      }
      buffer.fill(0, bufLen, 64);
      // 256-bit big-endian bit length in bytes 32..63
      let len = bitLen;
      for (let i = 63; i >= 32 && len > 0n; i--) {
        buffer[i] = Number(len & 0xffn);
        len >>= 8n;
      }
      compress(buffer, 0);

      const out = new Uint8Array(64);
      const view = new DataView(out.buffer);
      for (let i = 0; i < 8; i++) {
        view.setUint32(i * 8, hashHi[i], false);
        view.setUint32(i * 8 + 4, hashLo[i], false);
      }
      return bytesToHex(out);
    },
  };
}
