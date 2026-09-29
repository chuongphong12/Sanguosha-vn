import { Bot } from "boardgame.io/ai";
import type { State } from "boardgame.io";

import type { PlayerID, TqsGameState } from "../model";

type BotPlayResult = Awaited<ReturnType<Bot["play"]>>;

// boardgame.io's local master only ever asks the first bot seat listed in
// ctx.activePlayers to move, and every seat is always active in this game
// (turns are tracked in G.turn instead). So each bot scans all bot seats and
// plays for whichever one the game is waiting on.
export const createHeuristicBot = (botIDs: PlayerID[]) =>
  class HeuristicBot extends Bot {
    // The seat boardgame.io asks about is ignored: see the note above.
    play(state: State<TqsGameState>): Promise<BotPlayResult> {
      for (const botID of botIDs) {
        const [action] = this.enumerate(state.G, state.ctx, botID);
        if (action) return Promise.resolve({ action });
      }
      // Nobody at a bot seat has anything to do: the table is waiting on the
      // human. Leave the promise pending, because the local master
      // dereferences the returned action and has no "no move" result; the
      // next state update asks again.
      return new Promise<BotPlayResult>(() => undefined);
    }
  };
