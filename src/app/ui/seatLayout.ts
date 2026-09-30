import type { PlayerID } from "../../game/model";

/** Width of a SeatView; the arc is anchored on its top-left corner. */
export const SEAT_WIDTH = 140;

/** Opponents in turn order starting after the viewer. */
export function opponentsInOrder(
  seatOrder: readonly PlayerID[],
  viewerID: PlayerID,
): PlayerID[] {
  const viewerIndex = seatOrder.indexOf(viewerID);
  if (viewerIndex < 0) return [...seatOrder];
  return Array.from(
    { length: seatOrder.length - 1 },
    (_, offset) => seatOrder[(viewerIndex + 1 + offset) % seatOrder.length],
  );
}

/**
 * Arc through the top, left and right of the board. `index` runs from the
 * left-most opponent (0) to the right-most (count - 1).
 */
export function opponentArcPosition(
  index: number,
  count: number,
  layoutWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const half = SEAT_WIDTH / 2;
  const centerX = layoutWidth / 2;
  const centerY = viewportHeight / 2 - 40;
  const radiusX = Math.max(1, layoutWidth / 2 - 140);
  const radiusY = Math.max(1, viewportHeight / 2 - 280);
  const topY = centerY - radiusY - 60;
  if (count <= 1) return { x: centerX - half, y: topY };

  // Circle through (top centre), (left side) and (right side).
  const radius = (radiusX * radiusX + radiusY * radiusY) / (2 * radiusY);
  const circleY = topY + radius;
  const sideY = centerY - 60;
  const angleLeft = Math.atan2(sideY - circleY, -radiusX);
  const angleRight = Math.atan2(sideY - circleY, radiusX);
  const angle = angleLeft + (index / (count - 1)) * (angleRight - angleLeft);
  return {
    x: centerX + radius * Math.cos(angle) - half,
    y: circleY + radius * Math.sin(angle),
  };
}
