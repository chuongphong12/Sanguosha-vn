import { Container, Graphics, TilingSprite, Texture, Assets } from "pixi.js";
import type {
  PlayerID,
  TqsPlayerViewState,
  ZoneCardChoice,
} from "../../../game/model";
import { SeatView } from "../../ui/SeatView";
import { Dashboard } from "../../ui/Dashboard";
import { THEME } from "../../ui/theme";
import { TABLE_BACKGROUND_ALIAS } from "../../ui/assetAliases";
import { AnimationManager } from "./AnimationManager";

const DASHBOARD_HEIGHT = 240;
const SEAT_WIDTH = 140;
const SEAT_HEIGHT = 160;
/** Keeps the top seat clear of the status panel. */
const SEAT_TOP_MIN = 84;

export class BattleScene extends Container {
  private bgContainer = new Container();
  private boardContainer = new Container();
  private seatViews = new Map<PlayerID, SeatView>();
  private dashboard?: Dashboard;
  private animationManager?: AnimationManager;
  private lastSequence = 0;

  constructor() {
    super();
    this.addChild(this.bgContainer);
    this.addChild(this.boardContainer);

    // Initial dark background before texture loads
    const fallbackBg = new Graphics()
      .rect(0, 0, 3000, 2000)
      .fill({ color: 0x111111 });
    this.bgContainer.addChild(fallbackBg);
  }

  public sync(
    G: TqsPlayerViewState,
    ctx: any,
    viewerID: PlayerID,
    options: {
      viewportWidth: number;
      viewportHeight: number;
      selectedCardIDs: Set<string>;
      selectedTargetIDs: PlayerID[];
      selectableTargetIDs: Set<PlayerID>;
      highlightedTargetIDs: Set<PlayerID>;
      /** False during a hot-seat handoff so the previous viewer's hand stays hidden. */
      showDashboard: boolean;
      handScrollX: number;
      onSeatTap: (playerID: PlayerID) => void;
      onDashboardCardTap: (cardID: string) => void;
    },
  ): void {
    this.syncBackground(options.viewportWidth, options.viewportHeight);

    if (!this.animationManager) {
      this.animationManager = new AnimationManager(
        this,
        this.seatViews,
        () => viewerID,
      );
    }

    if (G.stream) {
      const newEvents = G.stream.events.filter(
        (e) => e.sequence > this.lastSequence,
      );
      if (newEvents.length > 0) {
        this.lastSequence = newEvents[newEvents.length - 1].sequence;
        this.animationManager.enqueue(newEvents);
      }
    }

    // Sync seats
    const newPlayers = new Set(Object.keys(G.players));
    for (const [id, seat] of this.seatViews) {
      if (!newPlayers.has(id)) {
        seat.destroy();
        this.seatViews.delete(id);
      }
    }

    const { viewportWidth, viewportHeight } = options;
    // Opponent ring between the status bar (top) and the action row above the dashboard.
    const centerX = viewportWidth / 2;
    const centerY = (viewportHeight - DASHBOARD_HEIGHT) / 2 + 20;
    const radiusX = viewportWidth / 2 - SEAT_WIDTH / 2 - 30;
    const radiusY = centerY - SEAT_TOP_MIN - SEAT_HEIGHT / 2;

    // Seats sit on an ellipse, starting with the viewer at the bottom (hidden behind the dashboard).
    const viewerIndex = Math.max(0, G.seatOrder.indexOf(viewerID));
    const seatOrder = [
      ...G.seatOrder.slice(viewerIndex),
      ...G.seatOrder.slice(0, viewerIndex),
    ];
    const angleStep = (2 * Math.PI) / Math.max(1, seatOrder.length);

    seatOrder.forEach((pid, index) => {
      const seatOptions = {
        isActor: G.turn.activePlayerID === pid,
        selected: options.selectedTargetIDs.includes(pid),
        isHighlighted: options.highlightedTargetIDs.has(pid),
        onTap: options.selectableTargetIDs.has(pid)
          ? () => options.onSeatTap(pid)
          : undefined,
      };

      let seat = this.seatViews.get(pid);
      if (!seat) {
        seat = new SeatView(G, pid, seatOptions);
        this.seatViews.set(pid, seat);
        this.boardContainer.addChild(seat);
      } else {
        seat.sync(G, seatOptions);
      }

      seat.visible = pid !== viewerID;
      const angle = Math.PI / 2 + index * angleStep;
      seat.position.set(
        centerX + radiusX * Math.cos(angle) - SEAT_WIDTH / 2,
        centerY + radiusY * Math.sin(angle) - SEAT_HEIGHT / 2,
      );
    });

    this.syncDashboard(G, viewerID, options);
  }

  private syncDashboard(
    G: TqsPlayerViewState,
    viewerID: PlayerID,
    options: {
      viewportWidth: number;
      viewportHeight: number;
      selectedCardIDs: Set<string>;
      showDashboard: boolean;
      handScrollX: number;
      onDashboardCardTap: (cardID: string) => void;
    },
  ): void {
    // A Dashboard belongs to one viewer; rebuild it on a hot-seat switch so no private state carries over.
    if (this.dashboard && this.dashboard.viewerID !== viewerID) {
      this.dashboard.destroy({ children: true });
      this.dashboard = undefined;
    }

    const dashboardOptions = {
      viewportWidth: options.viewportWidth,
      selectedCardIDs: options.selectedCardIDs,
      handScrollX: options.handScrollX,
      onCardTap: options.onDashboardCardTap,
      onScroll: () => {},
    };
    if (!this.dashboard) {
      this.dashboard = new Dashboard(G, viewerID, dashboardOptions);
      this.addChild(this.dashboard);
    } else {
      this.dashboard.sync(G, dashboardOptions);
    }
    this.dashboard.position.set(30, options.viewportHeight - DASHBOARD_HEIGHT);
    this.dashboard.visible = options.showDashboard;
  }

  private syncBackground(width: number, height: number): void {
    let bgTex: Texture | undefined;
    try {
      bgTex = Assets.get<Texture>(TABLE_BACKGROUND_ALIAS);
    } catch {
      /* ignore */
    }

    if (bgTex) {
      if (
        this.bgContainer.children.length === 1 &&
        this.bgContainer.children[0] instanceof Graphics
      ) {
        this.bgContainer.removeChildren();
        const bg = new TilingSprite({
          texture: bgTex,
          width: 3000,
          height: 2000,
        });
        bg.tint = 0x666666;
        this.bgContainer.addChild(bg);
      }
    }
  }

  /** Forget everything tied to one match so a reused scene starts clean. */
  public reset(): void {
    this.animationManager?.dispose();
    this.animationManager = undefined;
    this.lastSequence = 0;
    for (const seat of this.seatViews.values()) seat.destroy();
    this.seatViews.clear();
    this.dashboard?.destroy({ children: true });
    this.dashboard = undefined;
  }

  public dispose(): void {
    this.reset();
    this.removeChildren();
  }
}
