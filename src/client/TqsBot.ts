import { Bot } from "boardgame.io/ai";
import type { Ctx } from "boardgame.io";

import type { PlayerID } from "../game/model";

type BotAction = ReturnType<Bot["enumerate"]>[number];

/**
 * One bot that plays for every AI seat.
 *
 * boardgame.io asks a bot to act as the first bot id found in
 * `ctx.activePlayers`. This game keeps all players active, so that is always
 * the same seat, and per-seat bots would leave every other AI frozen. Instead
 * this bot looks at all AI seats and moves for whichever one has a legal move.
 */
export function createTqsBot(botIDs: readonly PlayerID[]) {
  return class TqsBot extends Bot {
    async play(state: { G: unknown; ctx: Ctx }, _playerID: PlayerID) {
      const { G, ctx } = state;
      const seats = [...botIDs].sort(() => Math.random() - 0.5);
      for (const seat of seats) {
        const actions: BotAction[] = this.enumerate(G, ctx, seat);
        if (actions.length > 0) {
          return {
            action: actions[Math.floor(Math.random() * actions.length)],
            metadata: {},
          };
        }
      }
      // Nothing for any AI to do (waiting on a human). boardgame.io requires an
      // action, so wait here instead of returning one; the next state change
      // asks again.
      return new Promise<never>(() => undefined);
    }
  };
}
