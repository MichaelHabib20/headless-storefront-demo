import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'src/sdk/generated/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Components import SDK types and functions from the barrel, never from internals.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/sdk/*', '**/sdk/generated/*'], message: "Import from '@/sdk' (the public SDK surface)." },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // The SDK itself and its tests may use internal paths.
    files: ['src/sdk/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }] },
  },
];

export default config;
