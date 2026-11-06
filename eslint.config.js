import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import ts from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['node_modules/**', 'node_modules.nosync/**', 'dist/**', '.omc/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: { parser, parserOptions: { sourceType: 'module', ecmaVersion: 'latest' } },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off', // TypeScript checks names, including type-only declarations.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
