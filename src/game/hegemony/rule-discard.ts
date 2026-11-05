import { shufflePileCards, type DrawPileGame } from "./draw-pile";
import { readSlashAlive, type SlashGame } from "./slash";
import {
  resumeTriggerPrompt,
  type OperationHandler,
  type OperationStep,
  type TriggerData,
  type TriggerRegistry,
  type TriggerScheduler,
  type TriggerOperation,
} from "./scheduler";

export type RuleDiscardGame = DrawPileGame & SlashGame;
export interface RuleDiscardRules<G extends RuleDiscardGame> {
  discardZone: string;
  isJilei: (game: Readonly<G>, target: string, id: number) => boolean;
  focus: (target: string) => TriggerOperation | null;
}
type Choice = { id: string } & (
  | { action: "card"; cardId: number }
  | { action: "confirm" | "reset" | "timeout" }
);
type Cursor = {
  target: string;
  count: number;
  stage: "focused" | "choosing" | "moved" | "choice";
  ids: number[];
  required: number;
  generation: number;
  choices: Choice[];
};
export function createRuleDiscardAdmission<G extends RuleDiscardGame, Auth>(
  rules: RuleDiscardRules<G>,
  authenticate: (context: Auth) => string | null,
) {
  function input(game: G, data: TriggerData) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.target !== "string" ||
      !game.seatOrder.includes(data.target) ||
      typeof data.count !== "number" ||
      !Number.isSafeInteger(data.count) ||
      data.count <= 0
    )
      throw Error("Invalid rule discard request");
    const zone = game.cardZones[rules.discardZone];
    if (!zone || zone.place !== "discard" || zone.owner !== null)
      throw Error("Invalid discard zone");
    return { target: data.target, count: data.count };
  }
  function hand(game: G, target: string): number[] {
    const zones = Object.values(game.cardZones).filter(
      (z) => z.owner === target && z.place === "hand",
    );
    if (zones.some((z) => !Array.isArray(z.cards)))
      throw Error("Invalid discard hand");
    const ids = zones.flatMap((z) => z.cards);
    if (
      ids.some((id) => !Number.isSafeInteger(id) || id < 0) ||
      new Set(ids).size !== ids.length
    )
      throw Error("Invalid discard hand");
    return ids;
  }
  function eligible(game: G, target: string): number[] {
    return hand(game, target).filter((id) => {
      const blocked = rules.isJilei(structuredClone(game), target, id);
      if (typeof blocked !== "boolean")
        throw Error("Invalid discard limitation");
      return !blocked;
    });
  }
  function move(game: G, c: Cursor): OperationStep {
    if (!c.ids.length) return { kind: "return", value: true };
    const from = c.ids.map((id) => {
      const sources = Object.entries(game.cardZones).filter(([, zone]) =>
        zone.cards.includes(id),
      );
      if (
        sources.length !== 1 ||
        sources[0][1].owner !== c.target ||
        sources[0][1].place !== "hand"
      )
        throw Error("Invalid rule discard source");
      return sources[0][0];
    });
    c.stage = "moved";
    return {
      kind: "operation",
      operation: {
        name: "move-cards",
        data: {
          moves: [
            {
              ids: [...c.ids],
              from,
              to: rules.discardZone,
              open: true,
              reason: { kind: "rule-discard", actor: c.target },
            },
          ],
        },
      },
      continuation: c,
    };
  }
  function prompt(game: G, c: Cursor): OperationStep {
    const available = eligible(game, c.target);
    c.required = Math.min(c.count, available.length);
    c.generation++;
    c.choices = [];
    if (c.ids.length < c.required)
      for (const cardId of available.filter((id) => !c.ids.includes(id)))
        c.choices.push({
          id: `discard:${c.generation}:${c.choices.length}`,
          action: "card",
          cardId,
        });
    if (c.ids.length === c.required)
      c.choices.push({
        id: `discard:${c.generation}:${c.choices.length}`,
        action: "confirm",
      });
    if (c.ids.length)
      c.choices.push({
        id: `discard:${c.generation}:${c.choices.length}`,
        action: "reset",
      });
    c.choices.push({
      id: `discard:${c.generation}:${c.choices.length}`,
      action: "timeout",
    });
    return {
      kind: "prompt",
      actor: c.target,
      choices: c.choices.map((choice) => choice.id),
      canCancel: false,
      continuation: c,
    };
  }
  function privatePrompt(scheduler: TriggerScheduler) {
    const p = scheduler.prompt,
      frame = scheduler.frames.at(-1);
    if (
      scheduler.interruption ||
      !p ||
      p.kind !== "step" ||
      !frame ||
      frame.id !== p.frameId ||
      frame.kind !== "operation" ||
      frame.operation.name !== "rule-discard" ||
      !frame.continuation
    )
      return null;
    return { prompt: p, cursor: frame.continuation as Cursor };
  }
  const operation: OperationHandler<G> = {
    name: "rule-discard",
    validate: (game, operation) => {
      input(game, operation.data);
    },
    run: ({ game, operation, continuation, answer }) => {
      let c: Cursor;
      if (continuation === null) {
        const { target, count } = input(game, operation.data);
        if (!readSlashAlive(game, target))
          return { kind: "return", value: false };
        c = {
          target,
          count,
          stage: "focused",
          ids: [],
          required: count,
          generation: 0,
          choices: [],
        };
        const focus = rules.focus(target);
        if (focus)
          return { kind: "operation", operation: focus, continuation: c };
      } else c = structuredClone(continuation) as Cursor;
      if (c.stage === "focused") {
        const ids = eligible(game, c.target);
        c.stage = "choosing";
        if (ids.length <= c.count) {
          c.ids = ids;
          return move(game, c);
        }
        return prompt(game, c);
      }
      if (c.stage === "moved") {
        c.stage = "choice";
        return {
          kind: "event",
          event: {
            name: "ChoiceMade",
            target: c.target,
            data: `cardDiscard:gamerule:$${c.ids.join("+")}`,
          },
          continuation: c,
        };
      }
      if (c.stage === "choice") return { kind: "return", value: true };
      const selected = c.choices.find((choice) => choice.id === answer?.choice);
      if (!selected) throw Error("Invalid rule discard choice");
      if (!readSlashAlive(game, c.target))
        return { kind: "return", value: false };
      if (selected.action === "card" || selected.action === "confirm") {
        const allowed = eligible(game, c.target);
        if (
          !c.ids.every((id) => allowed.includes(id)) ||
          (selected.action === "card" && !allowed.includes(selected.cardId)) ||
          (selected.action === "confirm" &&
            c.ids.length !== Math.min(c.count, allowed.length))
        ) {
          c.ids = [];
          return prompt(game, c);
        }
      }
      if (selected.action === "timeout") {
        const ids = hand(game, c.target);
        shufflePileCards(game, ids);
        const allowed = new Set(eligible(game, c.target));
        c.ids = ids.filter((id) => allowed.has(id)).slice(0, c.count);
        return move(game, c);
      }
      if (selected.action === "card") c.ids.push(selected.cardId);
      if (selected.action === "reset") {
        c.ids = [];
      }
      if (selected.action === "confirm") return move(game, c);
      return prompt(game, c);
    },
  };
  return {
    operation,
    view: (scheduler: TriggerScheduler, auth: Auth) => {
      const state = privatePrompt(scheduler);
      if (!state || authenticate(auth) !== state.prompt.actor) return null;
      return {
        id: state.prompt.id,
        choices: structuredClone(
          state.cursor.choices.filter((choice) => choice.action !== "timeout"),
        ),
        selectedIds: [...state.cursor.ids],
        requiredCount: state.cursor.required,
        canCancel: false,
      };
    },
    submit: (
      scheduler: TriggerScheduler,
      game: G,
      registry: TriggerRegistry<G>,
      auth: Auth,
      reply: unknown,
    ): boolean => {
      const state = privatePrompt(scheduler),
        actor = authenticate(auth);
      if (
        !state ||
        !actor ||
        actor !== state.prompt.actor ||
        !reply ||
        typeof reply !== "object" ||
        Array.isArray(reply) ||
        Object.keys(reply).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(reply, "id") ||
        !Object.prototype.hasOwnProperty.call(reply, "choice")
      )
        return false;
      const selected = state.cursor.choices.find(
        (choice) => choice.id === (reply as { choice: unknown }).choice,
      );
      if (!selected || selected.action === "timeout") return false;
      if (!readSlashAlive(game, actor)) return false;
      if (selected.action !== "reset") {
        const allowed = eligible(game, actor);
        if (!state.cursor.ids.every((id) => allowed.includes(id))) return false;
        if (selected.action === "card" && !allowed.includes(selected.cardId))
          return false;
        if (
          selected.action === "confirm" &&
          state.cursor.ids.length !==
            Math.min(state.cursor.count, allowed.length)
        )
          return false;
      }
      return resumeTriggerPrompt(scheduler, game, registry, actor, reply);
    },
    /** Trusted service clock only; the expected prompt fences stale timeouts. */
    timeout: (
      scheduler: TriggerScheduler,
      game: G,
      registry: TriggerRegistry<G>,
      expectedId: string,
    ): boolean => {
      const state = privatePrompt(scheduler);
      if (
        !state ||
        state.prompt.id !== expectedId ||
        !readSlashAlive(game, state.prompt.actor)
      )
        return false;
      const choice = state.cursor.choices.find(
        (entry) => entry.action === "timeout",
      );
      if (!choice) return false;
      return resumeTriggerPrompt(
        scheduler,
        game,
        registry,
        state.prompt.actor,
        { id: expectedId, choice: choice.id },
      );
    },
  };
}
