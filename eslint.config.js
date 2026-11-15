import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'packages/*/dist/**', 'coverage/**', 'node_modules/**', '.husky/_/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __SWEETY_VERSION__: 'readonly',
        mockElementSize: 'readonly',
        ResizeObserverMock: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
