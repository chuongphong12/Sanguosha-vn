import { Container, Text, Sprite, Assets } from "pixi.js";
import { animate } from "motion";
import type { PresentationEvent } from "../../../game/types/presentation";
import type { PlayerID, TqsPlayerViewState } from "../../../game/model";
import { SeatView } from "../../ui/SeatView";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import { THEME } from "../../ui/theme";

export class AnimationManager {
  private queue: PresentationEvent[] = [];
  private isPlaying = false;
  
  constructor(
    private parentContainer: Container,
    private seats: Map<PlayerID, SeatView>,
    private getViewerID: () => PlayerID
  ) {}

  public enqueue(events: PresentationEvent[]) {
    this.queue.push(...events);
    this.playNext();
  }

  private async playNext() {
    if (this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;

    const event = this.queue.shift()!;
    await this.playEvent(event);

    this.isPlaying = false;
    this.playNext();
  }

  private async playEvent(event: PresentationEvent) {
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
      default:
        // Other events can be instant for now
        await new Promise(r => setTimeout(r, 100));
        break;
    }
  }

  private async playCardCommitted(event: any) {
    // Show a card flying to center
    const text = new Text({
      text: event.card.name || event.card.id || "Card",
      style: { fill: 0xffffff, fontSize: 24, fontFamily: GAME_FONT_FAMILY }
    });
    const seat = this.seats.get(event.actorID);
    if (seat) {
      text.position.copyFrom(seat.position);
    } else {
      text.position.set(500, 500); // Centerish fallback
    }
    
    this.parentContainer.addChild(text);
    
    await animate(text, { 
      x: 600, 
      y: 400, 
      alpha: [1, 1, 0] 
    }, { duration: 1 }).finished;

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
        fontFamily: GAME_FONT_FAMILY 
      }
    });

    const seat = this.seats.get(event.targetID);
    if (seat) {
      text.position.set(seat.x, seat.y - 50);
    } else {
      text.position.set(500, 500);
    }
    
    this.parentContainer.addChild(text);
    
    await animate(text, { 
      y: text.y - 100, 
      alpha: [1, 0] 
    }, { duration: 0.8 }).finished;

    text.destroy();
  }

  private async playTargetOutcome(event: any) {
    if (event.outcome !== "evaded" && event.outcome !== "prevented") return;

    const text = new Text({
      text: event.outcome === "evaded" ? "Tránh" : "Vô Hiệu",
      style: { fill: 0xcccccc, fontSize: 32, fontFamily: GAME_FONT_FAMILY }
    });

    const seat = this.seats.get(event.targetID);
    if (seat) {
      text.position.set(seat.x, seat.y);
    } else {
      text.position.set(500, 500);
    }
    
    this.parentContainer.addChild(text);
    
    await animate(text, { 
      y: text.y - 50, 
      alpha: [1, 0] 
    }, { duration: 0.8 }).finished;

    text.destroy();
  }

  private async playSkillInvoked(event: any) {
    const text = new Text({
      text: event.skillID, 
      style: { fill: 0xffd700, fontSize: 28, fontFamily: GAME_FONT_FAMILY }
    });

    const seat = this.seats.get(event.ownerID);
    if (seat) {
      text.position.set(seat.x, seat.y - 80);
    } else {
      text.position.set(500, 500);
    }
    
    this.parentContainer.addChild(text);
    
    await animate(text, { 
      y: text.y - 50, 
      alpha: [1, 0] 
    }, { duration: 1.2 }).finished;

    text.destroy();
  }
}
