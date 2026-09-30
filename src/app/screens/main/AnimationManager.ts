import { Container, Text, Sprite, Assets, Graphics } from "pixi.js";
import { animate } from "motion";
import type { PresentationEvent } from "../../../game/types/presentation";
import type { PlayerID, TqsPlayerViewState } from "../../../game/model";
import { SeatView } from "../../ui/SeatView";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import { THEME } from "../../ui/theme";

/**
 * motion renders the last frame of a tween after its promise resolves, so a
 * target destroyed straight away is written to while destroyed.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

export class AnimationManager {
  private queue: PresentationEvent[] = [];
  private isPlaying = false;
  private isDisposed = false;

  constructor(
    private parentContainer: Container,
    private seats: Map<PlayerID, SeatView>,
    private getViewerID: () => PlayerID,
  ) {}

  public dispose() {
    this.queue = [];
    this.isPlaying = false;
    this.isDisposed = true;
  }

  private get prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  public enqueue(events: PresentationEvent[]) {
    this.queue.push(...events);
    this.playNext();
  }

  private async playNext() {
    if (this.isDisposed || this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;

    const event = this.queue.shift()!;
    await this.playEvent(event);

    this.isPlaying = false;
    this.playNext();
  }

  private async playEvent(event: PresentationEvent) {
    if (this.prefersReducedMotion) return;
    // Basic switch for M3 implementations
    switch (event.kind) {
      case "card-committed":
        await this.playCardCommitted(event);
        break;
      case "hp-changed":
        await this.playHpChanged(event);
        break;
      case "target-outcome":
        await this.playTargetOutcome(event);
        break;
      case "skill-invoked":
        await this.playSkillInvoked(event);
        break;
      case "role-revealed":
        await this.playRoleRevealed(event);
        break;
      case "player-died":
        await this.playPlayerDied(event);
        break;
      case "match-ended":
        await this.playMatchEnded(event);
        break;
      default:
        // Other events can be instant for now
        await new Promise((r) => setTimeout(r, 100));
        break;
    }
  }

  private async playCardCommitted(event: any) {
    // Show a card flying to center
    const text = new Text({
      text: event.card.name || event.card.id || "Card",
      style: { fill: 0xffffff, fontSize: 24, fontFamily: GAME_FONT_FAMILY },
    });
    const seat = this.seats.get(event.actorID);
    if (seat) {
      text.position.copyFrom(seat.position);
    } else {
      text.position.set(500, 500); // Centerish fallback
    }

    this.parentContainer.addChild(text);

    await animate(
      text,
      {
        x: 600,
        y: 400,
        alpha: [1, 1, 0],
      },
      { duration: 1 },
    ).finished;

    await settle();

    text.destroy();
  }

  private async playHpChanged(event: any) {
    const diff = event.to - event.from;
    if (diff === 0) return;

    const text = new Text({
      text: diff > 0 ? `+${diff}` : `${diff}`,
      style: {
        fill: diff > 0 ? 0x00ff00 : 0xff0000,
        fontSize: 36,
        fontWeight: "bold",
        fontFamily: GAME_FONT_FAMILY,
      },
    });

    const seat = this.seats.get(event.targetID);
    if (seat) {
      text.position.set(seat.x, seat.y - 50);
    } else {
      text.position.set(500, 500);
    }

    this.parentContainer.addChild(text);

    await animate(
      text,
      {
        y: text.y - 100,
        alpha: [1, 0],
      },
      { duration: 0.8 },
    ).finished;

    await settle();

    text.destroy();
  }

  private async playTargetOutcome(event: any) {
    if (event.outcome !== "evaded" && event.outcome !== "prevented") return;

    const text = new Text({
      text: event.outcome === "evaded" ? "Tránh" : "Vô Hiệu",
      style: { fill: 0xcccccc, fontSize: 32, fontFamily: GAME_FONT_FAMILY },
    });

    const seat = this.seats.get(event.targetID);
    if (seat) {
      text.position.set(seat.x, seat.y);
    } else {
      text.position.set(500, 500);
    }

    this.parentContainer.addChild(text);

    await animate(
      text,
      {
        y: text.y - 50,
        alpha: [1, 0],
      },
      { duration: 0.8 },
    ).finished;

    await settle();

    text.destroy();
  }

  private async playSkillInvoked(event: any) {
    const text = new Text({
      text: event.skillID,
      style: { fill: 0xffd700, fontSize: 28, fontFamily: GAME_FONT_FAMILY },
    });

    const seat = this.seats.get(event.ownerID);
    if (seat) {
      text.position.set(seat.x, seat.y - 80);
    } else {
      text.position.set(500, 500);
    }

    this.parentContainer.addChild(text);

    await animate(
      text,
      {
        y: text.y - 50,
        alpha: [1, 0],
      },
      { duration: 1.2 },
    ).finished;

    await settle();

    text.destroy();
  }

  private async playRoleRevealed(event: any) {
    const seat = this.seats.get(event.playerID);
    if (!seat) return;

    // Simple glow effect for role reveal
    const glow = new Graphics()
      .circle(0, 0, 80)
      .fill({ color: 0xffd700, alpha: 0.5 });
    glow.position.copyFrom(seat.position);
    this.parentContainer.addChild(glow);

    await animate(
      glow,
      { alpha: [0.5, 0], scale: [1, 1.5] },
      { duration: 0.8 },
    );
    await settle();
    glow.destroy();
  }

  private async playPlayerDied(event: any) {
    const seat = this.seats.get(event.playerID);
    if (!seat) return;

    const text = new Text({
      text: "Tử Trận",
      style: { fill: 0xff0000, fontSize: 40, fontWeight: "bold" },
    });
    text.anchor.set(0.5);
    text.position.copyFrom(seat.position);
    this.parentContainer.addChild(text);

    await animate(
      text,
      { scale: [3, 1], alpha: [0, 1] },
      { duration: 0.5, ease: "easeOut" },
    );
    await new Promise((r) => setTimeout(r, 1000));
    await animate(text, { alpha: [1, 0] }, { duration: 0.5 });
    await settle();
    text.destroy();
  }

  private async playMatchEnded(event: any) {
    const overlay = new Graphics()
      .rect(0, 0, 3000, 3000)
      .fill({ color: 0x000000, alpha: 0.5 });
    this.parentContainer.addChild(overlay);
    await animate(overlay, { alpha: [0, 0.5] }, { duration: 0.5 });
    await new Promise((r) => setTimeout(r, 1000));
    await settle();
    overlay.destroy();
  }
}
