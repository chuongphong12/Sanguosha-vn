import type { PlayerID } from "../../../game/model";

/** Pure waiting-room rules, kept free of Pixi so they can be unit tested. */

export const MIN_PLAYERS_TO_START = 4;
export const PLAYER_COUNT_OPTIONS = [4, 5, 6, 8, 10];
export const TURN_TIME_OPTIONS: Array<number | null> = [null, 30, 15];

/** Only seat 0 may send `startGame`; the authoritative move rejects anyone else. */
const HOST_ID: PlayerID = "0";

export interface RoomSeatData {
  id: number;
  name?: string;
}

export interface RoomMember {
  id: PlayerID;
  name: string;
}

export interface RoomSettings {
  targetNumPlayers: number;
  autoStartWhenFull: boolean;
  autoSkipWuxie: boolean;
  lordExtraHp: 0 | 1;
  turnTimeLimit: number | null;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  targetNumPlayers: 8,
  autoStartWhenFull: false,
  autoSkipWuxie: true,
  lordExtraHp: 1,
  turnTimeLimit: null,
};

export interface StartGamePayload {
  autoSkipWuxie: boolean;
  lordExtraHp: number;
  turnTimeLimit: number | null;
  actualNumPlayers: number;
  joinedPlayerIDs: PlayerID[];
}

export function getRoomMembers(
  matchData: RoomSeatData[] | undefined,
): RoomMember[] {
  return (matchData ?? [])
    .filter((seat) => Boolean(seat.name))
    .sort((a, b) => a.id - b.id)
    .map((seat) => ({ id: String(seat.id), name: seat.name as string }));
}

export function isRoomHost(viewerID: PlayerID): boolean {
  return viewerID === HOST_ID;
}

export function canStartGame(
  members: RoomMember[],
  viewerID: PlayerID,
): boolean {
  return isRoomHost(viewerID) && members.length >= MIN_PLAYERS_TO_START;
}

export function buildStartGamePayload(
  members: RoomMember[],
  settings: RoomSettings,
): StartGamePayload {
  const seated = members.slice(0, settings.targetNumPlayers);
  return {
    autoSkipWuxie: settings.autoSkipWuxie,
    lordExtraHp: settings.lordExtraHp,
    turnTimeLimit: settings.turnTimeLimit,
    actualNumPlayers: seated.length,
    joinedPlayerIDs: seated.map((member) => member.id),
  };
}

export function shouldAutoStart(
  members: RoomMember[],
  viewerID: PlayerID,
  settings: RoomSettings,
  alreadyStarting: boolean,
): boolean {
  return (
    !alreadyStarting &&
    settings.autoStartWhenFull &&
    canStartGame(members, viewerID) &&
    members.length >= settings.targetNumPlayers
  );
}

export function cycleOption<T>(options: readonly T[], current: T): T {
  const index = options.indexOf(current);
  return options[(index + 1) % options.length];
}

export interface WaitingRoomLayout {
  listCenterX: number;
  settingsCenterX: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  slotHeight: number;
  slotPitch: number;
  settingRowsY: number[];
  settingButton: { width: number; height: number };
  startButton: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
}

/** Geometry shared by the scene and the e2e click helper. */
export function waitingRoomLayout(viewportWidth: number): WaitingRoomLayout {
  const listCenterX = viewportWidth / 2 - 250;
  const settingsCenterX = viewportWidth / 2 + 250;
  const panelTop = 160;
  const settingRowsY = Array.from({ length: 5 }, (_, i) => 190 + i * 50);
  return {
    listCenterX,
    settingsCenterX,
    panelTop,
    panelWidth: 360,
    panelHeight: 470,
    slotHeight: 38,
    slotPitch: 44,
    settingRowsY,
    settingButton: { width: 320, height: 36 },
    startButton: {
      centerX: settingsCenterX,
      centerY: settingRowsY[4] + 200,
      width: 280,
      height: 50,
    },
  };
}
