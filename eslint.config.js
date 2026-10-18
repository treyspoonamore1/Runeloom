import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'shots', 'replays', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The sim must stay pure and deterministic (CLAUDE.md, architecture rule 1).
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'performance',
        'Date',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
        'localStorage',
        'navigator',
        'fetch',
        'console',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from src/sim/core/rng.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pixi.js', 'pixi-filters', 'preact', 'preact/*', '@preact/*', 'lil-gui', 'zzfx'],
              message: 'The sim cannot depend on rendering or UI.',
            },
            {
              group: ['**/render/**', '**/ui/**', '**/app/**', '**/audio/**'],
              message: 'The sim cannot import from render, ui, app or audio.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
