/** Pure geometry for the general picker, shared with the e2e click helper. */

export const MIN_LAYOUT_HEIGHT = 860;
const CARD_BASE_WIDTH = 280;
const CARD_BASE_HEIGHT = 560;
const CARD_GAP = 24;
const SIDE_MARGIN = 30;
const CONFIRM_CENTER_Y = 504 + 20; // btnY + half the 40px button, at base size

export interface PickerCard {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Centre of the "CHỌN TƯỚNG NÀY" button, in logical coordinates. */
  confirm: { x: number; y: number };
}

export interface GeneralPickerLayout {
  cards: PickerCard[];
}

export function generalPickerLayout(
  viewportWidth: number,
  viewportHeight: number,
  count: number,
): GeneralPickerLayout {
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  let width = CARD_BASE_WIDTH;
  let height = CARD_BASE_HEIGHT;
  let total = count * width + (count - 1) * CARD_GAP;
  if (total > viewportWidth - SIDE_MARGIN * 2) {
    width = (viewportWidth - SIDE_MARGIN * 2 - (count - 1) * CARD_GAP) / count;
    height = (width / CARD_BASE_WIDTH) * CARD_BASE_HEIGHT;
    total = count * width + (count - 1) * CARD_GAP;
  }
  const scale = width / CARD_BASE_WIDTH;
  const startLeft = centerX - total / 2;
  const top = centerY + 10 - height / 2;
  return {
    cards: Array.from({ length: count }, (_, index) => {
      const left = startLeft + index * (width + CARD_GAP);
      return {
        left,
        top,
        width,
        height,
        confirm: { x: left + width / 2, y: top + CONFIRM_CENTER_Y * scale },
      };
    }),
  };
}

/** MainScreen scales its logical space down on short viewports. */
export function screenScale(viewportHeight: number): number {
  return Math.min(1, Math.max(0.01, viewportHeight / MIN_LAYOUT_HEIGHT));
}
