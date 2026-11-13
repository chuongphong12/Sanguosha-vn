import { readCardEffect } from "./card-effect";
import { readDeathIdentity } from "./death";
import type { GeneralGame } from "./general-identity";
import { shufflePileCards, type DrawPileGame } from "./draw-pile";
import { readResponse } from "./ask-card-use";
import type { OperationHandler, OperationStep } from "./scheduler";
export type ImperialOrderGame = GeneralGame & DrawPileGame;
export interface ImperialOrderRules<G extends ImperialOrderGame> {
  discardZone: string;
  canShow: (game: Readonly<G>, target: string, head: boolean) => boolean;
  /** Native matching he/empty expansion-pile order before shuffle; metadata/pattern adapter. */
  candidates: (game: Readonly<G>, target: string) => number[];
  limited: (game: Readonly<G>, target: string, id: number) => boolean;
}
export function createImperialOrderEffectOperation<G extends ImperialOrderGame>(
  rules: ImperialOrderRules<G>,
): OperationHandler<G> {
  type Cursor = {
    effect: ReturnType<typeof readCardEffect>;
    fallback: number | null;
    choice: string;
    stage: number;
  };
  function boolean(value: unknown) {
    if (typeof value !== "boolean")
      throw Error("Invalid ImperialOrder predicate");
    return value;
  }
  return {
    name: "imperial-order-effect",
    validate: (game, op) => {
      readCardEffect(game, op.data);
      if (game.cardZones[rules.discardZone]?.place !== "discard")
        throw Error("Invalid ImperialOrder discard zone");
    },
    run: ({
      game,
      operation,
      continuation,
      answer,
      operationChild,
    }): OperationStep => {
      let c: Cursor;
      if (continuation === null) {
        const effect = readCardEffect(game, operation.data),
          identity = readDeathIdentity(game, effect.to),
          choices: string[] = [];
        if (
          !identity.headShown &&
          boolean(rules.canShow(structuredClone(game), effect.to, true))
        )
          choices.push("show_head");
        if (
          game.displayedGenerals[effect.to].deputy &&
          !identity.deputyShown &&
          boolean(rules.canShow(structuredClone(game), effect.to, false))
        )
          choices.push("show_deputy");
        const ids = rules.candidates(structuredClone(game), effect.to);
        if (
          !Array.isArray(ids) ||
          new Set(ids).size !== ids.length ||
          ids.some(
            (id) =>
              !Number.isSafeInteger(id) ||
              id < 0 ||
              (() => {
                const zones = Object.values(game.cardZones).filter((z) =>
                  z.cards.includes(id),
                );
                return (
                  zones.length !== 1 ||
                  zones[0].cards.filter((card) => card === id).length !== 1 ||
                  zones[0].owner !== effect.to ||
                  !(
                    zones[0].place === "hand" ||
                    zones[0].place === "equip" ||
                    (zones[0].place === "special" && zones[0].pileName === "")
                  )
                );
              })(),
          )
        )
          throw Error("Invalid ImperialOrder candidates");
        const pool = [...ids];
        shufflePileCards(game, pool);
        const fallback =
          pool.find(
            (id) =>
              !boolean(rules.limited(structuredClone(game), effect.to, id)),
          ) ?? null;
        if (fallback !== null) choices.push("dis_equip");
        choices.push("cancel");
        c = { effect, fallback, choice: "", stage: 1 };
        return {
          kind: "prompt",
          actor: effect.to,
          choices,
          canCancel: false,
          continuation: c,
        };
      } else c = structuredClone(continuation) as Cursor;
      const op = (
        name: string,
        data: Parameters<typeof readCardEffect>[1],
      ): OperationStep => ({
        kind: "operation",
        operation: { name, data },
        continuation: c,
      });
      while (true)
        switch (c.stage++) {
          case 1:
            c.choice = answer!.choice!;
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: c.effect.to,
                data: "skillChoice:imperial_order:" + c.choice,
              },
              continuation: c,
            };
          case 2:
            if (c.choice === "show_head" || c.choice === "show_deputy")
              return op("show-general", {
                target: c.effect.to,
                head: c.choice === "show_head",
              });
            if (c.choice === "dis_equip") {
              c.stage = 5;
              return op("ask-card-discard", {
                actor: c.effect.to,
                pattern: "EquipCard!",
                prompt: "@imperial_order-equip",
                data: null,
                to: null,
                skillName: "",
                isProvision: false,
              });
            }
            c.stage = 6;
            return op("lose-hp", { target: c.effect.to, amount: 1 });
          case 3:
            return op("draw-cards", {
              players: [c.effect.to],
              counts: [1],
              reason: "imperial_order",
            });
          case 4:
          case 6:
            return { kind: "return", value: null };
          case 5:
            if (operationChild?.value !== null) {
              readResponse(game, operationChild!.value, c.effect.to);
              return { kind: "return", value: null };
            }
            if (c.fallback === null)
              throw Error("Missing ImperialOrder fallback");
            return op("move-cards", {
              moves: [
                {
                  ids: [c.fallback],
                  to: rules.discardZone,
                  open: true,
                  reason: { kind: "throw", actor: c.effect.to },
                },
              ],
              forceVisible: true,
            });
          default:
            throw Error("Invalid ImperialOrder continuation");
        }
    },
  };
}
