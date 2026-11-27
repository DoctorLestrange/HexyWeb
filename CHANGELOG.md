# Changelog

All notable changes to **Hexy** will be documented in this file.

## [0.0.1] - 2026-11-26

### Added
- Support for 26 hash and checksum algorithms running 100% locally in the browser: `MD5`, `SHA-1`, `SHA-224`, `SHA-256`, `SHA-384`, `SHA-512`, `SHA-512/256`, `SHA3-224`, `SHA3-256`, `SHA3-384`, `SHA3-512`, `SHAKE128-256`, `SHAKE256-512`, `BLAKE2S-128`, `BLAKE2S-256`, `BLAKE2B-256`, `BLAKE2B-384`, `BLAKE2B-512`, `BLAKE3-256`, `ASCON-HASH256`, `RIPEMD160`, `WHIRLPOOL`, `SM3`, `CRC32`, `CRC32C`, and `ADLER32`.
- Automatic algorithm detection when *Select Hash Algorithm* is unchecked.
- Expected hash verification supporting hexadecimal (including uppercase, spaces, `0x` prefix, and colon-separated bytes) and Base64-encoded digests (standard or URL-safe, raw bytes or ASCII hex).
- Non-blocking streaming file hashing in a dedicated Web Worker (with automatic chunked main-thread fallback), live percentage progress, and instant cancellation.
- Top menu bar with **File** (*Open...*, *Save Hash...*, *Clear All*), **Edit** (*Preferences...*, *Logs...*), and **Help** (*How to Use*, *About Hexy*) menus and full keyboard navigation.
- Local browser preferences (`localStorage`) and persistent rotating activity logs with export and clear confirmation.
- Drag-and-drop file input, clipboard **Paste** / **Copy** actions, keyboard shortcuts, and two themes (**Dark Graphite** and **Light Off-White**).
- Comprehensive `node:test` verification suite covering all 26 algorithms, edge-case parsing, streaming chunks, preferences, and logging.
