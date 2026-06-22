export const COLLAPSED_KEY = 'floatingTODO:collapsed';

export function getLocalCollapsed(): boolean {
  return localStorage.getItem(COLLAPSED_KEY) === 'true';
}

export function setLocalCollapsed(value: boolean): void {
  localStorage.setItem(COLLAPSED_KEY, String(value));
}

export function clampYForExpand(
  currentY: number,
  devicePixelRatio: number,
  screenHeightPx: number,
): number {
  const expandedPhysicalH = 400 * devicePixelRatio;
  if (currentY + expandedPhysicalH > screenHeightPx) {
    return Math.max(0, screenHeightPx - expandedPhysicalH);
  }
  return currentY;
}
