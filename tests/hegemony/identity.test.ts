import { describe, expect, it } from "vitest";
import {
  createHegemonySetup,
  selectGeneralPair,
  projectHegemonyState,
  revealHegemonyGeneral,
  concealHegemonyGeneral,
  areHegemonyFriends,
  willBeHegemonyFriend,
  type HegemonyGeneral,
} from "../../src/game/hegemony";

function readyRoom(
  kingdoms = ["wei", "wei", "shu", "wu"],
  lordSeat = -1,
  headKingdoms: Record<string, string[]> = {},
) {
  const generals: HegemonyGeneral[] = [];
  const offers: Record<string, string[]> = {};
  kingdoms.forEach((kingdom, seat) => {
    const head = `head-${seat}`;
    const deputy = `deputy-${seat}`;
    generals.push(
      {
        id: head,
        kingdoms: headKingdoms[String(seat)] ?? [kingdom],
        headMaxHp: 4,
        deputyMaxHp: 4,
        lord: seat === lordSeat,
      },
      {
        id: deputy,
        kingdoms: [kingdom === "careerist" ? "wei" : kingdom],
        headMaxHp: 4,
        deputyMaxHp: 4,
      },
    );
    offers[String(seat)] = [head, deputy];
  });
  const state = createHegemonySetup({ generals, offers });
  for (const id of state.seatOrder) {
    if (
      !selectGeneralPair(state, id, {
        head: `head-${id}`,
        deputy: `deputy-${id}`,
      })
    )
      throw new Error("Invalid identity test fixture");
  }
  return state;
}

describe("Hegemony identity domain transitions", () => {
  it("reveals only the requested slot and allies only after both players show", () => {
    const state = readyRoom();
    expect(areHegemonyFriends(state, "0", "0")).toBe(true);
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    expect(revealHegemonyGeneral(state, "0", "head")).toBe(true);
    const view = projectHegemonyState(state, "1");
    expect(view.players["0"]).toMatchObject({
      head: { id: "head-0", shown: true },
      deputy: { id: null, shown: false },
      kingdom: "wei",
      alliance: { kind: "faction", kingdom: "wei" },
    });
    expect(view.players["1"].initialKingdom).toBe("wei");
    expect(view.players["0"].initialKingdom).toBeUndefined();
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    expect(revealHegemonyGeneral(state, "1", "deputy")).toBe(true);
    expect(areHegemonyFriends(state, "0", "1")).toBe(true);
    expect(areHegemonyFriends(state, "1", "0")).toBe(true);
    expect(concealHegemonyGeneral(state, "0", "head")).toBe(true);
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    const hidden = projectHegemonyState(state, "1").players["0"];
    expect(hidden.head.id).toBeNull();
    expect(hidden.kingdom).toBeNull();
    expect(hidden.alliance).toBeNull();
  });

  it("makes the fifth revealed member a careerist at eight original seats", () => {
    const state = readyRoom([
      "wei",
      "wei",
      "wei",
      "wei",
      "wei",
      "wei",
      "shu",
      "wu",
    ]);
    for (const id of ["0", "1", "2", "3"])
      revealHegemonyGeneral(state, id, "head");
    state.players["1"].alive = false;
    revealHegemonyGeneral(state, "4", "head");
    revealHegemonyGeneral(state, "5", "deputy");
    const view = projectHegemonyState(state, null);
    expect(view.players["4"].alliance).toEqual({
      kind: "careerist",
      group: null,
    });
    expect(view.players["5"].alliance).toEqual({
      kind: "careerist",
      group: null,
    });
    expect(areHegemonyFriends(state, "4", "5")).toBe(false);
    expect(areHegemonyFriends(state, "0", "1")).toBe(true);
  });

  it("revealing a living lord restores careerists and permits a larger faction", () => {
    const state = readyRoom(
      ["wei", "wei", "wei", "wei", "wei", "wei", "wei", "wu"],
      5,
    );
    for (const id of ["0", "1", "2", "3", "4"])
      revealHegemonyGeneral(state, id, "head");
    expect(areHegemonyFriends(state, "0", "4")).toBe(false);
    revealHegemonyGeneral(state, "5", "head");
    revealHegemonyGeneral(state, "6", "deputy");
    expect(areHegemonyFriends(state, "0", "4")).toBe(true);
    expect(areHegemonyFriends(state, "0", "6")).toBe(true);
    state.players["5"].alive = false;
    // A dead exposed lord changes later reveal classification, even below majority.
    const later = readyRoom(["wei", "wei", "shu", "wu"], 0);
    revealHegemonyGeneral(later, "0", "head");
    later.players["0"].alive = false;
    revealHegemonyGeneral(later, "1", "head");
    expect(projectHegemonyState(later, null).players["1"].alliance).toEqual({
      kind: "careerist",
      group: null,
    });
  });

  it("revealing a careerist head overrides a faction assigned by its deputy", () => {
    const state = readyRoom(["careerist", "careerist", "shu", "wu"]);
    revealHegemonyGeneral(state, "0", "deputy");
    expect(projectHegemonyState(state, null).players["0"].kingdom).toBe("wei");
    revealHegemonyGeneral(state, "0", "head");
    revealHegemonyGeneral(state, "1", "head");
    const view = projectHegemonyState(state, null);
    expect(view.players["0"].kingdom).toBe("careerist");
    expect(view.players["0"].alliance).toEqual({
      kind: "careerist",
      group: null,
    });
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    expect(areHegemonyFriends(state, "0", "0")).toBe(true);
  });

  it("recognizes persisted recruitment groups regardless of original kingdoms", () => {
    const state = readyRoom(["wei", "shu", "wu", "qun"]);
    for (const id of state.seatOrder) revealHegemonyGeneral(state, id, "head");
    // A resumed state produced by the later recruitment pipeline.
    state.players["0"].alliance = {
      kind: "careerist",
      group: "careerist_head-0",
    };
    state.players["1"].alliance = {
      kind: "careerist",
      group: "careerist_head-0",
    };
    state.players["2"].alliance = {
      kind: "careerist",
      group: "careerist_head-2",
    };
    const reloaded = JSON.parse(JSON.stringify(state));
    expect(areHegemonyFriends(reloaded, "0", "1")).toBe(true);
    expect(areHegemonyFriends(reloaded, "1", "0")).toBe(true);
    expect(areHegemonyFriends(reloaded, "0", "2")).toBe(false);
    expect(areHegemonyFriends(reloaded, "0", "3")).toBe(false);
  });

  it("predicts a hidden actor's relation asymmetrically without revealing it", () => {
    const state = readyRoom();
    revealHegemonyGeneral(state, "1", "head");
    const before = structuredClone(state);
    expect(willBeHegemonyFriend(state, "0", "1")).toBe(true);
    expect(willBeHegemonyFriend(state, "1", "0")).toBe(false);
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    expect(state).toEqual(before);
    expect(projectHegemonyState(state, "1").players["0"].head.id).toBeNull();
  });

  it("predicts majority careerists with original seat count and hidden own lord", () => {
    const factions = ["wei", "wei", "wei", "wei", "wei", "shu", "wu", "qun"];
    const normal = readyRoom(factions);
    const ownLord = readyRoom(factions, 4);
    for (const state of [normal, ownLord]) {
      for (const id of ["0", "1", "2", "3"])
        revealHegemonyGeneral(state, id, "head");
      state.players["2"].alive = false;
    }
    expect(willBeHegemonyFriend(normal, "4", "0")).toBe(false);
    expect(willBeHegemonyFriend(ownLord, "4", "0")).toBe(true);
  });

  it("preserves native hide-last-slot then re-reveal kingdom semantics", () => {
    const state = readyRoom();
    revealHegemonyGeneral(state, "0", "head");
    revealHegemonyGeneral(state, "0", "deputy");
    concealHegemonyGeneral(state, "0", "head");
    expect(projectHegemonyState(state, null).players["0"].kingdom).toBe("wei");
    concealHegemonyGeneral(state, "0", "deputy");
    expect(projectHegemonyState(state, "0").players["0"].initialKingdom).toBe(
      "wei",
    );
    expect(projectHegemonyState(state, null).players["0"].kingdom).toBeNull();
    const reloaded = JSON.parse(JSON.stringify(state));
    revealHegemonyGeneral(reloaded, "0", "head");
    // Pinned hideGeneral stores god; showGeneral keeps a nonempty kingdom.
    expect(projectHegemonyState(reloaded, null).players["0"].kingdom).toBe(
      "god",
    );
    expect(projectHegemonyState(reloaded, "0").players["0"].deputy.id).toBe(
      "deputy-0",
    );
    expect(
      projectHegemonyState(reloaded, null).players["0"].deputy.id,
    ).toBeNull();
  });

  it("rejects repeated and invalid identity transitions atomically", () => {
    const state = readyRoom();
    const before = structuredClone(state);
    for (const slot of [null, "invalid", {}, 1]) {
      expect(revealHegemonyGeneral(state, "0", slot)).toBe(false);
      expect(concealHegemonyGeneral(state, "0", slot)).toBe(false);
    }
    expect(revealHegemonyGeneral(state, "toString", "head")).toBe(false);
    expect(concealHegemonyGeneral(state, "missing", "head")).toBe(false);
    expect(concealHegemonyGeneral(state, "0", "head")).toBe(false);
    expect(state).toEqual(before);
    revealHegemonyGeneral(state, "0", "head");
    const shown = structuredClone(state);
    expect(revealHegemonyGeneral(state, "0", "head")).toBe(false);
    expect(state).toEqual(shown);
    expect(areHegemonyFriends(state, "missing", "missing")).toBe(false);
    expect(willBeHegemonyFriend(state, "missing", "0")).toBe(false);
  });

  it("uses primary head kingdom in native prediction even for a chosen secondary kingdom", () => {
    const state = readyRoom(["shu", "wei", "shu", "wu"], -1, {
      "0": ["wei", "shu"],
    });
    revealHegemonyGeneral(state, "1", "head");
    revealHegemonyGeneral(state, "2", "head");
    expect(projectHegemonyState(state, "0").players["0"].initialKingdom).toBe(
      "shu",
    );
    expect(willBeHegemonyFriend(state, "0", "1")).toBe(true);
    expect(willBeHegemonyFriend(state, "0", "2")).toBe(false);
    revealHegemonyGeneral(state, "0", "deputy");
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
    expect(areHegemonyFriends(state, "0", "2")).toBe(true);
  });

  it("preserves the source distinction between careerist prediction and actual friendship", () => {
    const state = readyRoom(["careerist", "careerist", "shu", "wu"]);
    revealHegemonyGeneral(state, "1", "head");
    expect(willBeHegemonyFriend(state, "0", "1")).toBe(true);
    revealHegemonyGeneral(state, "0", "head");
    expect(areHegemonyFriends(state, "0", "1")).toBe(false);
  });

  it("does not turn a deputy reveal of a hidden lord into the exposed-lord exception", () => {
    const state = readyRoom(
      ["wei", "wei", "wei", "wei", "wei", "shu", "wu", "qun"],
      3,
    );
    for (const id of ["0", "1", "2"]) revealHegemonyGeneral(state, id, "head");
    revealHegemonyGeneral(state, "3", "deputy");
    expect(willBeHegemonyFriend(state, "4", "0")).toBe(true);
    revealHegemonyGeneral(state, "4", "head");
    expect(areHegemonyFriends(state, "4", "0")).toBe(false);
    revealHegemonyGeneral(state, "3", "head");
    expect(areHegemonyFriends(state, "4", "0")).toBe(true);
    const before = structuredClone(state);
    const view = projectHegemonyState(state, null);
    if (view.players["4"].alliance?.kind === "faction")
      view.players["4"].alliance.kingdom = "wu";
    expect(state).toEqual(before);
  });
});
