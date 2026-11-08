// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/** Interdits valables partout dans src/. */
const BASE_PATTERNS = [
  {
    group: ['@/modules/*/*'],
    message: "Importe un module par son point d'entrée : '@/modules/<nom>'.",
  },
  {
    group: ['@react-navigation/*'],
    message:
      "Depuis le SDK 56, expo-router refuse react-navigation : importe depuis 'expo-router/react-navigation' (ou 'expo-router/js-tabs').",
  },
  {
    group: ['expo-router/build/*'],
    message:
      "Chemin interne d'expo-router, qui change sans prévenir : importe depuis 'expo-router', 'expo-router/js-tabs' ou 'expo-router/react-navigation'.",
  },
];

/**
 * Couches (docs/PLANNING.md §4.1), du haut vers le bas :
 * app → components / hooks → workflows → projections → modules → shared.
 * Une couche n'importe jamais une couche au-dessus d'elle.
 */
const ABOVE = {
  shared: ['@/modules', '@/projections', '@/workflows', '@/components', '@/hooks', '@/app'],
  modules: ['@/projections', '@/workflows', '@/components', '@/hooks', '@/app'],
  projections: ['@/workflows', '@/components', '@/hooks', '@/app'],
  workflows: ['@/components', '@/hooks', '@/app'],
  ui: ['@/app'],
};

const layer = (files, forbidden, ignores = []) => ({
  files,
  ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**', ...ignores],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...BASE_PATTERNS,
          {
            group: forbidden.flatMap((p) => [p, `${p}/*`]),
            message:
              'Couche au-dessus : app → components/hooks → workflows → projections → modules → shared (docs/PLANNING.md §4.1).',
          },
        ],
      },
    ],
  },
});

// Exception documentée : rappels, widgets et export .ics sont des sorties de l'app qui lisent les
// projections (Aujourd'hui, agenda, widgets). Ils restent dans platform mais ne doivent rien
// importer d'autre au-dessus.
const PLATFORM_OUTPUTS = [
  'src/modules/platform/notifications/**',
  'src/modules/platform/widgets/**',
  'src/modules/platform/export/**',
];

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'coverage/*', 'supabase/functions/*', 'ios/*', 'android/*']),
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
      'no-restricted-imports': ['error', { patterns: BASE_PATTERNS }],
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
  layer(['src/shared/**'], ABOVE.shared),
  layer(['src/modules/**'], ABOVE.modules, PLATFORM_OUTPUTS),
  layer(PLATFORM_OUTPUTS, ABOVE.projections),
  layer(['src/projections/**'], ABOVE.projections),
  layer(['src/workflows/**'], ABOVE.workflows),
  layer(['src/components/**', 'src/hooks/**'], ABOVE.ui),
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
    // Les tests chargent les écrans avec require() (jest ne gère pas import() dynamique).
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
]);
