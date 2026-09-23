// Module academic : matières, emplois du temps, séries de cours, examens (vacances et exceptions : phase 4).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export * from './data/commands';
export * from './data/queries';
export * from './domain/course';
export * from './domain/exam';
export * from './domain/occurrences';
export * from './domain/subject';
export * from './domain/timetable';
