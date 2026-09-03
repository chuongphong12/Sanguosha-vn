export interface TextBounds {
  width: number;
  height: number;
}

export function fitScale(
  bounds: TextBounds,
  maxWidth: number,
  maxHeight: number,
): number {
  if (maxWidth <= 0 || maxHeight <= 0) return 0;
  return Math.min(
    1,
    maxWidth / Math.max(1, bounds.width),
    maxHeight / Math.max(1, bounds.height),
  );
}
