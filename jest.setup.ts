// En test, les identifiants viennent du module crypto de Node (sur le téléphone : expo-crypto).
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));

// Gestes (glisser une tâche, déplacer dans la vue heures) : versions de test fournies par les bibliothèques.
require('react-native-gesture-handler/jestSetup');
// Reanimated reconnaît Jest par `globalThis.jest` (ou NODE_ENV=test, pas toujours défini).
(globalThis as { jest?: unknown }).jest = jest;
require('react-native-reanimated').setUpTests();
