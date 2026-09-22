import { Container, Graphics, TilingSprite, Texture, Assets } from "pixi.js";
import type {
  PlayerID,
  TqsPlayerViewState,
  ZoneCardChoice,
} from "../../../game/model";
import { SeatView } from "../../ui/SeatView";
import { Dashboard } from "../../ui/Dashboard";
import { THEME } from "../../ui/theme";
import { AnimationManager } from "./AnimationManager";

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
      onSeatTap: (playerID: PlayerID) => void;
      onDashboardCardTap: (cardID: string) => void;
    },
  ): void {
    this.syncBackground(options.viewportWidth, options.viewportHeight);

    if (!this.animationManager) {
      this.animationManager = new AnimationManager(this, this.seatViews, () => viewerID);
    }

    if (G.stream) {
      const newEvents = G.stream.events.filter(e => e.sequence > this.lastSequence);
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
    const padding = 60;
    const w = viewportWidth - padding * 2;
    const h = viewportHeight - padding * 2 - 240; // leaving room for dashboard

    // Very basic circle layout, matching MainScreen behavior (or better)
    const numPlayers = Object.keys(G.players).length;
    const angleStep = (2 * Math.PI) / Math.max(1, numPlayers);
    let currentAngle = Math.PI / 2; // start bottom

    Object.keys(G.players).forEach((pid) => {
      const isActor = G.turn.activePlayerID === pid;
      const isSelected = options.selectedTargetIDs.includes(pid);
      const isHighlighted = false; // TODO: canSelectTarget(G, pid)

      let seat = this.seatViews.get(pid);
      if (!seat) {
        seat = new SeatView(G, pid, {
          isActor,
          selected: isSelected,
          isHighlighted,
          onTap: () => options.onSeatTap(pid),
        });
        this.seatViews.set(pid, seat);
        this.boardContainer.addChild(seat);
      } else {
        seat.sync(G, {
          isActor,
          selected: isSelected,
          isHighlighted,
          onTap: () => options.onSeatTap(pid),
        });
      }

      // Position (this should be replaced by a proper SeatLayout function later)
      if (pid === viewerID) {
        seat.position.set(viewportWidth / 2, viewportHeight - 240 - 100);
      } else {
        const radiusX = w / 2;
        const radiusY = h / 2;
        seat.position.set(
          viewportWidth / 2 + radiusX * Math.cos(currentAngle),
          viewportHeight / 2 - 120 + radiusY * Math.sin(currentAngle),
        );
      }
      currentAngle += angleStep;
    });

    // Sync dashboard
    if (!this.dashboard) {
      this.dashboard = new Dashboard(G, viewerID, {
        viewportWidth,
        selectedCardIDs: options.selectedCardIDs,
        handScrollX: 0,
        onCardTap: options.onDashboardCardTap,
        onScroll: () => {},
      });
      this.dashboard.position.set(30, viewportHeight - 240);
      this.addChild(this.dashboard);
    } else {
      this.dashboard.sync(G, {
        viewportWidth,
        selectedCardIDs: options.selectedCardIDs,
        handScrollX: 0,
        onCardTap: options.onDashboardCardTap,
        onScroll: () => {},
      });
      this.dashboard.position.set(30, viewportHeight - 240);
    }
  }

  private syncBackground(width: number, height: number): void {
    let bgTex: Texture | undefined;
    try {
      bgTex = Assets.get<Texture>("main/ui/system/background/table.jpg");
    } catch (e) {
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

  public dispose(): void {
    this.removeChildren();
  }
}
