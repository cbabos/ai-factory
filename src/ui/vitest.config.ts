import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      react: fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url)),
      'react/jsx-runtime': fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url)),
      'react/jsx-dev-runtime': fileURLToPath(new URL('./node_modules/react/jsx-dev-runtime.js', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '**/theme/**/__tests__/**/*.test.ts',
      '**/test/**/*.test.ts',
    ],
    exclude: ['dist/**', 'node_modules/**', '**/components/**/__tests__/**', '**/pages/**/__tests__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
