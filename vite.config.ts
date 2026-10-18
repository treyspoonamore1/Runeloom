import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base so the static build runs from any path (itch.io, artifact hosting, file servers).
  base: './',
  plugins: [preact()],
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
