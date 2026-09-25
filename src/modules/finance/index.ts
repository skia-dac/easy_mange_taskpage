// Module finance : argent de l'étudiant (dépenses, entrées, charges fixes, tontines, épargne, prêts).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export * from './domain/money';
export * from './domain/category';
export * from './domain/transaction';
export * from './domain/period';
export * from './domain/recurring';
export * from './domain/goal';
export * from './domain/loan';
export * from './data/commands';
export * from './data/queries';
export * from './data/prefs';
