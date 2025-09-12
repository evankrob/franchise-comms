import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    rules: {
      // TypeScript specific rules for franchise platform
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React specific rules
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js
      'react/no-unescaped-entities': 'error',

      // Security rules for multi-tenant platform
      'no-console': 'warn', // Use proper logging instead
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
    rules: {
      // Relax rules in test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['*.config.js', '*.config.mjs', 'jest.setup.js'],
    rules: {
      // Allow require in config files
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
