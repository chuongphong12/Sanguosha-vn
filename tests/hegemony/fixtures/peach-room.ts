import {
  createRoomUseCardOperation,
  type RoomCardUse,
  type RoomUseGame,
  type RoomUseRules,
} from "../../../src/game/hegemony/room-use-card";
import { readCardReference } from "../../../src/game/hegemony/card-resources";
import type {
  OperationHandler,
  TriggerOperation,
} from "../../../src/game/hegemony/scheduler";

/** Fixture package metadata/conversion/hooks; the Room wrapper itself is real. */
export function peachRoomOperations<G extends RoomUseGame>(
  onUse: (entry: RoomCardUse) => TriggerOperation,
  overrides: Partial<RoomUseRules<G>> = {},
): OperationHandler<G>[] {
  return [
    createRoomUseCardOperation({
      parse: (_, entry) => entry,
      inPlay: () => true,
      limited: () => false,
      metadata: (game, entry) => ({
        identity: entry.reference,
        realIdentity: entry.reference,
        virtual:
          readCardReference(game, entry.reference).card.kind !== "wrapped",
        lua: false,
        delayed: false,
        handlingMethod: "use",
        canRecast: false,
        face: {
          name: entry.use.card.name,
          className: entry.use.card.className,
          skillName: entry.use.card.skillName,
          suit: "no-suit",
          number: 0,
        },
        showSkill: "",
      }),
      notify: () => null,
      validate: (data) => ({ name: "room-validate-fixture", data }),
      onUse,
      after: (data) => ({ name: "room-after-fixture", data }),
      ...overrides,
    }),
    {
      name: "room-validate-fixture",
      run: ({ operation }) => ({
        kind: "return",
        value: { entry: operation.data, validated: operation.data },
      }),
    },
    {
      name: "room-after-fixture",
      run: () => ({ kind: "return", value: null }),
    },
  ];
}
