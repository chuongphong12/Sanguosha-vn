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

/**
 * CardView — A visual card component that renders a physical card
 * with its illustration, suit symbol, rank, and card name.
 *
 * Uses synchronous Assets.get() to stay compatible with MainScreen's
 * immediate-mode redraw cycle.
 */
export class CardView extends Container {
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

    const w = options?.width ?? CARD_WIDTH;
    const h = options?.height ?? CARD_HEIGHT;
    const selected = options?.selected ?? false;
    const disabled = options?.disabled ?? false;
    const definition = CARD_DEFINITIONS[card.definitionID];
    const isRed = card.suit === "heart" || card.suit === "diamond";

    // --- Background ---
    const bg = new Graphics()
      .roundRect(0, 0, w, h, 6)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.96 })
      .stroke({
        color: selected ? 0xb93730 : 0xc59a45,
        width: selected ? 2 : 1,
        alpha: 0.9,
      });
    this.addChild(bg);

    // --- Full card face ---
    const cardTexture = this.resolveTexture(card.definitionID);
    if (cardTexture) {
      const face = new Sprite(cardTexture);
      face.width = w - 8;
      face.height = h - 8;
      face.position.set(4, 4);
      face.alpha = disabled ? 0.4 : 1;
      this.addChild(face);
    }

    // Artwork is shared by card definition, so physical suit/rank stays dynamic.
    const suitColor = isRed ? 0xcc2222 : 0x111111;
    const metadataBacking = new Graphics()
      .roundRect(3, 3, Math.min(w - 6, 36), Math.min(20, h * 0.2), 4)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.92 });
    this.addChild(metadataBacking);
    const metadataText = new Text({
      text: `${SUIT_SYMBOLS[card.suit]} ${card.rank}`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: Math.max(7, Math.min(11, h / 9)),
        fill: selected ? 0xffffff : suitColor,
        fontWeight: "bold",
      },
    });
    metadataText.position.set(6, 5);
    if (metadataText.width > w - 12)
      metadataText.scale.set((w - 12) / metadataText.width);
    this.addChild(metadataText);

    // --- Vietnamese card name overlay ---
    const nameBarHeight = Math.min(20, Math.max(14, h * 0.18));
    const nameBacking = new Graphics()
      .roundRect(3, h - nameBarHeight - 3, w - 6, nameBarHeight, 4)
      .fill({ color: selected ? 0x8f1d20 : 0xf3e5c8, alpha: 0.92 });
    this.addChild(nameBacking);

    const nameText = new Text({
      text: `【${definition.name}】`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: Math.max(7, Math.min(10, h / 10)),
        fill: selected ? 0xffffff : 0x201812,
        align: "center",
      },
    });
    nameText.anchor.set(0.5, 1);
    nameText.position.set(w / 2, h - 4);
    if (nameText.width > w - 12) {
      nameText.scale.set((w - 12) / nameText.width);
    }
    this.addChild(nameText);

    // --- Disabled overlay ---
    if (disabled) {
      const overlay = new Graphics()
        .roundRect(0, 0, w, h, 6)
        .fill({ color: 0x000000, alpha: 0.45 });
      this.addChild(overlay);
    }

    if (selected) {
      const selectionOutline = new Graphics()
        .roundRect(1, 1, w - 2, h - 2, 6)
        .stroke({ color: 0xb93730, width: 3 });
      this.addChild(selectionOutline);
    }

    // --- Interaction ---
    if (options?.onTap && !disabled) {
      this.eventMode = "static";
      this.cursor = "pointer";
      this.on("pointertap", options.onTap);
    }
  }

  private resolveTexture(definitionID: CardName): Texture | null {
    const alias = CARD_ART_ALIAS[definitionID] ?? EQUIP_ART_ALIAS[definitionID];
    return alias ? (Assets.get<Texture>(alias) ?? null) : null;
  }
}
