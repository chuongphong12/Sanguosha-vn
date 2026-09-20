import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Assets } from "pixi.js";

import type { Faction, PlayerViewPlayer } from "../../game/model";
import { GENERALS_BY_ID } from "../../game/catalog/generals";
import { FACTION_ICON_ALIAS, GENERAL_PORTRAIT_ALIAS } from "./assetAliases";
import { GAME_FONT_FAMILY } from "./typography";

import { THEME } from "./theme";

const AVATAR_WIDTH = 120;
const AVATAR_HEIGHT = 140;

export class PlayerAvatar extends Container {
  private bg = new Graphics();
  private portrait = new Sprite();
  private placeholder = new Container();
  private deathOverlay = new Container();
  private hpContainer = new Container();
  private nameText = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 11,
      fill: 0xf3e5c8,
      fontWeight: "bold",
    },
  });
  private factionIcon = new Sprite();
  private factionDot = new Graphics();

  private w: number;
  private h: number;
  private portraitH: number;
  private onTap?: () => void;

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

    this.w = options?.width ?? AVATAR_WIDTH;
    this.h = options?.height ?? AVATAR_HEIGHT;
    this.portraitH = this.h - 38;
    this.onTap = options?.onTap;

    this.addChild(
      this.bg,
      this.portrait,
      this.placeholder,
      this.deathOverlay,
      this.hpContainer,
      this.nameText,
      this.factionIcon,
      this.factionDot,
    );

    this.setupDeathOverlay();

    this.nameText.anchor.set(0.5, 0);
    this.nameText.position.set(this.w / 2, this.h - 16);

    this.factionIcon.width = 20;
    this.factionIcon.height = 20;
    this.factionIcon.position.set(this.w - 24, 6);

    this.sync(player, options);
  }

  public sync(
    player: PlayerViewPlayer,
    options?: {
      isActiveActor?: boolean;
      isSelected?: boolean;
      onTap?: () => void;
    },
  ): void {
    if (options && "onTap" in options) {
      this.onTap = options.onTap;
    }

    this.removeAllListeners("pointertap");
    if (this.onTap) {
      this.eventMode = "static";
      this.cursor = "pointer";
      this.on("pointertap", this.onTap);
    } else {
      this.eventMode = "none";
      this.cursor = "auto";
    }

    const isActive = options?.isActiveActor ?? false;
    const isSelected = options?.isSelected ?? false;
    const general = player.generalID ? GENERALS_BY_ID[player.generalID] : null;
    const faction = general?.faction ?? null;

    // Background
    const borderColor = isSelected
      ? 0xb93730
      : isActive
        ? 0xc59a45
        : faction
          ? THEME.colors.factions[faction]
          : 0x555555;

    this.bg
      .clear()
      .roundRect(0, 0, this.w, this.h, 6)
      .fill({ color: 0x1a1510, alpha: 0.95 })
      .stroke({ color: borderColor, width: isSelected ? 3 : 2, alpha: 0.95 });

    // Portrait
    this.portrait.visible = false;
    this.placeholder.visible = false;
    this.placeholder.removeChildren();

    if (general) {
      const tex = this.resolvePortrait(general.id);
      if (tex) {
        this.portrait.texture = tex;
        this.portrait.width = this.w - 8;
        this.portrait.height = this.portraitH;
        this.portrait.position.set(4, 4);
        this.portrait.alpha = player.alive ? 1.0 : 0.35;
        this.portrait.visible = true;
      } else {
        this.drawPlaceholder(general.chineseName);
        this.placeholder.visible = true;
      }
    } else {
      this.drawPlaceholder("?");
      this.placeholder.visible = true;
    }

    // Death overlay
    this.deathOverlay.visible = !player.alive;

    // HP Bar
    this.drawHPBar(player.hp, player.maxHP, 4, this.h - 32, this.w - 8);

    // Name label
    this.nameText.text = general?.name ?? `P\${player.seat + 1}`;
    this.nameText.scale.set(1);
    if (this.nameText.width > this.w - 12) {
      this.nameText.scale.set((this.w - 12) / this.nameText.width);
    }

    // Faction
    this.factionIcon.visible = false;
    this.factionDot.visible = false;
    this.factionDot.clear();

    if (faction) {
      const factionTex = this.resolveFactionIcon(faction);
      if (factionTex) {
        this.factionIcon.texture = factionTex;
        this.factionIcon.visible = true;
      } else {
        this.factionDot
          .circle(this.w - 14, 16, 8)
          .fill(THEME.colors.factions[faction]);
        this.factionDot.visible = true;
      }
    }
  }

  private setupDeathOverlay() {
    const bg = new Graphics()
      .roundRect(0, 0, this.w, this.h, 6)
      .fill({ color: 0x000000, alpha: 0.5 });

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
    deathText.position.set(this.w / 2, this.portraitH / 2 + 4);

    this.deathOverlay.addChild(bg, deathText);
  }

  private drawPlaceholder(label: string): void {
    const bg = new Graphics()
      .rect(4, 4, this.w - 8, this.portraitH)
      .fill(0x2a2520);
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
    text.position.set(this.w / 2, this.portraitH / 2 + 4);
    this.placeholder.addChild(bg, text);
  }

  private drawHPBar(
    hp: number,
    maxHP: number,
    x: number,
    y: number,
    totalWidth: number,
  ): void {
    this.hpContainer.removeChildren();

    const gap = 2;
    const dotSize = Math.min(12, (totalWidth - gap * (maxHP - 1)) / maxHP);

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
        ? `main/ui/system/magatamas/\${colorSuffix}.png`
        : `main/ui/system/magatamas/0.png`;
      let tex: Texture | undefined;
      try {
        tex = Assets.get<Texture>(textureAlias);
      } catch (e) {
        /* ignore */
      }

      if (tex) {
        const magatama = new Sprite(tex);
        magatama.width = dotSize;
        magatama.height = dotSize;
        magatama.position.set(x + i * (dotSize + gap), y);
        this.hpContainer.addChild(magatama);
      } else {
        const fallbackColor =
          colorSuffix === "1"
            ? 0x2aaa44
            : colorSuffix === "2"
              ? 0xddaa22
              : 0xcc3322;
        const dot = new Graphics()
          .roundRect(x + i * (dotSize + gap), y, dotSize, dotSize, 3)
          .fill(filled ? fallbackColor : 0x333333);
        this.hpContainer.addChild(dot);
      }
    }
  }

  private resolvePortrait(generalID: string): Texture | null {
    const alias = GENERAL_PORTRAIT_ALIAS[generalID];
    if (alias) {
      try {
        return Assets.get<Texture>(alias) ?? null;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  private resolveFactionIcon(faction: Faction): Texture | null {
    try {
      return Assets.get<Texture>(FACTION_ICON_ALIAS[faction]) ?? null;
    } catch (e) {
      /* ignore */
    }
    return null;
  }
}
