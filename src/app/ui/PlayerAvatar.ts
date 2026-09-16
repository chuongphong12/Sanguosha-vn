import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Assets } from "pixi.js";

import type { Faction, PlayerViewPlayer } from "../../game/model";
import { GENERALS_BY_ID } from "../../game/catalog/generals";
import { FACTION_ICON_ALIAS, GENERAL_PORTRAIT_ALIAS } from "./assetAliases";
import { GAME_FONT_FAMILY } from "./typography";

import { THEME } from "./theme";

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
          ? THEME.colors.factions[faction]
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
          .fill(THEME.colors.factions[faction]);
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

    // 5 = green (hp >= max), 4 = green (ratio > 0.5), 3 = yellow, 2 = red, 1 = red, 0 = empty
    let colorSuffix = "0";
    if (hp > 0) {
      const ratio = hp / maxHP;
      if (ratio > 0.5) colorSuffix = "1";
      else if (ratio > 0.25) colorSuffix = "2";
      else colorSuffix = "3";
    }

    for (let i = 0; i < maxHP; i++) {
      const filled = i < hp;
      const textureAlias = filled
        ? `main/ui/system/magatamas/${colorSuffix}.png`
        : `main/ui/system/magatamas/0.png`;
      let tex: Texture | undefined;
      try {
        tex = Assets.get<Texture>(textureAlias);
      } catch (e) {}
      if (tex) {
        const magatama = new Sprite(tex);
        magatama.width = dotSize;
        magatama.height = dotSize;
        magatama.position.set(x + i * (dotSize + gap), y);
        this.addChild(magatama);
      } else {
        // Fallback to simple graphics if texture is missing
        const fallbackColor =
          colorSuffix === "1"
            ? 0x2aaa44
            : colorSuffix === "2"
              ? 0xddaa22
              : 0xcc3322;
        const dot = new Graphics()
          .roundRect(x + i * (dotSize + gap), y, dotSize, dotSize, 3)
          .fill(filled ? fallbackColor : 0x333333);
        this.addChild(dot);
      }
    }
  }

  private resolvePortrait(generalID: string): Texture | null {
    const alias = GENERAL_PORTRAIT_ALIAS[generalID];
    if (alias) {
      try {
        return Assets.get<Texture>(alias) ?? null;
      } catch (e) {}
    }
    return null;
  }

  private resolveFactionIcon(faction: Faction): Texture | null {
    try {
      return Assets.get<Texture>(FACTION_ICON_ALIAS[faction]) ?? null;
    } catch (e) {}
    return null;
  }
}
