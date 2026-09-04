import type { Game, Move } from "boardgame.io";
import { INVALID_MOVE, Stage } from "boardgame.io/core";

import {
  answerCardPrompt,
  declareCardUse,
  discardCardHand,
  endCardPlayPhase,
  resumeCardPlayPhase,
  useSkill,
} from "./cardEngine";
import type {
  PlayCardInput,
  PromptAnswer,
  Shuffle,
  TqsGameState,
} from "./model";
import { createPlayerView } from "./player-view";
import { createInitialState, selectGeneral } from "./setup";

type GameMove = Move<TqsGameState>;

function authoritative(move: GameMove, redact = false): GameMove {
  return { move: move as never, client: false, redact, undoable: false };
}

function shuffleFrom(random: { Shuffle: <T>(items: T[]) => T[] }): Shuffle {
  return <T>(items: T[]) => random.Shuffle([...items]);
}

export const TqsGame: Game<TqsGameState> = {
  name: "tam-quoc-sat-standard-2013",
  minPlayers: 4,
  maxPlayers: 10,
  disableUndo: true,
  deltaState: false,

  setup: ({ ctx, random }) =>
    createInitialState(
      { numPlayers: ctx.numPlayers, roleVariant: "standard" },
      shuffleFrom(random),
    ),

  playerView: ({ G, playerID }) => createPlayerView(G, playerID),

  turn: {
    activePlayers: { all: Stage.NULL },
  },

  moves: {
    selectGeneral: authoritative(
      ({ G, playerID, random }, generalID: string) => {
        if (!selectGeneral(G, playerID, generalID, shuffleFrom(random)))
          return INVALID_MOVE;
      },
      true,
    ),

    endPlayPhase: authoritative(({ G, playerID, random }) => {
      if (!endCardPlayPhase(G, playerID, shuffleFrom(random)))
        return INVALID_MOVE;
    }),

    resumePlayPhase: authoritative(({ G, playerID }) => {
      if (!resumeCardPlayPhase(G, playerID)) return INVALID_MOVE;
    }),

    playCard: authoritative(({ G, playerID, random }, input: PlayCardInput) => {
      if (!declareCardUse(G, playerID, input, shuffleFrom(random)))
        return INVALID_MOVE;
    }, true),

    useSkill: authoritative(
      ({ G, playerID, random }, skillID: string, payload?: unknown) => {
        if (!useSkill(G, playerID, skillID, payload, shuffleFrom(random)))
          return INVALID_MOVE;
      },
      true,
    ),

    answerPrompt: authoritative(
      ({ G, playerID, random }, promptID: number, answer: PromptAnswer) => {
        if (
          !answerCardPrompt(G, playerID, promptID, answer, shuffleFrom(random))
        )
          return INVALID_MOVE;
      },
      true,
    ),

    timeoutPrompt: authoritative(({ G, random }, promptID: number) => {
      const prompt = G.prompt;
      if (
        prompt &&
        prompt.id === promptID &&
        prompt.kind === "card-response" &&
        prompt.reason === "nullification"
      ) {
        answerCardPrompt(
          G,
          prompt.responderID,
          promptID,
          { kind: "pass" },
          shuffleFrom(random),
        );
      } else {
        return INVALID_MOVE;
      }
    }, true),

    discardCards: authoritative(
      ({ G, playerID, random }, cardIDs: string[]) => {
        if (!discardCardHand(G, playerID, cardIDs, shuffleFrom(random)))
          return INVALID_MOVE;
      },
      true,
    ),
  },

  endIf: ({ G }) => G.winner ?? undefined,
};
