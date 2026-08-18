/**
 * Current public lineage/search/family surfaces hide daughters.
 * Gender is an input to this experience — not a Visibility Engine
 * (`gender = male → discoverable` is forbidden).
 * Rows stay in the graph for engine / self_access.
 */
export function isPublicLineageHiddenPerson(
  person: { gender?: string | null } | null | undefined,
): boolean {
  const gender = String(person?.gender || '')
    .trim()
    .toLowerCase();
  return (
    gender === 'daughter' ||
    gender === 'female' ||
    gender === 'f' ||
    gender === 'أنثى' ||
    gender === 'انثى' ||
    gender === 'ابنة' ||
    gender === 'بنت'
  );
}
