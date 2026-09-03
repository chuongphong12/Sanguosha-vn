import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Assets } from "pixi.js";

import type { Faction, PlayerViewPlayer } from "../../game/model";
import { GENERALS_BY_ID } from "../../game/catalog/generals";
import { GAME_FONT_FAMILY } from "./typography";

const FACTION_COLORS: Record<Faction, number> = {
  wei: 0x1a5fa8,
  shu: 0xb33a2a,
  wu: 0x2a8a3e,
  qun: 0x8a8a3e,
};

const AVATAR_WIDTH = 120;
const AVATAR_HEIGHT = 140;

/**
 * PlayerAvatar — Renders a general's portrait with faction border,
 * HP bar, and general name label.
 *
 * Uses synchronous Assets.get() for compatibility with MainScreen's
 * immediate-mode redraw cycle.
 */
export class PlayerAvatar extends Container {
  constructor(
    player: PlayerViewPlayer,
    options?: {
      width?: number;
      height?: number;
      isActiveActor?: boolean;
      isSelected?: boolean;
      onTap?: () => void;
    },
  ) {
    super();

    const w = options?.width ?? AVATAR_WIDTH;
    const h = options?.height ?? AVATAR_HEIGHT;
    const isActive = options?.isActiveActor ?? false;
    const isSelected = options?.isSelected ?? false;
    const general = player.generalID ? GENERALS_BY_ID[player.generalID] : null;
    const faction = general?.faction ?? null;

    // --- Background frame ---
    const borderColor = isSelected
      ? 0xb93730
      : isActive
        ? 0xc59a45
        : faction
          ? FACTION_COLORS[faction]
          : 0x555555;
    const bg = new Graphics()
      .roundRect(0, 0, w, h, 6)
      .fill({ color: 0x1a1510, alpha: 0.95 })
      .stroke({ color: borderColor, width: isSelected ? 3 : 2, alpha: 0.95 });
    this.addChild(bg);

    // --- Portrait image ---
    const portraitH = h - 38;
    if (general) {
      const tex = this.resolvePortrait(general.id);
      if (tex) {
        const portrait = new Sprite(tex);
        portrait.width = w - 8;
        portrait.height = portraitH;
        portrait.position.set(4, 4);
        if (!player.alive) portrait.alpha = 0.35;
        this.addChild(portrait);
      } else {
        this.drawPlaceholder(w, portraitH, general.chineseName);
      }
    } else {
      this.drawPlaceholder(w, portraitH, "?");
    }

    // --- Death overlay ---
    if (!player.alive) {
      const deathOverlay = new Graphics()
        .roundRect(0, 0, w, h, 6)
        .fill({ color: 0x000000, alpha: 0.5 });
      this.addChild(deathOverlay);

      const deathText = new Text({
        text: "阵亡",
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 22,
          fill: 0xb93730,
          fontWeight: "bold",
        },
      });
      deathText.anchor.set(0.5);
      deathText.position.set(w / 2, portraitH / 2 + 4);
      this.addChild(deathText);
    }

    // --- HP bar ---
    const hpBarY = h - 32;
    this.drawHPBar(player.hp, player.maxHP, 4, hpBarY, w - 8);

    // --- Name label ---
    const nameLabel = general?.name ?? `P${player.seat + 1}`;
    const nameText = new Text({
      text: nameLabel,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 11,
        fill: 0xf3e5c8,
        fontWeight: "bold",
      },
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(w / 2, h - 16);
    if (nameText.width > w - 12) {
      nameText.scale.set((w - 12) / nameText.width);
    }
    this.addChild(nameText);

    // --- Faction icon (small badge) ---
    if (faction) {
      const factionTex = this.resolveFactionIcon(faction);
      if (factionTex) {
        const factionIcon = new Sprite(factionTex);
        factionIcon.width = 20;
        factionIcon.height = 20;
        factionIcon.position.set(w - 24, 6);
        this.addChild(factionIcon);
      } else {
        // Fallback: small colored circle
        const dot = new Graphics()
          .circle(w - 14, 16, 8)
          .fill(FACTION_COLORS[faction]);
        this.addChild(dot);
      }
    }

    // --- Interaction ---
    if (options?.onTap) {
      this.eventMode = "static";
      this.cursor = "pointer";
      this.on("pointertap", options.onTap);
    }
  }

  private drawPlaceholder(w: number, h: number, label: string): void {
    const placeholder = new Graphics().rect(4, 4, w - 8, h).fill(0x2a2520);
    this.addChild(placeholder);

    const text = new Text({
      text: label,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 32,
        fill: 0x555555,
        fontWeight: "bold",
      },
    });
    text.anchor.set(0.5);
    text.position.set(w / 2, h / 2 + 4);
    this.addChild(text);
  }

  private drawHPBar(
    hp: number,
    maxHP: number,
    x: number,
    y: number,
    totalWidth: number,
  ): void {
    const gap = 2;
    const dotSize = Math.min(12, (totalWidth - gap * (maxHP - 1)) / maxHP);

    // Determine HP color based on ratio
    const ratio = hp / maxHP;
    const hpColor =
      ratio > 0.66 ? 0x2aaa44 : ratio > 0.33 ? 0xddaa22 : 0xcc3322;

    for (let i = 0; i < maxHP; i++) {
      const filled = i < hp;
      const dot = new Graphics()
        .roundRect(x + i * (dotSize + gap), y, dotSize, dotSize, 3)
        .fill(filled ? hpColor : 0x333333);
      this.addChild(dot);
    }
  }

  private resolvePortrait(generalID: string): Texture | null {
    for (const alias of [
      `main/generals/avatar/${generalID}.jpg`,
      `main/generals/avatar/${generalID}.png`,
      `main/generals/${generalID}.jpg`,
      `${generalID}.jpg`,
    ]) {
      const tex = Assets.get<Texture>(alias);
      if (tex) return tex;
    }
    return null;
  }

  private resolveFactionIcon(faction: Faction): Texture | null {
    for (const alias of [
      `main/ui/kingdom/${faction}.png`,
      `main/ui/kingdom/${faction}.jpg`,
    ]) {
      const tex = Assets.get<Texture>(alias);
      if (tex) return tex;
    }
    return null;
  }
}
