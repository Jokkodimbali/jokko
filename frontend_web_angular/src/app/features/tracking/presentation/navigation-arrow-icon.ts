/** The same navigation glyph is used by both map renderers. */
export function createNavigationArrowIcon(size: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText =
    'display:block;filter:drop-shadow(0 2px 2px rgba(15,23,42,.24));transform:translateY(-1px);transform-origin:50% 50%;';
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', 'M32 4 51 56 33.5 45.5 16 56 32 4Z');
  arrow.setAttribute('fill', '#1a73e8');
  arrow.setAttribute('stroke', '#ffffff');
  arrow.setAttribute('stroke-width', '2.2');
  arrow.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(arrow);
  return svg;
}
