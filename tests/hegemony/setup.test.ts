import { describe, expect, it } from "vitest";
import {
  createHegemonySetup,
  selectGeneralPair,
  projectHegemonyState,
  type HegemonySetupOptions,
} from "../../src/game/hegemony";

const generals = [
  {
    id: "caocao",
    kingdoms: ["wei"],
    headMaxHp: 4,
    deputyMaxHp: 4,
  },
  {
    id: "simayi",
    kingdoms: ["wei"],
    headMaxHp: 3,
    deputyMaxHp: 3,
  },
  {
    id: "liubei",
    kingdoms: ["shu"],
    headMaxHp: 4,
    deputyMaxHp: 4,
  },
  {
    id: "guanyu",
    kingdoms: ["shu"],
    headMaxHp: 4,
    deputyMaxHp: 4,
  },
];

describe("Hegemony paired setup", () => {
  it("selects an offered pair with combined HP and keeps both slots hidden", () => {
    const state = createHegemonySetup({
      generals,
      offers: { alice: ["caocao", "simayi"], bob: ["liubei", "guanyu"] },
    });

    expect(
      selectGeneralPair(state, "alice", { head: "caocao", deputy: "simayi" }),
    ).toBe(true);
    const owner = projectHegemonyState(state, "alice");
    const opponent = projectHegemonyState(state, "bob");
    expect(owner.players.alice).toMatchObject({
      head: { id: "caocao", shown: false },
      deputy: { id: "simayi", shown: false },
      hp: 3,
      maxHp: 3,
    });
    expect(opponent.players.alice).toMatchObject({
      head: { id: null, shown: false },
      deputy: { id: null, shown: false },
      selected: true,
      candidates: [],
      kingdom: null,
    });
    expect(state.status).toBe("selecting-generals");
    expect(
      selectGeneralPair(state, "bob", { head: "liubei", deputy: "guanyu" }),
    ).toBe(true);
    expect(state.status).toBe("ready");
  });

  it.each([
    { actor: "missing", head: "caocao", deputy: "simayi" },
    { actor: "toString", head: "caocao", deputy: "simayi" },
    { actor: "alice", head: "caocao", deputy: "caocao" },
    { actor: "alice", head: "caocao", deputy: "missing" },
    { actor: "alice", head: "liubei", deputy: "guanyu" },
    { actor: "alice", head: "caocao", deputy: "liubei" },
  ])("rejects invalid pairs atomically: $actor/$head/$deputy", (input) => {
    const state = createHegemonySetup({
      generals,
      offers: { alice: ["caocao", "simayi", "liubei"] },
    });
    const before = structuredClone(state);
    expect(selectGeneralPair(state, input.actor, input)).toBe(false);
    expect(state).toEqual(before);
  });

  it("rejects a banned pair in either head/deputy order", () => {
    const state = createHegemonySetup({
      generals,
      offers: { alice: ["caocao", "simayi"] },
      bannedPairs: [["caocao", "simayi"]],
    });
    expect(
      selectGeneralPair(state, "alice", { head: "caocao", deputy: "simayi" }),
    ).toBe(false);
    expect(
      selectGeneralPair(state, "alice", { head: "simayi", deputy: "caocao" }),
    ).toBe(false);
    expect(state.players.alice.head.id).toBeNull();
  });

  it("cannot select twice or reuse another player's physical general", () => {
    const state = createHegemonySetup({
      generals,
      offers: {
        alice: ["caocao", "simayi"],
        bob: ["caocao", "simayi", "liubei", "guanyu"],
      },
    });
    expect(
      selectGeneralPair(state, "alice", { head: "caocao", deputy: "simayi" }),
    ).toBe(true);
    const before = structuredClone(state);
    expect(
      selectGeneralPair(state, "alice", { head: "simayi", deputy: "caocao" }),
    ).toBe(false);
    expect(
      selectGeneralPair(state, "bob", { head: "caocao", deputy: "simayi" }),
    ).toBe(false);
    expect(state).toEqual(before);
  });

  it("allows a careerist head with a normal deputy, but never the reverse", () => {
    const state = createHegemonySetup({
      generals: [
        ...generals,
        {
          id: "careerist-head",
          kingdoms: ["careerist"],
          headMaxHp: 4,
          deputyMaxHp: 4,
        },
      ],
      offers: { alice: ["careerist-head", "caocao"] },
    });
    const before = structuredClone(state);
    expect(
      selectGeneralPair(state, "alice", {
        head: "caocao",
        deputy: "careerist-head",
      }),
    ).toBe(false);
    expect(state).toEqual(before);
    expect(
      selectGeneralPair(state, "alice", {
        head: "careerist-head",
        deputy: "caocao",
      }),
    ).toBe(true);
    expect(state.players.alice.initialKingdom).toBe("wei");
  });

  it("requires an explicit legal kingdom when a pair has two shared kingdoms", () => {
    const state = createHegemonySetup({
      generals: [
        {
          id: "dual-a",
          kingdoms: ["wei", "shu"],
          headMaxHp: 4,
          deputyMaxHp: 3,
        },
        {
          id: "dual-b",
          kingdoms: ["shu", "wei"],
          headMaxHp: 3,
          deputyMaxHp: 3,
        },
      ],
      offers: { alice: ["dual-a", "dual-b"] },
    });
    const before = structuredClone(state);
    for (const choice of [
      { head: "dual-a", deputy: "dual-b" },
      { head: "dual-a", deputy: "dual-b", kingdom: "wu" },
    ]) {
      expect(selectGeneralPair(state, "alice", choice)).toBe(false);
      expect(state).toEqual(before);
    }
    expect(
      selectGeneralPair(state, "alice", {
        head: "dual-a",
        deputy: "dual-b",
        kingdom: "shu",
      }),
    ).toBe(true);
    expect(state.players.alice.initialKingdom).toBe("shu");
    expect(projectHegemonyState(state, null).players.alice.kingdom).toBeNull();
  });

  it("uses slot-specific HP adjustments after a JSON round trip", () => {
    const state = createHegemonySetup({
      generals: [
        { id: "a", kingdoms: ["wei"], headMaxHp: 5, deputyMaxHp: 2 },
        { id: "b", kingdoms: ["wei"], headMaxHp: 3, deputyMaxHp: 3 },
      ],
      offers: { alice: ["a", "b"] },
    });
    const reloaded = JSON.parse(JSON.stringify(state));
    expect(
      selectGeneralPair(reloaded, "alice", { head: "a", deputy: "b" }),
    ).toBe(true);
    expect(projectHegemonyState(reloaded, "alice").players.alice.maxHp).toBe(4);
    const reversed = structuredClone(state);
    expect(
      selectGeneralPair(reversed, "alice", { head: "b", deputy: "a" }),
    ).toBe(true);
    expect(projectHegemonyState(reversed, "alice").players.alice.maxHp).toBe(2);
  });

  it("isolates state from setup inputs and returns independent private views", () => {
    const options: HegemonySetupOptions = {
      generals: structuredClone(generals),
      offers: { alice: ["caocao", "simayi"], bob: ["liubei", "guanyu"] },
      bannedPairs: [],
    };
    const state = createHegemonySetup(options);
    options.generals[0].kingdoms[0] = "wu";
    options.offers.alice.length = 0;
    options.bannedPairs!.push(["caocao", "simayi"]);
    expect(
      selectGeneralPair(state, "alice", { head: "caocao", deputy: "simayi" }),
    ).toBe(true);
    expect(state.players.alice.initialKingdom).toBe("wei");
    const before = structuredClone(state);
    const owner = projectHegemonyState(state, "bob");
    owner.players.bob.candidates.length = 0;
    owner.players.alice.head.shown = true;
    owner.seatOrder.reverse();
    expect(state).toEqual(before);
    for (const viewer of [null, "missing", "toString"]) {
      const view = projectHegemonyState(state, viewer);
      expect(JSON.stringify(view)).not.toMatch(
        /caocao|simayi|liubei|guanyu|initialKingdom/,
      );
      expect(view.players.bob.candidates).toEqual([]);
    }
  });

  it.each<HegemonySetupOptions>([
    { generals, offers: {} },
    { generals, offers: { alice: ["missing", "simayi"] } },
    { generals, offers: { alice: ["caocao", "caocao"] } },
    {
      generals: [generals[0], generals[0]],
      offers: { alice: ["caocao", "simayi"] },
    },
    {
      generals: [{ ...generals[0], headMaxHp: Number.NaN }, generals[1]],
      offers: { alice: ["caocao", "simayi"] },
    },
    {
      generals: [{ ...generals[0], kingdoms: [] }, generals[1]],
      offers: { alice: ["caocao", "simayi"] },
    },
  ])("rejects an inconsistent setup catalog or offer", (options) => {
    expect(() => createHegemonySetup(options)).toThrow();
  });

  it.each([
    null,
    undefined,
    {},
    { head: 1, deputy: "simayi" },
    { head: "caocao" },
  ])(
    "rejects malformed selection payloads without throwing or mutating",
    (choice) => {
      const state = createHegemonySetup({
        generals,
        offers: { alice: ["caocao", "simayi"] },
      });
      const before = structuredClone(state);
      expect(selectGeneralPair(state, "alice", choice)).toBe(false);
      expect(state).toEqual(before);
    },
  );
});
