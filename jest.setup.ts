// En test, les identifiants viennent du module crypto de Node (sur le téléphone : expo-crypto).
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));

// Gestes (glisser une tâche, déplacer dans la vue heures) : versions de test fournies par les bibliothèques.
require('react-native-gesture-handler/jestSetup');
// Reanimated reconnaît Jest par `globalThis.jest` (ou NODE_ENV=test, pas toujours défini).
(globalThis as { jest?: unknown }).jest = jest;
require('react-native-reanimated').setUpTests();

// Formulaires : la garde « Abandonner les modifications ? » a besoin d'un navigateur. Les écrans
// testés seuls n'en ont pas : `usePreventRemove` est observé (voir useUnsavedGuard.test.tsx).
jest.mock('expo-router/react-navigation', () => {
  const actual = jest.requireActual('expo-router/react-navigation');
  const navigation = { dispatch: jest.fn() };
  return { ...actual, usePreventRemove: jest.fn(), useNavigation: () => navigation };
});
