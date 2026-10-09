/** Accent-insensitive matching shared by catalogue search inputs. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}
