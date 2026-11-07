import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for lib/, the API routes against a temp folder, and drawing snapshots. Node only: no browser.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },   // the app's tsconfig leaves JSX to Next; tests render components (drawing snapshots)
  test: { environment: 'node', include: ['**/*.test.{ts,tsx}'], exclude: ['node_modules', '.next', '.next-check'] },
});
