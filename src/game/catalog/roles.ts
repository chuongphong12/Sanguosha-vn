import type { Role } from "../model";

const STANDARD_ROLES: Record<number, Role[]> = {
  4: ["lord", "loyalist", "rebel", "renegade"],
  5: ["lord", "loyalist", "rebel", "rebel", "renegade"],
  6: ["lord", "loyalist", "rebel", "rebel", "rebel", "renegade"],
  7: ["lord", "loyalist", "loyalist", "rebel", "rebel", "rebel", "renegade"],
  8: [
    "lord",
    "loyalist",
    "loyalist",
    "rebel",
    "rebel",
    "rebel",
    "rebel",
    "renegade",
  ],
  9: [
    "lord",
    "loyalist",
    "loyalist",
    "loyalist",
    "rebel",
    "rebel",
    "rebel",
    "rebel",
    "renegade",
  ],
  10: [
    "lord",
    "loyalist",
    "loyalist",
    "loyalist",
    "rebel",
    "rebel",
    "rebel",
    "rebel",
    "renegade",
    "renegade",
  ],
};

const DOUBLE_RENEGADE_ROLES: Partial<Record<number, Role[]>> = {
  6: ["lord", "loyalist", "rebel", "rebel", "renegade", "renegade"],
  8: [
    "lord",
    "loyalist",
    "loyalist",
    "rebel",
    "rebel",
    "rebel",
    "renegade",
    "renegade",
  ],
};

export const ROLE_NAMES: Record<Role, string> = {
  lord: "Chủ Công",
  loyalist: "Trung Thần",
  rebel: "Phản Tặc",
  renegade: "Nội Gian",
};

export function getRoleDeck(
  numPlayers: number,
  variant: "standard" | "double-renegade" = "standard",
): Role[] {
  const roles =
    variant === "double-renegade"
      ? DOUBLE_RENEGADE_ROLES[numPlayers]
      : undefined;
  const selectedRoles = roles ?? STANDARD_ROLES[numPlayers];
  if (!selectedRoles) {
    throw new Error("Số người chơi phải nằm trong khoảng từ 4 đến 10.");
  }
  return [...selectedRoles];
}
