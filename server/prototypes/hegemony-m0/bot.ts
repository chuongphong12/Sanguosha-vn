/** THROWAWAY actor-only policy baseline, not competitive or full-content AI. */
export const policyVersion = "PROTOTYPE-native-keep-values-v1";
export type Offer = {
  id: string;
  kind:
    | "draw"
    | "jink"
    | "peach"
    | "analeptic"
    | "nullification"
    | "discard"
    | "target"
    | "invoke"
    | "reveal"
    | "decline";
  card?: "Slash" | "Nullification" | "Jink" | "Peach";
  relation?: "friend" | "enemy" | "unknown";
  hp?: number;
  publicBenefit?: boolean;
};
export type Observation = {
  actor: string;
  kind:
    | "draw"
    | "response"
    | "rescue-self"
    | "rescue-other"
    | "discard"
    | "target"
    | "invoke"
    | "reveal"
    | "nullification";
  offers: Offer[];
  protectsActor?: boolean;
};
export type Memory = {
  version: typeof policyVersion;
  actor: string;
  seed: number;
  decisions: number;
};
// Native standard_cards-ai.lua at ce4e62b: 928,1099,1103,1910.
const keep = { Slash: 3.6, Nullification: 3.8, Jink: 5.2, Peach: 7 };
export function chooseBot(
  view: Observation,
  memory: Memory,
): { choice: string | null; memory: Memory } {
  if (memory.actor !== view.actor || memory.version !== policyVersion)
    throw new Error("Bot memory identity mismatch");
  if (new Set(view.offers.map((o) => o.id)).size !== view.offers.length)
    throw new Error("Duplicate offer");
  function score(o: Offer) {
    if (o.kind === "decline") return 0;
    if (view.kind === "discard" && o.kind === "discard" && o.card)
      return 20 - keep[o.card];
    if (view.kind === "draw" && o.kind === "draw") return 10;
    if (view.kind === "response" && o.kind === "jink") return 10;
    if (view.kind === "rescue-self" && o.kind === "analeptic") return 11;
    if (
      (view.kind === "rescue-self" ||
        (view.kind === "rescue-other" && o.relation === "friend")) &&
      o.kind === "peach"
    )
      return 10;
    if (
      view.kind === "nullification" &&
      o.kind === "nullification" &&
      view.protectsActor === true
    )
      return 10;
    if (view.kind === "target" && o.kind === "target" && o.relation === "enemy")
      return 10 + (4 - (o.hp ?? 4));
    if (
      (view.kind === "invoke" || view.kind === "reveal") &&
      o.kind === view.kind &&
      o.publicBenefit === true
    )
      return 10;
    return -100;
  }
  const ranked = view.offers
    .map((o) => ({ id: o.id, score: score(o) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, "en"));
  const best = ranked[0],
    tied = ranked.filter((o) => o.score === best?.score);
  const seed = (Math.imul(memory.seed, 1664525) + 1013904223) >>> 0;
  return {
    choice: best && best.score >= 0 ? tied[seed % tied.length].id : null,
    memory: { ...memory, seed, decisions: memory.decisions + 1 },
  };
}
