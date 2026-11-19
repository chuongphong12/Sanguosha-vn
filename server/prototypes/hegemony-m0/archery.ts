/** Bounded ce4e62b AOE/ArcheryAttack caller: two plain fixture seats, no packages. */
import { readExecutionCardUse } from "../../../src/game/hegemony/card-on-use";
import {
  readCardEffect,
  type CardEffect,
} from "../../../src/game/hegemony/card-effect";
import { readResponse } from "../../../src/game/hegemony/ask-card-use";
import type {
  OperationHandler,
  OperationStep,
} from "../../../src/game/hegemony/scheduler";
import type { Engine } from "./engine";

export const archeryOperations: OperationHandler<Engine>[] = [
  {
    name: "fixture-archery-on-use",
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const use = readExecutionCardUse(game, operation.data);
      if (!use.to.length)
        use.to = game.seatOrder.filter(
          (actor) => actor !== use.from && game.alive[actor],
        );
      return {
        kind: "operation",
        operation: { name: "card-on-use", data: use },
        continuation: true,
      };
    },
  },
  {
    name: "fixture-archery-on-effect",
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      const cursor =
        continuation === null
          ? { stage: 0, effect: readCardEffect(game, operation.data) }
          : (continuation as { stage: number; effect: CardEffect });
      const effect = cursor.effect;
      const source =
        effect.from !== null && game.alive[effect.from] ? effect.from : null;
      if (cursor.stage === 0) {
        cursor.stage++;
        const noResponse =
          game.wrappedCards?.[effect.card.materialIDs[0]].tags.EffectNoResponse;
        if (
          !effect.disresponsive &&
          !(
            Array.isArray(noResponse) &&
            (noResponse.includes(effect.to) ||
              noResponse.includes("_ALL_PLAYERS"))
          )
        )
          return {
            kind: "operation",
            operation: {
              name: "ask-card-response",
              data: {
                actor: effect.to,
                pattern: "jink",
                prompt: `archery-attack-jink:${effect.from}`,
                data: effect,
                to: source,
                skillName: "",
                isProvision: false,
              },
            },
            continuation: cursor,
          };
      }
      if (cursor.stage === 1) {
        cursor.stage++;
        if (operationChild && operationChild.value !== null) {
          readResponse(game, operationChild.value, effect.to);
          return { kind: "return", value: null };
        }
        return {
          kind: "operation",
          operation: {
            name: "damage",
            data: {
              from: source,
              to: effect.to,
              card: {
                reference: `fixture:${effect.card.materialIDs[0]}`,
                card: effect.card,
              },
              damage: 1,
              nature: "normal",
              chain: false,
              transfer: false,
              by_user: true,
              reason: "",
              flags: [],
              transfer_reason: "",
              prevented: false,
            },
          },
          continuation: cursor,
        };
      }
      return { kind: "return", value: null };
    },
  },
];
