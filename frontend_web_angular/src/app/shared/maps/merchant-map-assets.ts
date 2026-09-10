/** Single visual definition for search, delivery previews and tracking. */
export const MERCHANT_MAP_STYLE = {
  PHARMACY: { image: '/pharmacy-map-marker.jpg', color: '#20a05a' },
  MATERIAL: { image: '/hardware-store-map-marker.svg', color: '#995d20' },
} as const;
export type MerchantMapKind = keyof typeof MERCHANT_MAP_STYLE;
export const MERCHANT_MAP_IMAGES = {
  PHARMACY: MERCHANT_MAP_STYLE.PHARMACY.image,
  MATERIAL: MERCHANT_MAP_STYLE.MATERIAL.image,
} as const;

export function applyMerchantAvatarStyle(element: HTMLElement, kind: MerchantMapKind): void {
  element.style.backgroundColor = '#ffffff';
  element.style.borderColor = MERCHANT_MAP_STYLE[kind].color;
  element.style.boxShadow = '0 2px 7px rgba(16,24,40,.24)';
}
