import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(globalIgnores(['dist', 'node_modules']), tseslint.configs.recommended, {
  rules: {
    'no-console': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
