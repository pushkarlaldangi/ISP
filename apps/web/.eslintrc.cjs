/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: ['.next', 'node_modules', 'public', 'playwright-report', 'test-results'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
  },
};
