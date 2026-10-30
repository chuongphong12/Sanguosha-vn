import type { LuckTransferRules } from "../../src/game/hegemony/luck-transfer";
import { createLuckTransferOperation } from "../../src/game/hegemony/luck-transfer";
import { drawingSetup, type DrawingGame } from "./drawing-support";
import {
  createLuckCardOperation,
  type LuckCardRules,
} from "../../src/game/hegemony/luck-cards";
import type { TriggerData } from "../../src/game/hegemony/scheduler";

export function luckSetup() {
  const state = drawingSetup();
  state.game.cardZones.transit = { place: "table", owner: null, cards: [] };
  const transfer: LuckTransferRules<DrawingGame> = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    transitZone: "transit",
    wrapped: {
      originals: Object.fromEntries(
        Array.from({ length: 12 }, (_, id) => [
          id,
          {
            name: "jink",
            className: "Jink",
            suit: "heart",
            number: id + 1,
            skillName: "",
          },
        ]),
      ),
    },
    notify: (notice) => ({ name: "notice", data: { ...notice } }),
  };
  state.rules.operations!.push(createLuckTransferOperation(transfer));
  return { ...state, transfer };
}
export function fixtureHand(game: DrawingGame, player: string, ids: number[]) {
  game.cardZones.draw.cards = game.cardZones.draw.cards.filter(
    (id) => !ids.includes(id),
  );
  game.cardZones[player].cards = [...ids];
}
export function luckFlowSetup() {
  const state = luckSetup(),
    config = { limit: 1 },
    ai = new Set(["c"]);
  const rounds: TriggerData[] = [
    { a: { ready: true, payload: true }, b: { ready: true, payload: true } },
  ];
  const luck: LuckCardRules<DrawingGame> = {
    piles: state.transfer,
    limit: () => config.limit,
    usesAI: (_game, target) => ai.has(target),
    request: (players, round) => ({
      name: "luck-round",
      data: { players, round },
    }),
    notify: (notice) => ({ name: "notice", data: notice }),
  };
  state.rules.operations!.push(createLuckCardOperation(luck), {
    name: "luck-round",
    run: ({ game, operation }) => {
      const data = operation.data;
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        typeof data.round !== "number"
      )
        throw new Error("Bad request fixture");
      game.trace.push({ kind: "round", ...data });
      const response = rounds[data.round - 1];
      return { kind: "return", value: response === undefined ? {} : response };
    },
  });
  return { ...state, luck, config, ai, rounds };
}
