export interface AgendaDropGeometry {
  clientX: number;
  clientY: number;
  gridLeft: number;
  gridTop: number;
  scrollLeft: number;
  scrollWidth: number;
  dayCount: number;
  rowCount: number;
  rowHeight: number;
}

export function resolveAgendaDropSlot(geometry: AgendaDropGeometry): {
  dayIndex: number;
  rowIndex: number;
} | null {
  const timeAxisWidth = 64;
  const headerHeight = 68;
  const { dayCount, rowCount, rowHeight } = geometry;
  if (dayCount < 1 || rowCount < 1 || rowHeight <= 0) return null;

  const dayWidth = (geometry.scrollWidth - timeAxisWidth) / dayCount;
  if (dayWidth <= 0) return null;

  const x = geometry.clientX - geometry.gridLeft + geometry.scrollLeft - timeAxisWidth;
  const y = geometry.clientY - geometry.gridTop - headerHeight;
  const dayIndex = Math.floor(x / dayWidth);
  const rowIndex = Math.floor(y / rowHeight);
  if (dayIndex < 0 || dayIndex >= dayCount || rowIndex < 0 || rowIndex >= rowCount) {
    return null;
  }
  return { dayIndex, rowIndex };
}
