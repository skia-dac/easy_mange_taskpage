/**
 * Résultat d'un « Créer une matière » lancé depuis un sélecteur (cours, examen…) : le
 * formulaire d'origine le reprend à son retour et sélectionne la matière créée.
 */
let pickedSubjectId: string | null = null;

export function setPickedSubject(id: string): void {
  pickedSubjectId = id;
}

/** Rend l'id une seule fois (puis vide). */
export function takePickedSubject(): string | null {
  const id = pickedSubjectId;
  pickedSubjectId = null;
  return id;
}
