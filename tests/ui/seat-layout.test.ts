import { describe, expect, it } from "vitest";

import {
  opponentArcPosition,
  opponentsInOrder,
} from "../../src/app/ui/seatLayout";

describe("opponentsInOrder", () => {
  const seats = ["0", "1", "2", "3", "4"];

  it("starts at the seat after the viewer and wraps around", () => {
    expect(opponentsInOrder(seats, "0")).toEqual(["1", "2", "3", "4"]);
    expect(opponentsInOrder(seats, "3")).toEqual(["4", "0", "1", "2"]);
  });

  it("never includes the viewer", () => {
    for (const viewer of seats) {
      expect(opponentsInOrder(seats, viewer)).not.toContain(viewer);
      expect(opponentsInOrder(seats, viewer)).toHaveLength(seats.length - 1);
    }
  });

  it("returns every seat for a viewer who is not seated (spectator)", () => {
    expect(opponentsInOrder(seats, "9")).toEqual(seats);
  });
});

describe("opponentArcPosition", () => {
  const board = { width: 1000, height: 860 };

  it("places a lone opponent at the top centre", () => {
    const only = opponentArcPosition(0, 1, board.width, board.height);
    expect(only.x).toBeCloseTo(board.width / 2 - 70);
  });

  it("spreads opponents left to right along an arc, top seats higher than side seats", () => {
    const count = 5;
    const positions = Array.from({ length: count }, (_, i) =>
      opponentArcPosition(i, count, board.width, board.height),
    );
    const xs = positions.map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const middle = positions[2];
    expect(middle.y).toBeLessThan(positions[0].y);
    expect(middle.y).toBeLessThan(positions[4].y);
  });

  it("keeps every opponent inside the board for 3 to 9 opponents", () => {
    for (let count = 3; count <= 9; count += 1) {
      for (let i = 0; i < count; i += 1) {
        const p = opponentArcPosition(i, count, board.width, board.height);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + 140).toBeLessThanOrEqual(board.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
