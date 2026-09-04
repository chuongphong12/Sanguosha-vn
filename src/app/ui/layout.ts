export interface ActionRowLayout {
  centers: number[];
  widths: number[];
  centerY: number;
}

export function layoutActionRow(
  viewportWidth: number,
  viewportHeight: number,
  buttonWidths: number[],
  options: {
    rightInset?: number;
    bottomInset?: number;
    gap?: number;
    buttonHeight?: number;
  } = {},
): ActionRowLayout {
  const rightInset = options.rightInset ?? 34;
  const bottomInset = options.bottomInset ?? 280;
  const gap = options.gap ?? 8;
  const buttonHeight = options.buttonHeight ?? 48;
  const gapWidth = Math.max(0, buttonWidths.length - 1) * gap;
  const requestedWidth = buttonWidths.reduce((sum, width) => sum + width, 0);
  const availableWidth = Math.max(1, viewportWidth - rightInset * 2);
  const widthScale =
    requestedWidth > 0
      ? Math.min(1, Math.max(1, availableWidth - gapWidth) / requestedWidth)
      : 1;
  const widths = buttonWidths.map((width) =>
    Math.max(1, Math.floor(width * widthScale)),
  );
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gapWidth;
  let cursor = viewportWidth - rightInset - totalWidth;

  return {
    centers: widths.map((width) => {
      const center = cursor + width / 2;
      cursor += width + gap;
      return center;
    }),
    widths,
    centerY: viewportHeight - bottomInset - buttonHeight / 2,
  };
}
