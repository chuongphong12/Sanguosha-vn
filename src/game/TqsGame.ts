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
  TqsSetupOptions,
} from "./model";
import { createPlayerView } from "./player-view";
import {
  createInitialState,
  createWaitingRoomState,
  selectGeneral,
} from "./setup";
import { drawCards, writeLog } from "./rules";
import { registerAllSkills } from "./engine/skills";

registerAllSkills();

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

  setup: ({ ctx, random }, setupData) => {
    const data = setupData as { isOnline?: boolean };
    if (data?.isOnline) {
      return createWaitingRoomState({ numPlayers: ctx.numPlayers });
    }
    return createInitialState(
      { numPlayers: ctx.numPlayers, roleVariant: "standard" },
      shuffleFrom(random),
    );
  },

  playerView: ({ G, playerID }) => createPlayerView(G, playerID),

  turn: {
    activePlayers: { all: Stage.NULL },
  },

  moves: {
    startGame: authoritative(
      (
        { G, random },
        joinedPlayerIDs: string[],
        autoSkipWuxie: boolean = true,
      ) => {
        if (G.status !== "waiting-room") return INVALID_MOVE;
        if (joinedPlayerIDs.length < 4 || joinedPlayerIDs.length > 10)
          return INVALID_MOVE;
        const options: TqsSetupOptions = {
          numPlayers: joinedPlayerIDs.length,
          joinedPlayerIDs,
          roleVariant: "standard",
          autoSkipWuxie,
        };
        const newState = createInitialState(options, shuffleFrom(random));
        Object.assign(G, newState);
      },
    ),
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

    // Sandbox Manual Overrides (For host / edge cases)
    adminDrawCard: authoritative(
      ({ G, random }, targetID: string, amount: number) => {
        drawCards(G, targetID, amount, shuffleFrom(random));
        writeLog(G, `[Sandbox] Ép bốc ${amount} lá cho người chơi ${targetID}.`);
      },
      true,
    ),
    adminSetHp: authoritative(
      ({ G }, targetID: string, hp: number) => {
        const player = G.players[targetID];
        if (player) {
          player.hp = Math.max(0, Math.min(hp, player.maxHP));
          writeLog(G, `[Sandbox] Đặt máu của ${targetID} thành ${player.hp}.`);
        }
      },
      true,
    ),
    adminDiscard: authoritative(
      ({ G }, targetID: string, cardID: string) => {
        const player = G.players[targetID];
        if (!player) return;
        const handIndex = player.hand.indexOf(cardID);
        if (handIndex !== -1) {
          player.hand.splice(handIndex, 1);
          G.discard.push(cardID);
          writeLog(G, `[Sandbox] Vứt 1 lá bài trên tay của ${targetID}.`);
        } else {
          // Check equipment
          for (const slot of Object.keys(player.equipment) as Array<keyof typeof player.equipment>) {
            if (player.equipment[slot] === cardID) {
              player.equipment[slot] = null as any;
              G.discard.push(cardID);
              writeLog(G, `[Sandbox] Vứt trang bị của ${targetID}.`);
              break;
            }
          }
        }
      },
      true,
    ),
  },

  endIf: ({ G }) => G.winner ?? undefined,
};
