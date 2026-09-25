import { colorOf, type Subject } from '@/modules/academic';
import { SubjectDot, type SelectOption } from '@/shared/ui';

/** Matières sous forme de choix (avec leur pastille de couleur). */
export function subjectOptions(subjects: readonly Subject[]): SelectOption[] {
  return subjects.map((s) => ({
    value: s.id,
    label: s.name,
    leading: <SubjectDot color={colorOf(s)} />,
  }));
}
