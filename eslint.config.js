// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'coverage/*']),
  expoConfig,
  prettierConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Bugs courants
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'error',
      // Sécurité
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Architecture : pas de dépendances circulaires entre fichiers
      'import/no-cycle': 'error',
      // Architecture : un module s'utilise seulement par son index.ts
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/*'],
              message: "Importe un module par son point d'entrée : '@/modules/<nom>'.",
            },
          ],
        },
      ],
      // Couleurs : uniquement dans src/shared/theme/colors.ts
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Pas de couleur en dur : utilise theme.colors (src/shared/theme/colors.ts).',
        },
        {
          selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]',
          message: 'Pas de couleur en dur : utilise theme.colors (src/shared/theme/colors.ts).',
        },
      ],
    },
  },
  {
    files: ['src/shared/theme/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/shared/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
