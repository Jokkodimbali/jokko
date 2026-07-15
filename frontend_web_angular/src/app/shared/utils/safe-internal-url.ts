export function safeInternalUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
}
