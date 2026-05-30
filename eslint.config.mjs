// Config ESLint v9 (flat) — monorepo MarchéLink.
// Un seul fichier racine : ESLint remonte l'arborescence depuis le cwd, donc
// `eslint src` lancé dans apps/api, apps/web ou packages/shared le résout.
// Baseline pragmatique : les règles potentiellement bruyantes sur le code
// existant sont en `warn` (n'échouent pas la CI) plutôt qu'en `error`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Réglages communs à tout le TypeScript du monorepo.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Front React : globals navigateur.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Fichiers de tests : globals des runners (jest/vitest) + node.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, ...globals.vitest },
    },
  },
);
