import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";

import { TqsGame } from "../game/TqsGame";
import type { PlayerID, TqsGameState, TqsPlayerViewState } from "../game/model";

type ClientOptions = Parameters<typeof Client<TqsGameState>>[0];
type Transport = NonNullable<ClientOptions["multiplayer"]>;
type LocalClient = ReturnType<typeof Client<TqsGameState>>;
type AuthoritativeClientState = ReturnType<LocalClient["getState"]>;
export type LocalMatchState =
  | null
  | (Omit<NonNullable<AuthoritativeClientState>, "G"> & {
      G: TqsPlayerViewState;
    });
type StateListener = (state: LocalMatchState) => void;

export class LocalMatch {
  private readonly clients = new Map<PlayerID, LocalClient>();
  private viewerID: PlayerID = "0";
  private unsubscribeViewer?: () => void;

  constructor(
    numPlayers = 4,
    matchID = "local-match",
    /**
     * Optional boardgame.io transport. Pass `SocketIO({ server })` to point
     * the same screen code at a remote master; defaults to the local master
     * for hot-seat play.
     */
    multiplayer?: Transport,
  ) {
    for (let index = 0; index < numPlayers; index += 1) {
      const playerID = String(index);
      const client = Client<TqsGameState>({
        game: TqsGame,
        numPlayers,
        matchID,
        playerID,
        multiplayer: multiplayer ?? Local(),
        debug: false,
      });
      client.start();
      this.clients.set(playerID, client);
    }
  }

  public get playerIDs(): PlayerID[] {
    return [...this.clients.keys()];
  }

  public get currentViewerID(): PlayerID {
    return this.viewerID;
  }

  public get state(): LocalMatchState {
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

  // boardgame.io types playerView as the authoritative G type in 0.50.2.
  private asPlayerView(state: AuthoritativeClientState): LocalMatchState {
    return state as LocalMatchState;
  }
}
