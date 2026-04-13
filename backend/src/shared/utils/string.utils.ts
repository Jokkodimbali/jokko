export function normalizeEmail(
  email?: string | null,
): string | null | undefined {
  if (email === undefined || email === null) return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized.length === 0 ? null : normalized;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.trim();
}

export function normalizeAddress(
  value?: string | null,
): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function trimString(value?: string | null): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
