import type { GameStartNotice } from "./game-start";
import type { TriggerData } from "./scheduler";

/** Rebuild the allowlist; package metadata must never hitchhike into a player view. */
export function matchStartupNotice(value: TriggerData): GameStartNotice {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid startup notice");
  const text = (key: string): string => {
    if (typeof value[key] !== "string")
      throw new Error("Invalid startup notice text");
    return value[key];
  };
  const number = (key: string): number => {
    const n = value[key];
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
      throw new Error("Invalid startup notice number");
    return n;
  };
  switch (value.kind) {
    case "lightbox":
      return {
        kind: "lightbox",
        name: text("name"),
        duration: number("duration"),
      };
    case "delay":
      return { kind: "delay", duration: number("duration") };
    case "known-general":
      return {
        kind: "known-general",
        viewer: text("viewer"),
        target: text("target"),
        name: text("name"),
      };
    case "view-generals": {
      const names = value.names;
      if (!Array.isArray(names) || names.some((n) => typeof n !== "string"))
        throw new Error("Invalid startup notice generals");
      return {
        kind: "view-generals",
        viewer: text("viewer"),
        names: names as string[],
      };
    }
    case "set-mark":
      return {
        kind: "set-mark",
        target: text("target"),
        name: text("name"),
        value: number("value"),
      };
    default:
      throw new Error("Unknown startup notice");
  }
}
