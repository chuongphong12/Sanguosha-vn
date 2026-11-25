/** Native packages define kingdom IDs; they are not Identity 2013 roles. */
export interface HegemonyGeneral {
  id: string;
  kingdoms: string[];
  /** Native getMaxHpHead/getMaxHpDeputy contributions, before pair division. */
  headMaxHp: number;
  deputyMaxHp: number;
  lord?: boolean;
}

export type GeneralSlot = "head" | "deputy";

export type HegemonyAlliance =
  | { kind: "faction"; kingdom: string }
  | { kind: "careerist"; group: string | null };

export interface HegemonyPlayer {
  id: string;
  head: { id: string | null; shown: boolean };
  deputy: { id: string | null; shown: boolean };
  candidates: string[];
  initialKingdom: string | null;
  kingdom: string | null;
  alliance: HegemonyAlliance | null;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface HegemonyState {
  rulesVersion: "hegemony-ce4e62b";
  status: "selecting-generals" | "ready";
  seatOrder: string[];
  generals: Record<string, HegemonyGeneral>;
  bannedPairs: [string, string][];
  players: Record<string, HegemonyPlayer>;
}

export interface HegemonySetupOptions {
  generals: HegemonyGeneral[];
  offers: Record<string, string[]>;
  bannedPairs?: [string, string][];
}

export interface GeneralPairChoice {
  head: string;
  deputy: string;
  kingdom?: string;
}

export interface HegemonyPlayerView {
  rulesVersion: HegemonyState["rulesVersion"];
  status: HegemonyState["status"];
  seatOrder: string[];
  players: Record<
    string,
    Omit<HegemonyPlayer, "initialKingdom"> & {
      selected: boolean;
      /** Only present for the owner, including after reconnect. */
      initialKingdom?: string | null;
    }
  >;
}
