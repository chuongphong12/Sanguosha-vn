import type { DrawPileGame } from "./draw-pile";
import { readSlashInteger } from "./slash";
import type { OperationHandler, OperationStep, TriggerData } from "./scheduler";

function drawInput(game: DrawPileGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.players) ||
    !Array.isArray(data.counts) ||
    !data.counts.length ||
    (data.fromUps !== undefined && !Array.isArray(data.fromUps)) ||
    (data.reason !== undefined && typeof data.reason !== "string")
  )
    throw new Error("Invalid draw-cards request");
  const players = data.players.map((player) => {
    if (typeof player !== "string" || !game.seatOrder.includes(player))
      throw new Error("Invalid draw recipient");
    return player;
  });
  const counts = data.counts.map((count) => readSlashInteger(count));
  const fromUps = (data.fromUps ?? []).map((value) => {
    if (typeof value !== "boolean") throw new Error("Invalid draw direction");
    return value;
  });
  return { players, counts, fromUps, reason: data.reason ?? "" };
}
function handZone(game: DrawPileGame, target: string) {
  const zones = Object.entries(game.cardZones).filter(
    ([, zone]) => zone.owner === target && zone.place === "hand",
  );
  if (zones.length !== 1) throw new Error("Invalid draw hand destination");
  return zones[0][0];
}

function savedTransfers(value: TriggerData, reason: string) {
  if (!Array.isArray(value)) throw new Error("Invalid saved draw transfers");
  return value.map((move) => {
    if (
      !move ||
      typeof move !== "object" ||
      Array.isArray(move) ||
      Object.keys(move).length !== 4 ||
      !Array.isArray(move.ids) ||
      move.ids.length === 0 ||
      new Set(move.ids).size !== move.ids.length ||
      typeof move.to !== "string" ||
      move.open !== false ||
      !move.reason ||
      typeof move.reason !== "object" ||
      Array.isArray(move.reason) ||
      Object.keys(move.reason).length !== 4 ||
      move.reason.kind !== "draw" ||
      typeof move.reason.actor !== "string" ||
      move.reason.skill !== reason ||
      move.reason.eventName !== ""
    )
      throw new Error("Invalid saved draw transfer");
    const ids = move.ids.map((id) => {
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0)
        throw new Error("Invalid saved draw ID");
      return id;
    });
    return { ids, to: move.to, actor: move.reason.actor };
  });
}

export function createDrawCardsOperation<
  G extends DrawPileGame,
>(): OperationHandler<G> {
  type Cursor = ReturnType<typeof drawInput> & {
    stage: "next" | "acquired" | "moved";
    index: number;
    target: string;
    count: number;
    moves: TriggerData[];
  };
  return {
    name: "draw-cards",
    validateSave: (game, frame, _interruption, prompt, state) => {
      const input = drawInput(game, frame.operation.data),
        c = frame.continuation,
        child = state?.child;
      if (prompt || frame.cleanup || frame.answer !== null || frame.child)
        throw new Error("Invalid player draw boundary");
      if (c === null) {
        if (child || frame.operationChild)
          throw new Error("Invalid initial player draw child");
        return;
      }
      if (
        typeof c !== "object" ||
        Array.isArray(c) ||
        (c.stage !== "acquired" && c.stage !== "moved") ||
        JSON.stringify(c.players) !== JSON.stringify(input.players) ||
        JSON.stringify(c.counts) !== JSON.stringify(input.counts) ||
        JSON.stringify(c.fromUps) !== JSON.stringify(input.fromUps) ||
        c.reason !== input.reason ||
        typeof c.index !== "number" ||
        !Number.isSafeInteger(c.index) ||
        c.index < 0 ||
        c.index > input.players.length ||
        !Array.isArray(c.moves)
      )
        throw new Error("Invalid player draw cursor");
      const acquired = c.stage === "acquired",
        prior = acquired ? c.index - 1 : c.index;
      if (
        (acquired &&
          (c.index === 0 ||
            c.target !== input.players[prior] ||
            c.count !==
              input.counts[Math.min(prior, input.counts.length - 1)] ||
            typeof c.count !== "number" ||
            c.count <= 0)) ||
        (!acquired && c.index !== input.players.length)
      )
        throw new Error("Invalid player draw progress");
      const moves = savedTransfers(c.moves, input.reason);
      if (
        input.reason === "reform" &&
        moves.length !==
          input.players
            .slice(0, prior)
            .filter(
              (_, index) =>
                input.counts[Math.min(index, input.counts.length - 1)] > 0,
            ).length
      )
        throw new Error("Missing saved reform transfer");
      let slot = 0;
      for (const move of moves) {
        if (
          move.ids.some(
            (id) =>
              !Object.values(game.cardZones).some((zone) =>
                zone.cards.includes(id),
              ),
          )
        )
          throw new Error("Unknown saved draw card");
        // Earlier alive checks cannot be replayed: Fetch may change life state.
        while (
          slot < prior &&
          (move.actor !== input.players[slot] ||
            move.ids.length !==
              input.counts[Math.min(slot, input.counts.length - 1)])
        )
          slot++;
        if (slot >= prior || move.to !== handZone(game, input.players[slot++]))
          throw new Error("Invalid saved draw recipient order");
      }
      if (!acquired) {
        const last = moves.at(-1);
        if (
          c.target !== (last?.actor ?? "") ||
          c.count !== (last?.ids.length ?? 0)
        )
          throw new Error("Invalid completed draw progress");
      }
      const next =
        child?.kind === "operation"
          ? child.operation
          : frame.operationChild?.operation;
      if (
        (child && child.kind !== "operation") ||
        (!next && !state?.abandoning) ||
        (next && next.name !== (acquired ? "get-n-cards" : "move-cards"))
      )
        throw new Error("Invalid saved player draw child");
      if (next) {
        const data = next.data;
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("Invalid saved player draw child input");
        if (acquired) {
          if (
            data.count !== c.count ||
            data.fromUp !== (input.fromUps[prior] ?? true) ||
            data.updatePileNumber !== false
          )
            throw new Error("Invalid saved player draw acquisition");
        } else if (
          data.forceVisible !== false ||
          JSON.stringify(savedTransfers(data.moves, input.reason)) !==
            JSON.stringify(moves)
        )
          throw new Error("Invalid saved player draw movement");
      }
    },
    validateResult: (game, result) => {
      drawInput(game, result.operation.data);
      if (result.value !== null)
        throw new Error("Invalid player draw completion");
    },
    validate: (game, operation) => {
      drawInput(game, operation.data);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? {
              ...drawInput(game, operation.data),
              stage: "next",
              index: 0,
              target: "",
              count: 0,
              moves: [],
            }
          : (structuredClone(continuation) as Cursor);
      if (cursor.stage === "moved") return { kind: "return", value: null };
      if (cursor.stage === "acquired") {
        const ids = operationChild?.value;
        if (
          !Array.isArray(ids) ||
          ids.length !== cursor.count ||
          ids.some(
            (id) =>
              typeof id !== "number" || !Number.isSafeInteger(id) || id < 0,
          )
        )
          throw new Error("Invalid player draw result");
        cursor.moves.push({
          ids,
          to: handZone(game, cursor.target),
          open: false,
          reason: {
            kind: "draw",
            actor: cursor.target,
            skill: cursor.reason,
            eventName: "",
          },
        });
        cursor.stage = "next";
      }
      while (cursor.index < cursor.players.length) {
        const index = cursor.index++,
          target = cursor.players[index];
        if (typeof game.alive[target] !== "boolean")
          throw new Error("Invalid draw alive state");
        if (!game.alive[target] && cursor.reason !== "reform") continue;
        const count = cursor.counts[Math.min(index, cursor.counts.length - 1)];
        if (count <= 0) continue;
        cursor.target = target;
        cursor.count = count;
        cursor.stage = "acquired";
        return {
          kind: "operation",
          operation: {
            name: "get-n-cards",
            data: {
              count,
              fromUp: cursor.fromUps[index] ?? true,
              updatePileNumber: false,
            },
          },
          continuation: cursor,
        };
      }
      cursor.stage = "moved";
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: { moves: cursor.moves, forceVisible: false },
        },
        continuation: cursor,
      };
    },
  };
}
