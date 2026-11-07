import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// A few tests on what's easy to break and costly when it does: edit ops, the export, disk safety. Node only.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['node_modules', '.next', '.next-check'] },
});
