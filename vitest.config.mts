import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic in lib/ (and later the API routes). Node only: no browser.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['node_modules', '.next'] },
});
