import type { DestroyOptions } from "pixi.js";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Assets } from "pixi.js";

import type { CardName, PhysicalCard, Suit } from "../../game/model";
import { CARD_DEFINITIONS } from "../../game/catalog/cards";
import { CARD_ART_ALIAS, EQUIP_ART_ALIAS } from "./assetAliases";
import { GAME_FONT_FAMILY } from "./typography";

const SUIT_SYMBOLS: Record<Suit, string> = {
  heart: "♥",
  diamond: "♦",
  spade: "♠",
  club: "♣",
};

const CARD_WIDTH = 93;
const CARD_HEIGHT = 130;

export class CardView extends Container {
  private bg = new Graphics();
  private face = new Sprite();
  private metadataBacking = new Graphics();
  private metadataText = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontWeight: "bold",
    },
  });
  private nameBacking = new Graphics();
  private nameText = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      align: "center",
    },
  });
  private disabledOverlay = new Graphics();
  private selectionOutline = new Graphics();

  private w: number;
  private h: number;
  private destroying = false;
  private onTap?: () => void;

  constructor(
    card: PhysicalCard,
    options?: {
      selected?: boolean;
      disabled?: boolean;
      width?: number;
      height?: number;
      onTap?: () => void;
    },
  ) {
    super();

    this.w = options?.width ?? CARD_WIDTH;
    this.h = options?.height ?? CARD_HEIGHT;
    this.onTap = options?.onTap;

    this.addChild(
      this.bg,
      this.face,
      this.metadataBacking,
      this.metadataText,
      this.nameBacking,
      this.nameText,
      this.disabledOverlay,
      this.selectionOutline,
    );

    this.metadataText.position.set(6, 5);
    this.nameText.anchor.set(0.5, 1);
    this.nameText.position.set(this.w / 2, this.h - 4);

    this.sync(card, options);
  }

  /** True once destruction has started (it completes a couple of frames later). */
  public get isDestroying(): boolean {
    return this.destroying || this.destroyed;
  }

  /**
   * motion writes a tween's final frame to its target on the next render, so a
   * card destroyed mid-hover would be written to after it was destroyed.
   * Detach immediately, free the object once that frame has passed.
   */
  public override destroy(options?: DestroyOptions): void {
    if (this.destroying || this.destroyed) return;
    this.destroying = true;
    this.removeFromParent();
    this.visible = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => super.destroy(options)),
    );
  }

  public sync(
    card: PhysicalCard,
    options?: {
      selected?: boolean;
      disabled?: boolean;
      onTap?: () => void;
    },
  ): void {
    if (options && "onTap" in options) {
      this.onTap = options.onTap;
    }

    const selected = options?.selected ?? false;
    const disabled = options?.disabled ?? false;
    const definition = CARD_DEFINITIONS[card.definitionID];
    const isRed = card.suit === "heart" || card.suit === "diamond";

    this.removeAllListeners("pointertap");
    // Event mode
    if (!disabled && this.onTap) {
      this.eventMode = "static";
      this.cursor = "pointer";
      this.on("pointertap", this.onTap);
    } else {
      this.eventMode = "none";
      this.cursor = "auto";
    }

    // Background
    this.bg
      .clear()
      .roundRect(0, 0, this.w, this.h, 6)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.96 })
      .stroke({
        color: selected ? 0xb93730 : 0xc59a45,
        width: selected ? 2 : 1,
        alpha: 0.9,
      });

    // Face
    const cardTexture = this.resolveTexture(card.definitionID);
    this.face.visible = false;
    if (cardTexture) {
      this.face.texture = cardTexture;
      this.face.width = this.w - 8;
      this.face.height = this.h - 8;
      this.face.position.set(4, 4);
      this.face.alpha = disabled ? 0.4 : 1;
      this.face.visible = true;
    }

    // Metadata
    const suitColor = isRed ? 0xcc2222 : 0x111111;
    this.metadataBacking
      .clear()
      .roundRect(3, 3, Math.min(this.w - 6, 36), Math.min(20, this.h * 0.2), 4)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.92 });

    this.metadataText.text = `${SUIT_SYMBOLS[card.suit]} ${card.rank}`;
    this.metadataText.style.fontSize = Math.max(7, Math.min(11, this.h / 9));
    this.metadataText.style.fill = selected ? 0xffffff : suitColor;

    this.metadataText.scale.set(1);
    if (this.metadataText.width > this.w - 12) {
      this.metadataText.scale.set((this.w - 12) / this.metadataText.width);
    }

    // Name
    const nameBarHeight = Math.min(20, Math.max(14, this.h * 0.18));
    this.nameBacking
      .clear()
      .roundRect(3, this.h - nameBarHeight - 3, this.w - 6, nameBarHeight, 4)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.92 });

    this.nameText.text = `【${definition.name}】`;
    this.nameText.style.fontSize = Math.max(7, Math.min(10, this.h / 10));
    this.nameText.style.fill = selected ? 0xffffff : 0x201812;

    this.nameText.scale.set(1);
    if (this.nameText.width > this.w - 12) {
      this.nameText.scale.set((this.w - 12) / this.nameText.width);
    }

    // Disabled overlay
    this.disabledOverlay.visible = disabled;
    if (disabled) {
      this.disabledOverlay
        .clear()
        .roundRect(0, 0, this.w, this.h, 6)
        .fill({ color: 0x000000, alpha: 0.45 });
    }

    // Selection outline
    this.selectionOutline.visible = selected;
    if (selected) {
      this.selectionOutline
        .clear()
        .roundRect(1, 1, this.w - 2, this.h - 2, 6)
        .stroke({ color: 0xb93730, width: 3 });
    }
  }

  private resolveTexture(definitionID: CardName): Texture | null {
    const alias = CARD_ART_ALIAS[definitionID] ?? EQUIP_ART_ALIAS[definitionID];
    if (alias) {
      try {
        return Assets.get<Texture>(alias) ?? null;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}
