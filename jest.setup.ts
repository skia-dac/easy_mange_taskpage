// En test, les identifiants viennent du module crypto de Node (sur le téléphone : expo-crypto).
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
