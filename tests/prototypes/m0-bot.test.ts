import { expect, it } from "vitest";
import {
  chooseBot,
  policyVersion,
  type Memory,
} from "../../server/prototypes/hegemony-m0/bot";
import {
  actorObservation,
  copy,
  initialEngine,
} from "../../server/prototypes/hegemony-m0/engine";
it("keeps the sole Peach when an offered Slash can satisfy discard", () => {
  const result = chooseBot(
    {
      actor: "0",
      kind: "discard",
      offers: [
        { id: "save", kind: "discard", card: "Peach" },
        { id: "spend", kind: "discard", card: "Slash" },
      ],
    },
    { version: policyVersion, actor: "0", seed: 17, decisions: 0 },
  );
  expect(result.choice).toBe("spend");
});
it("preserves observation/offers and policy output when only hidden order/opponent card IDs change", () => {
  const first = initialEngine();
  first.cardZones["1"].cards = [7];
  first.cardZones.draw.cards.pop();
  const second = copy(first);
  second.cardZones["1"].cards = [6];
  second.cardZones.draw.cards = [7, 5, 4, 3, 2, 1, 0];
  const a = actorObservation(first, "0"),
    b = actorObservation(second, "0");
  expect(a).toEqual(b);
  const memory: Memory = {
    version: policyVersion,
    actor: "0",
    seed: 17,
    decisions: 0,
  };
  expect(chooseBot(a.decision, memory)).toEqual(
    chooseBot(b.decision, copy(memory)),
  );
  expect(memory.decisions).toBe(0);
});
it("answers an offered Jink and preserves a legal decline for unnecessary Nullification", () => {
  const memory: Memory = {
    version: policyVersion,
    actor: "0",
    seed: 17,
    decisions: 0,
  };
  expect(
    chooseBot(
      {
        actor: "0",
        kind: "response",
        offers: [
          { id: "j", kind: "jink" },
          { id: "no", kind: "decline" },
        ],
      },
      memory,
    ).choice,
  ).toBe("j");
  expect(
    chooseBot(
      {
        actor: "0",
        kind: "nullification",
        protectsActor: false,
        offers: [
          { id: "n", kind: "nullification" },
          { id: "no", kind: "decline" },
        ],
      },
      memory,
    ).choice,
  ).toBe("no");
});
it("restores only its own versioned memory and refuses cross-seat memory", () => {
  const memory: Memory = {
    version: policyVersion,
    actor: "0",
    seed: 17,
    decisions: 0,
  };
  const view = actorObservation(initialEngine(), "0").decision;
  const next = chooseBot(view, memory).memory;
  expect(chooseBot(view, copy(next))).toEqual(chooseBot(view, next));
  expect(() => chooseBot(view, { ...next, actor: "1" })).toThrow(
    "Bot memory identity mismatch",
  );
});
