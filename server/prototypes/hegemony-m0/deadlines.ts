/** Trusted OS boundary; not a client clock or a client-callable timer API. */
export interface ServiceClock {
  now: () => number;
  schedule: (task: () => Promise<void>, delay: number) => () => void;
}
export const systemClock: ServiceClock = {
  now: () => performance.now(),
  schedule: (task, delay) => {
    const timer = setTimeout(() => {
      void task();
    }, delay);
    timer.unref();
    return () => clearTimeout(timer);
  },
};
export const graceMs = 60_000;
export type Deadlines = {
  prompt: { id: string; actor: string; until: number } | null;
  offline: Record<string, number>;
  emptyUntil: number | null;
};
export const initialDeadlines = (): Deadlines => ({
  prompt: null,
  offline: {},
  emptyUntil: null,
});

/** Re-observation of the same prompt/offline episode never grants another minute. */
export function synchronizeDeadlines(
  state: Deadlines,
  members: string[],
  online: string[],
  prompt: { id: string; actor: string } | null,
  now: number,
) {
  if (!prompt) state.prompt = null;
  else if (
    state.prompt?.id !== prompt.id ||
    state.prompt.actor !== prompt.actor
  )
    state.prompt = { id: prompt.id, actor: prompt.actor, until: now + graceMs };
  for (const actor of Object.keys(state.offline))
    if (!members.includes(actor) || online.includes(actor))
      delete state.offline[actor];
  for (const actor of members)
    if (!online.includes(actor)) state.offline[actor] ??= now + graceMs;
  if (online.length) state.emptyUntil = null;
  else state.emptyUntil ??= now + graceMs;
}
