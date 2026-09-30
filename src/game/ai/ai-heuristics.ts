import type { Ctx } from "boardgame.io";
import type {
  GamePrompt,
  PlayerID,
  PromptAnswer,
  TqsGameState,
  ZoneCardChoice,
} from "../model";
import { CARD_DEFINITIONS } from "../catalog/cards";
import { attackRange, distanceBetween } from "../rules";

export interface AiMove {
  move: string;
  args: unknown[];
}

function isEnemy(G: TqsGameState, a: PlayerID, b: PlayerID): boolean {
  if (a === b) return false;
  const pA = G.players[a];
  const pB = G.players[b];
  if (!pA.roleRevealed && !pB.roleRevealed) {
    // If neither is revealed, bot acts passively or randomly.
    // We'll treat unrevealed as NOT enemy to avoid randomly attacking friends,
    // UNLESS the bot is a rebel and attacks the Lord (Lord is always revealed).
    // Actually, Lord is always revealed.
    return false;
  }

  const getAlignment = (role: string) => {
    if (role === "lord" || role === "loyalist") return "good";
    if (role === "rebel") return "evil";
    return "neutral"; // renegade
  };

  const alignA = getAlignment(pA.role);
  const alignB = getAlignment(pB.role);

  if (alignA === "neutral" || alignB === "neutral") {
    // Renegade considers everyone an enemy (simplified)
    return true;
  }

  return alignA !== alignB;
}

/** Prompts that every eligible player may answer at once, not only `responderID`. */
function isSimultaneousWindow(prompt: GamePrompt): boolean {
  return (
    prompt.kind === "card-response" &&
    (prompt.reason === "rescue" ||
      prompt.reason === "nullification" ||
      prompt.reason === "arrow-barrage" ||
      prompt.reason === "barbarian-invasion")
  );
}

function answer(promptID: number, response: PromptAnswer): AiMove {
  return { move: "answerPrompt", args: [promptID, response] };
}

function zoneChoices(
  G: TqsGameState,
  ownerID: PlayerID,
  zones: readonly string[],
  count: number,
): ZoneCardChoice[] {
  const owner = G.players[ownerID];
  const choices: ZoneCardChoice[] = [];
  if (zones.includes("hand")) {
    for (let i = 0; i < owner.hand.length; i += 1)
      choices.push({ zone: "hand", ownerID, handIndex: i });
  }
  if (zones.includes("equipment")) {
    for (const [slot, cardID] of Object.entries(owner.equipment)) {
      if (cardID)
        choices.push({
          zone: "equipment",
          ownerID,
          slot: slot as Extract<ZoneCardChoice, { zone: "equipment" }>["slot"],
        });
    }
  }
  if (zones.includes("judgement")) {
    for (const cardID of owner.judgement)
      choices.push({ zone: "judgement", ownerID, cardID });
  }
  return choices.slice(0, count);
}

function promptMoves(
  G: TqsGameState,
  prompt: GamePrompt,
  playerID: PlayerID,
): AiMove[] {
  const player = G.players[playerID];
  const simultaneous = isSimultaneousWindow(prompt);

  if (simultaneous) {
    if (prompt.kind !== "card-response" || !player.alive) return [];
    if (prompt.passedPlayerIDs?.includes(playerID)) return [];
    const isAoe =
      prompt.reason === "arrow-barrage" ||
      prompt.reason === "barbarian-invasion";
    if (isAoe && prompt.sourceID === playerID) return [];
  } else if (prompt.responderID !== playerID) {
    return [];
  }

  switch (prompt.kind) {
    case "card-response": {
      const needed =
        prompt.response === "aoe-response"
          ? prompt.reason === "arrow-barrage"
            ? "dodge"
            : "slash"
          : prompt.response;
      const helpsTarget =
        prompt.reason !== "rescue" ||
        prompt.targetID === playerID ||
        !isEnemy(G, playerID, prompt.targetID);
      if (
        !prompt.forbidCard &&
        helpsTarget &&
        (needed === "dodge" || needed === "slash" || needed === "peach")
      ) {
        const cardID = player.hand.find(
          (c) => G.cards[c].definitionID === needed,
        );
        if (cardID) return [answer(prompt.id, { kind: "card", cardID })];
      }
      return [answer(prompt.id, { kind: "pass" })];
    }
    case "option": {
      const choice = prompt.choices.includes("decline")
        ? "decline"
        : (prompt.choices[0] ?? "decline");
      return [answer(prompt.id, { kind: "option", choice })];
    }
    case "select-cards": {
      if (prompt.minimum === 0 && prompt.allowPass)
        return [answer(prompt.id, { kind: "pass" })];
      const choices = zoneChoices(
        G,
        prompt.ownerID,
        prompt.zones,
        Math.max(1, prompt.minimum),
      );
      return [answer(prompt.id, { kind: "zone-cards", choices })];
    }
    case "harvest-choice":
      return [
        answer(prompt.id, {
          kind: "harvest",
          cardID: prompt.availableCardIDs[0],
        }),
      ];
    case "choose-players":
      return [
        prompt.minimum === 0
          ? answer(prompt.id, { kind: "pass" })
          : answer(prompt.id, {
              kind: "players",
              playerIDs: prompt.candidates.slice(0, prompt.minimum),
            }),
      ];
    default:
      return [answer(prompt.id, { kind: "pass" })];
  }
}

function playMoves(G: TqsGameState, ctx: Ctx, playerID: PlayerID): AiMove[] {
  const player = G.players[playerID];
  const play = (cardID: string, targetIDs: PlayerID[]): AiMove => ({
    move: "playCard",
    args: [{ kind: "physical", cardID, targetIDs }],
  });

  // 1. Heal with a Peach when wounded.
  if (player.hp < player.maxHP) {
    const peachID = player.hand.find(
      (c) => G.cards[c].definitionID === "peach",
    );
    if (peachID) return [play(peachID, [])];
  }

  // 2. Put on equipment.
  for (const cardID of player.hand) {
    if (CARD_DEFINITIONS[G.cards[cardID].definitionID].kind === "equipment")
      return [play(cardID, [])];
  }

  // 3. Slash an enemy in range.
  const hasCrossbow =
    player.equipment.weapon !== undefined &&
    G.cards[player.equipment.weapon]?.definitionID === "crossbow";
  if (hasCrossbow || player.slashUses < 1) {
    const slashID = player.hand.find(
      (c) => G.cards[c].definitionID === "slash",
    );
    if (slashID) {
      const range = attackRange(G, playerID);
      for (const targetID of ctx.playOrder ?? G.seatOrder) {
        if (targetID === playerID || !G.players[targetID].alive) continue;
        if (
          isEnemy(G, playerID, targetID) &&
          distanceBetween(G, playerID, targetID) <= range
        )
          return [play(slashID, [targetID])];
      }
    }
  }

  // 4. Nothing worthwhile left.
  return [{ move: "endPlayPhase", args: [] }];
}

/**
 * Legal, sensible moves for `playerID` in the current state, or none when it is
 * not this player's turn to act. The game keeps every player active, so who
 * acts is derived from `G` (prompt / turn step), not from boardgame.io stages.
 */
export function getHeuristicMoves(
  G: TqsGameState,
  ctx: Ctx,
  playerID: PlayerID,
): AiMove[] {
  const player = G.players[playerID];
  if (!player || G.status === "ended") return [];

  if (G.prompt) return promptMoves(G, G.prompt, playerID);

  if (G.status === "lord-selection" || G.status === "general-selection") {
    if (!player.generalID && player.generalCandidates.length > 0) {
      return [{ move: "selectGeneral", args: [player.generalCandidates[0]] }];
    }
    return [];
  }

  if (G.status !== "playing" || G.turn.activePlayerID !== playerID) return [];

  if (G.turn.step === "play") return playMoves(G, ctx, playerID);

  if (G.turn.step === "discard") {
    const excess = player.hand.length - Math.max(0, player.hp);
    return [
      {
        move: "discardCards",
        args: [excess > 0 ? player.hand.slice(0, excess) : []],
      },
    ];
  }

  return [];
}
