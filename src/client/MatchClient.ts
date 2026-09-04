import { Client } from "boardgame.io/client";
import { Local, SocketIO } from "boardgame.io/multiplayer";

import { TqsGame } from "../game/TqsGame";
import type { PlayerID, TqsGameState, TqsPlayerViewState } from "../game/model";

type LocalClient = ReturnType<typeof Client<TqsGameState>>;
type AuthoritativeClientState = ReturnType<LocalClient["getState"]>;

export type MatchClientState =
  | null
  | (Omit<NonNullable<AuthoritativeClientState>, "G"> & {
      G: TqsPlayerViewState;
    });

type StateListener = (state: MatchClientState) => void;

export interface MatchConfig {
  numPlayers?: number;
  matchID?: string;
  mode?: "local" | "remote";
  playerID?: PlayerID; // Required for remote
  serverUrl?: string; // Required for remote
  credentials?: string; // Required if joining via lobby
}

export class MatchClient {
  private readonly clients = new Map<PlayerID, LocalClient>();
  private viewerID: PlayerID = "0";
  private unsubscribeViewer?: () => void;
  public readonly isRemote: boolean;

  constructor(config: MatchConfig = {}) {
    const {
      numPlayers = 4,
      matchID = "local-match",
      mode = "local",
      playerID,
      serverUrl,
      credentials,
    } = config;

    this.isRemote = mode === "remote";

    if (this.isRemote) {
      if (!playerID) throw new Error("Cần playerID cho chế độ remote");
      this.viewerID = playerID;
      const client = Client<TqsGameState>({
        game: TqsGame,
        numPlayers,
        matchID,
        playerID,
        credentials,
        multiplayer: SocketIO({ server: serverUrl }),
        debug: false,
      });
      client.start();
      this.clients.set(playerID, client);
    } else {
      // Local hotseat mode
      for (let index = 0; index < numPlayers; index += 1) {
        const id = String(index);
        const client = Client<TqsGameState>({
          game: TqsGame,
          numPlayers,
          matchID,
          playerID: id,
          multiplayer: Local(),
          debug: false,
        });
        client.start();
        this.clients.set(id, client);
      }
    }
  }

  public get playerIDs(): PlayerID[] {
    return [...this.clients.keys()];
  }

  public get currentViewerID(): PlayerID {
    return this.viewerID;
  }

  public get state(): MatchClientState {
    return this.asPlayerView(this.getClient(this.viewerID).getState());
  }

  public subscribe(listener: StateListener): () => void {
    this.unsubscribeViewer?.();
    this.unsubscribeViewer = this.getClient(this.viewerID).subscribe((state) =>
      listener(this.asPlayerView(state)),
    );
    return () => {
      this.unsubscribeViewer?.();
      this.unsubscribeViewer = undefined;
    };
  }

  public switchViewer(playerID: PlayerID, listener: StateListener): void {
    if (this.isRemote) return; // Cannot switch viewer in remote mode
    this.getClient(playerID);
    this.viewerID = playerID;
    this.unsubscribeViewer?.();
    this.unsubscribeViewer = this.getClient(playerID).subscribe((state) =>
      listener(this.asPlayerView(state)),
    );
  }

  public move(name: string, ...args: unknown[]): void {
    const move = this.getClient(this.viewerID).moves[name];
    if (!move) throw new Error(`Nước đi không tồn tại: ${name}`);
    move(...args);
  }

  public destroy(): void {
    this.unsubscribeViewer?.();
    this.unsubscribeViewer = undefined;
    for (const client of this.clients.values()) client.stop();
    this.clients.clear();
  }

  private getClient(playerID: PlayerID): LocalClient {
    const client = this.clients.get(playerID);
    if (!client) throw new Error(`Người chơi không tồn tại: ${playerID}`);
    return client;
  }

  private asPlayerView(state: AuthoritativeClientState): MatchClientState {
    return state as MatchClientState;
  }
}
