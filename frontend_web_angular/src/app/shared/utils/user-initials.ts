export function userInitials(name: string | null | undefined, fallback = 'JK'): string {
  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (initials || fallback).slice(0, 2).toUpperCase();
}
