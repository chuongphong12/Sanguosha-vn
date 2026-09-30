import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROOM_SETTINGS,
  MIN_PLAYERS_TO_START,
  buildStartGamePayload,
  canStartGame,
  cycleOption,
  getRoomMembers,
  isRoomHost,
  shouldAutoStart,
  waitingRoomLayout,
} from "../../src/app/screens/main/waitingRoomModel";

const seat = (id: number, name?: string) => ({ id, name });

describe("getRoomMembers", () => {
  it("keeps only seats that have a joined player name, ordered by seat id", () => {
    const members = getRoomMembers([
      seat(2, "C"),
      seat(0, "A"),
      seat(1),
      seat(3, ""),
      seat(4, "E"),
    ]);
    expect(members).toEqual([
      { id: "0", name: "A" },
      { id: "2", name: "C" },
      { id: "4", name: "E" },
    ]);
  });

  it("returns an empty list while match data has not arrived", () => {
    expect(getRoomMembers(undefined)).toEqual([]);
  });
});

describe("isRoomHost", () => {
  it("only seat 0 may send startGame (server rejects anyone else)", () => {
    expect(isRoomHost("0")).toBe(true);
    expect(isRoomHost("1")).toBe(false);
  });
});

describe("canStartGame", () => {
  const members = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), name: `P${i}` }));

  it(`requires the host and at least ${MIN_PLAYERS_TO_START} joined players`, () => {
    expect(canStartGame(members(3), "0")).toBe(false);
    expect(canStartGame(members(4), "0")).toBe(true);
    expect(canStartGame(members(4), "1")).toBe(false);
  });
});

describe("buildStartGamePayload", () => {
  const members = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    name: `P${i}`,
  }));

  it("starts with the players who actually joined, not the 10 preallocated seats", () => {
    const payload = buildStartGamePayload(members, {
      ...DEFAULT_ROOM_SETTINGS,
      targetNumPlayers: 10,
    });
    expect(payload.actualNumPlayers).toBe(6);
    expect(payload.joinedPlayerIDs).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("never seats more players than the host's target", () => {
    const payload = buildStartGamePayload(members, {
      ...DEFAULT_ROOM_SETTINGS,
      targetNumPlayers: 4,
    });
    expect(payload.actualNumPlayers).toBe(4);
    expect(payload.joinedPlayerIDs).toEqual(["0", "1", "2", "3"]);
  });

  it("forwards the room rules", () => {
    const payload = buildStartGamePayload(members, {
      targetNumPlayers: 5,
      autoStartWhenFull: false,
      autoSkipWuxie: false,
      lordExtraHp: 0,
      turnTimeLimit: 30,
    });
    expect(payload).toMatchObject({
      autoSkipWuxie: false,
      lordExtraHp: 0,
      turnTimeLimit: 30,
    });
  });
});

describe("shouldAutoStart", () => {
  const members = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), name: `P${i}` }));
  const settings = {
    ...DEFAULT_ROOM_SETTINGS,
    targetNumPlayers: 4,
    autoStartWhenFull: true,
  };

  it("fires once the room is full and the viewer is host", () => {
    expect(shouldAutoStart(members(4), "0", settings, false)).toBe(true);
  });

  it("does not fire when disabled, not full, not host or already started", () => {
    expect(
      shouldAutoStart(
        members(4),
        "0",
        { ...settings, autoStartWhenFull: false },
        false,
      ),
    ).toBe(false);
    expect(shouldAutoStart(members(3), "0", settings, false)).toBe(false);
    expect(shouldAutoStart(members(4), "1", settings, false)).toBe(false);
    expect(shouldAutoStart(members(4), "0", settings, true)).toBe(false);
  });
});

describe("cycleOption", () => {
  it("wraps around", () => {
    expect(cycleOption([4, 5, 6, 8, 10], 10)).toBe(4);
    expect(cycleOption([4, 5, 6, 8, 10], 5)).toBe(6);
  });

  it("falls back to the first option for an unknown value", () => {
    expect(cycleOption([15, 30, null], 99 as never)).toBe(15);
  });
});

describe("waitingRoomLayout", () => {
  it("centres the two panels on the viewport and keeps the start button inside the settings panel", () => {
    const layout = waitingRoomLayout(1200);
    expect(layout.listCenterX).toBe(350);
    expect(layout.settingsCenterX).toBe(850);
    expect(layout.startButton.centerX).toBe(layout.settingsCenterX);
    expect(layout.startButton.centerY).toBeGreaterThan(layout.panelTop);
    expect(layout.startButton.centerY).toBeLessThan(
      layout.panelTop + layout.panelHeight,
    );
  });

  it("gives every settings row its own y, top to bottom", () => {
    const layout = waitingRoomLayout(1200);
    expect(layout.settingRowsY).toHaveLength(5);
    expect([...layout.settingRowsY].sort((a, b) => a - b)).toEqual(
      layout.settingRowsY,
    );
  });
});
