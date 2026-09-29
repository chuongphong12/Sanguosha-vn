import { beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "boardgame.io";

import { declareCardUse } from "../../src/game/cardEngine";
import {
  chooseHeuristicMove,
  getHeuristicMoves,
} from "../../src/game/ai/ai-heuristics";
import { createHeuristicBot } from "../../src/game/ai/HeuristicBot";
import { registerAllSkills } from "../../src/game/engine/skills";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import { createInitialState } from "../../src/game/setup";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

const NO_CTX = {} as Ctx;

const revealAs = (
  G: TqsGameState,
  playerID: PlayerID,
  role: TqsGameState["players"][PlayerID]["role"],
): void => {
  G.players[playerID].role = role;
  G.players[playerID].roleRevealed = true;
};

// Lord to act in the play step, empty hands, and the seat to the lord's left
// revealed as a rebel (in Slash range); nobody else's role is known.
const createLordTurn = () => {
  const G = createStartedGame();
  resetHands(G);
  const lordID = G.lordID;
  const [, rebelID, ...unknownIDs] = G.seatOrder;
  revealAs(G, rebelID, "rebel");
  return { G, lordID, rebelID, unknownIDs };
};

beforeAll(() => {
  registerAllSkills();
});

describe("heuristic bot choices", () => {
  it("slashes the revealed enemy and never an unknown player", () => {
    const { G, lordID, rebelID } = createLordTurn();
    expect(G.turn).toMatchObject({ activePlayerID: lordID, step: "play" });
    const slashID = giveCard(G, lordID, "slash");

    expect(chooseHeuristicMove(G, lordID)).toEqual({
      move: "playCard",
      args: [{ cardID: slashID, targetIDs: [rebelID] }],
    });

    G.players[rebelID].roleRevealed = false;
    expect(chooseHeuristicMove(G, lordID)).toEqual({
      move: "endPlayPhase",
      args: [],
    });
  });

  it("heals with Peach before attacking when injured", () => {
    const { G, lordID } = createLordTurn();
    giveCard(G, lordID, "slash");
    const peachID = giveCard(G, lordID, "peach");
    G.players[lordID].hp -= 1;

    expect(chooseHeuristicMove(G, lordID)).toEqual({
      move: "playCard",
      args: [{ cardID: peachID, targetIDs: [] }],
    });
  });

  it("equips gear into an empty slot", () => {
    const { G, lordID } = createLordTurn();
    const armorID = giveCard(G, lordID, "renwang-shield");

    expect(chooseHeuristicMove(G, lordID)).toEqual({
      move: "playCard",
      args: [{ cardID: armorID, targetIDs: [] }],
    });
  });

  it("answers a Slash with Dodge", () => {
    const { G, lordID, rebelID } = createLordTurn();
    const slashID = giveCard(G, lordID, "slash");
    const dodgeID = giveCard(G, rebelID, "dodge");
    declareCardUse(
      G,
      lordID,
      { cardID: slashID, targetIDs: [rebelID] },
      identityShuffle,
    );

    expect(chooseHeuristicMove(G, rebelID)).toEqual({
      move: "answerPrompt",
      args: [G.prompt!.id, { kind: "card", cardID: dodgeID }],
    });
  });

  it("discards the least valuable cards and keeps Peach", () => {
    const { G, lordID } = createLordTurn();
    const peachID = giveCard(G, lordID, "peach");
    const dodgeID = giveCard(G, lordID, "dodge");
    const duelID = giveCard(G, lordID, "duel");
    G.players[lordID].hp = 1;
    G.turn.step = "discard";

    const move = chooseHeuristicMove(G, lordID);
    expect(move?.move).toBe("discardCards");
    const [discarded] = move!.args as [string[]];
    expect(discarded).toHaveLength(2);
    expect(discarded).toEqual(expect.arrayContaining([duelID, dodgeID]));
    expect(discarded).not.toContain(peachID);
  });

  it("returns only the lord's pick during lord selection", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const otherID = G.seatOrder.find((id) => id !== G.lordID)!;

    expect(getHeuristicMoves(G, NO_CTX, G.lordID)).toEqual([
      {
        move: "selectGeneral",
        args: [G.players[G.lordID].generalCandidates[0]],
      },
    ]);
    expect(getHeuristicMoves(G, NO_CTX, otherID)).toEqual([]);
  });

  it("stays idle while the table waits on someone else", () => {
    const { G, rebelID } = createLordTurn();
    expect(getHeuristicMoves(G, NO_CTX, rebelID)).toEqual([]);
  });
});

describe("HeuristicBot", () => {
  it("moves for whichever bot seat the game is waiting on", async () => {
    const { G, lordID, rebelID } = createLordTurn();
    const slashID = giveCard(G, lordID, "slash");
    const dodgeID = giveCard(G, rebelID, "dodge");
    declareCardUse(
      G,
      lordID,
      { cardID: slashID, targetIDs: [rebelID] },
      identityShuffle,
    );
    const botIDs = [
      ...G.seatOrder.filter((id) => id !== lordID && id !== rebelID),
      rebelID,
    ];
    const HeuristicBot = createHeuristicBot(botIDs);
    const bot = new HeuristicBot({ enumerate: getHeuristicMoves });

    // boardgame.io always asks the first bot seat; the rebel is not first.
    expect(botIDs[0]).not.toBe(rebelID);
    const { action } = await bot.play({ G, ctx: NO_CTX } as never);

    expect(action.payload).toMatchObject({
      type: "answerPrompt",
      playerID: rebelID,
      args: [G.prompt!.id, { kind: "card", cardID: dodgeID }],
    });
  });
});
