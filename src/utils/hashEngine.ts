import { md5, sha1, ripemd160 } from '@noble/hashes/legacy';
import { sha224, sha256, sha384, sha512, sha512_256 } from '@noble/hashes/sha2';
import { sha3_224, sha3_256, sha3_384, sha3_512, shake128, shake256 } from '@noble/hashes/sha3';
import { blake2b, blake2s } from '@noble/hashes/blake2';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex, type HashAlgorithm } from './hashUtils';
import {
  createAdler32Hasher,
  createAsconHash256Hasher,
  createCrc32Hasher,
  createCrc32cHasher,
  createSm3Hasher,
  createWhirlpoolHasher,
  type StreamingHasher,
} from './customAlgorithms';

/** Default chunk size for streaming file reads (512 KB — fast and responsive for progress/cancellation). */
export const STREAM_CHUNK_SIZE = 512 * 1024;

interface NobleHashInstance {
  update(buf: Uint8Array): unknown;
  digest(): Uint8Array;
}

function wrapNoble(instance: NobleHashInstance): StreamingHasher {
  return {
    update(chunk: Uint8Array) {
      instance.update(chunk);
    },
    digestHex() {
      return bytesToHex(instance.digest());
    },
  };
}

/**
 * Instantiates a fresh streaming hasher for any of Hexy's 26 supported algorithms.
 */
export function createStreamingHasher(algorithm: HashAlgorithm | string): StreamingHasher {
  const normalized = algorithm.trim().toUpperCase();
  switch (normalized) {
    case 'MD5':
      return wrapNoble(md5.create());
    case 'SHA-1':
      return wrapNoble(sha1.create());
    case 'SHA-224':
      return wrapNoble(sha224.create());
    case 'SHA-256':
      return wrapNoble(sha256.create());
    case 'SHA-384':
      return wrapNoble(sha384.create());
    case 'SHA-512':
      return wrapNoble(sha512.create());
    case 'SHA-512/256':
      return wrapNoble(sha512_256.create());
    case 'SHA3-224':
      return wrapNoble(sha3_224.create());
    case 'SHA3-256':
      return wrapNoble(sha3_256.create());
    case 'SHA3-384':
      return wrapNoble(sha3_384.create());
    case 'SHA3-512':
      return wrapNoble(sha3_512.create());
    case 'SHAKE128-256':
      return wrapNoble(shake128.create({ dkLen: 32 }));
    case 'SHAKE256-512':
      return wrapNoble(shake256.create({ dkLen: 64 }));
    case 'BLAKE2S-128':
      return wrapNoble(blake2s.create({ dkLen: 16 }));
    case 'BLAKE2S-256':
      return wrapNoble(blake2s.create({ dkLen: 32 }));
    case 'BLAKE2B-256':
      return wrapNoble(blake2b.create({ dkLen: 32 }));
    case 'BLAKE2B-384':
      return wrapNoble(blake2b.create({ dkLen: 48 }));
    case 'BLAKE2B-512':
      return wrapNoble(blake2b.create({ dkLen: 64 }));
    case 'BLAKE3-256':
      return wrapNoble(blake3.create({ dkLen: 32 }));
    case 'ASCON-HASH256':
      return createAsconHash256Hasher();
    case 'RIPEMD160':
      return wrapNoble(ripemd160.create());
    case 'WHIRLPOOL':
      return createWhirlpoolHasher();
    case 'SM3':
      return createSm3Hasher();
    case 'CRC32':
      return createCrc32Hasher();
    case 'CRC32C':
      return createCrc32cHasher();
    case 'ADLER32':
      return createAdler32Hasher();
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

export type ProgressCallback = (bytesRead: number, totalBytes: number, percent: number) => void;

/**
 * Formats file-reading / hashing errors into clear user-facing messages.
 */
export function formatHashError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotReadableError') {
    return 'Could not read the selected file (it may have been moved, modified, or deleted). Please select the file again.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Hashing failed.';
}

/**
 * Streams a Blob/File in bounded chunks so large files never load completely into memory.
 * Returns lowercase hex digest, or null if cancelled.
 */
export async function calculateBlobHash(
  blob: Blob,
  algorithm: HashAlgorithm | string,
  isCancelled: () => boolean = () => false,
  onProgress?: ProgressCallback,
  chunkSize: number = STREAM_CHUNK_SIZE,
  yieldBetweenChunks: boolean = false
): Promise<string | null> {
  if (isCancelled()) {
    return null;
  }

  const hasher = createStreamingHasher(algorithm);
  const totalBytes = blob.size;
  let offset = 0;
  let lastPercent = -1;

  if (totalBytes === 0) {
    if (onProgress) {
      onProgress(0, 0, 100);
    }
    return hasher.digestHex();
  }

  while (offset < totalBytes) {
    if (isCancelled()) {
      return null;
    }
    const end = Math.min(offset + chunkSize, totalBytes);
    const slice = blob.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    if (isCancelled()) {
      return null;
    }
    hasher.update(new Uint8Array(buffer));
    offset = end;

    if (onProgress) {
      const percent = Math.max(0, Math.min(100, Math.floor((offset * 100) / totalBytes)));
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress(offset, totalBytes, percent);
      }
    }

    if (yieldBetweenChunks && offset < totalBytes) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  if (isCancelled()) {
    return null;
  }
  if (onProgress && lastPercent !== 100) {
    onProgress(totalBytes, totalBytes, 100);
  }
  return hasher.digestHex();
}

/**
 * Synchronous streaming helper for Uint8Array inputs (useful in tests and small buffers).
 */
export function calculateBytesHash(
  data: Uint8Array,
  algorithm: HashAlgorithm | string,
  isCancelled: () => boolean = () => false,
  onProgress?: ProgressCallback,
  chunkSize: number = 256 * 1024
): string | null {
  if (isCancelled()) {
    return null;
  }

  const hasher = createStreamingHasher(algorithm);
  const totalBytes = data.length;

  if (totalBytes === 0) {
    if (onProgress) {
      onProgress(0, 0, 100);
    }
    return hasher.digestHex();
  }

  let offset = 0;
  let lastPercent = -1;

  while (offset < totalBytes) {
    if (isCancelled()) {
      return null;
    }
    const end = Math.min(offset + chunkSize, totalBytes);
    hasher.update(data.subarray(offset, end));
    offset = end;

    if (onProgress) {
      const percent = Math.max(0, Math.min(100, Math.floor((offset * 100) / totalBytes)));
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress(offset, totalBytes, percent);
      }
    }
  }

  if (isCancelled()) {
    return null;
  }
  if (onProgress && lastPercent !== 100) {
    onProgress(totalBytes, totalBytes, 100);
  }
  return hasher.digestHex();
}
