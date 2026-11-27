# Contributing to Hexy

Contributions are welcome and appreciated!

## Getting Started

1. Fork the repository and create a branch from `main`.
2. Ensure you have **Node.js 20+** and **npm** installed.
3. Install dependencies and run the verification suite:
   ```bash
   npm install
   npm run lint
   npm test
   npm run build
   ```

## Guidelines

- Keep hashing, parsing, preferences, and logging logic decoupled from React UI components inside `src/utils/` so it stays headlessly testable via `node:test`.
- Keep all file processing strictly client-side — never transmit user files, hashes, or logs over the network.
- Add or update unit tests in `src/utils/*.test.ts` for any bug fixes or new features.
- Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.
