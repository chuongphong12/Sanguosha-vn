import {
  Assets,
  Container,
  Graphics,
  Text,
  TilingSprite,
  Texture,
} from "pixi.js";
import type { PlayerID, TqsPlayerViewState } from "../../../game/model";
import { Dashboard } from "../../ui/Dashboard";
import { SeatView } from "../../ui/SeatView";
import { opponentArcPosition, opponentsInOrder } from "../../ui/seatLayout";
import { THEME } from "../../ui/theme";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import { AnimationManager } from "./AnimationManager";

export const DASHBOARD_TOP_INSET = 250;

export interface BattleSyncOptions {
  /** Width of the board area (the log drawer is already excluded). */
  viewportWidth: number;
  viewportHeight: number;
  selectedCardIDs: Set<string>;
  selectedTargetIDs: PlayerID[];
  /** Opponents the current selection may target. */
  targetableIDs: ReadonlySet<PlayerID>;
  /** True while a card or skill is selected, so targetable seats glow. */
  choosingTarget: boolean;
  handScrollX: number;
  onSeatTap: (playerID: PlayerID) => void;
  onDashboardCardTap: (cardID: string) => void;
  onScroll: (scrollX: number) => void;
}

export class BattleScene extends Container {
  private bgContainer = new Container();
  private boardContainer = new Container();
  private seatViews = new Map<PlayerID, SeatView>();
  private orderBadges = new Map<PlayerID, Text>();
  private dashboard?: Dashboard;
  private dashboardViewerID?: PlayerID;
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
    _ctx: unknown,
    viewerID: PlayerID,
    options: BattleSyncOptions,
  ): void {
    const { viewportWidth, viewportHeight } = options;
    this.syncBackground();

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

    // Drop seats of players that are no longer in the match.
    const present = new Set(Object.keys(G.players));
    for (const [id, seat] of this.seatViews) {
      if (present.has(id)) continue;
      seat.destroy();
      this.seatViews.delete(id);
      this.orderBadges.get(id)?.destroy();
      this.orderBadges.delete(id);
    }

    const opponents = opponentsInOrder(G.seatOrder, viewerID);
    for (const pid of Object.keys(G.players)) {
      const isViewer = pid === viewerID;
      const targetOrder = options.selectedTargetIDs.indexOf(pid);
      const selected = targetOrder >= 0;
      const selectable =
        !isViewer && (selected || options.targetableIDs.has(pid));
      const seatOptions = {
        isActor: G.turn.activePlayerID === pid,
        selected,
        isHighlighted: options.choosingTarget && selectable,
        onTap: selectable ? () => options.onSeatTap(pid) : undefined,
      };

      let seat = this.seatViews.get(pid);
      if (!seat) {
        seat = new SeatView(G, pid, seatOptions);
        this.seatViews.set(pid, seat);
        this.boardContainer.addChild(seat);
      } else {
        seat.sync(G, seatOptions);
      }

      // The viewer is represented by the dashboard; the hidden seat only
      // gives animations an anchor.
      seat.visible = !isViewer;
      if (isViewer) {
        seat.position.set(30 + 8, viewportHeight - DASHBOARD_TOP_INSET + 8);
      } else {
        const index = opponents.indexOf(pid);
        const position = opponentArcPosition(
          index,
          opponents.length,
          viewportWidth,
          viewportHeight,
        );
        seat.position.set(position.x, position.y);
      }

      this.syncOrderBadge(pid, seat, targetOrder);
    }

    this.syncDashboard(G, viewerID, options);
  }

  private syncOrderBadge(pid: PlayerID, seat: SeatView, order: number): void {
    let badge = this.orderBadges.get(pid);
    if (order < 0) {
      if (badge) badge.visible = false;
      return;
    }
    if (!badge) {
      badge = new Text({
        text: "",
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 20,
          fill: THEME.colors.white,
        },
      });
      badge.anchor.set(0.5);
      this.orderBadges.set(pid, badge);
      this.boardContainer.addChild(badge);
    }
    badge.text = String(order + 1);
    badge.position.set(seat.x + 124, seat.y + 18);
    badge.visible = true;
  }

  private syncDashboard(
    G: TqsPlayerViewState,
    viewerID: PlayerID,
    options: BattleSyncOptions,
  ): void {
    const dashboardOptions = {
      viewportWidth: options.viewportWidth,
      selectedCardIDs: options.selectedCardIDs,
      handScrollX: options.handScrollX,
      onCardTap: options.onDashboardCardTap,
      onScroll: options.onScroll,
    };

    // A Dashboard is bound to one viewer; hot-seat switches must not leak the
    // previous viewer's hand or role.
    if (this.dashboard && this.dashboardViewerID !== viewerID) {
      this.dashboard.destroy({ children: true });
      this.dashboard = undefined;
    }
    if (!this.dashboard) {
      this.dashboard = new Dashboard(G, viewerID, dashboardOptions);
      this.dashboardViewerID = viewerID;
      this.addChild(this.dashboard);
    } else {
      this.dashboard.sync(G, dashboardOptions);
    }
    this.dashboard.position.set(
      30,
      options.viewportHeight - DASHBOARD_TOP_INSET,
    );
  }

  private syncBackground(): void {
    let bgTex: Texture | undefined;
    try {
      bgTex = Assets.get<Texture>("main/ui/system/background/table.jpg");
    } catch {
      /* ignore */
    }

    if (
      bgTex &&
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

  /** Forget everything tied to one match so a reused scene starts clean. */
  public reset(): void {
    this.animationManager?.dispose();
    this.animationManager = undefined;
    this.lastSequence = 0;
    for (const seat of this.seatViews.values()) seat.destroy();
    this.seatViews.clear();
    for (const badge of this.orderBadges.values()) badge.destroy();
    this.orderBadges.clear();
    this.dashboard?.destroy({ children: true });
    this.dashboard = undefined;
    this.dashboardViewerID = undefined;
  }

  public dispose(): void {
    this.reset();
    this.removeChildren();
  }
}
