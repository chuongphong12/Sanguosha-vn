import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Assets } from "pixi.js";

import type { CardName, PhysicalCard, Suit } from "../../game/model";
import { CARD_DEFINITIONS } from "../../game/catalog/cards";
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

    // --- Card illustration (attempt to load from assets) ---
    const cardTexture = this.resolveTexture(card.definitionID);
    if (cardTexture) {
      const illustration = new Sprite(cardTexture);
      // Fill the card area, leaving space for suit/rank overlay
      illustration.width = w - 8;
      illustration.height = h - 36;
      illustration.position.set(4, 28);
      illustration.alpha = disabled ? 0.4 : 0.85;
      this.addChild(illustration);
    }

    // --- Suit symbol ---
    const suitColor = isRed ? 0xcc2222 : 0x111111;
    const suitText = new Text({
      text: SUIT_SYMBOLS[card.suit],
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 16,
        fill: selected ? 0xffffff : suitColor,
        fontWeight: "bold",
      },
    });
    suitText.position.set(6, 4);
    this.addChild(suitText);

    // --- Rank ---
    const rankText = new Text({
      text: card.rank,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 12,
        fill: selected ? 0xffffff : suitColor,
        fontWeight: "bold",
      },
    });
    rankText.position.set(22, 6);
    this.addChild(rankText);

    // --- Card name label at the bottom ---
    const nameText = new Text({
      text: `【${definition.name}】`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 10,
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

    // --- Interaction ---
    if (options?.onTap && !disabled) {
      this.eventMode = "static";
      this.cursor = "pointer";
      this.on("pointertap", options.onTap);
    }
  }

  private resolveTexture(definitionID: CardName): Texture | null {
    // Try multiple alias patterns used by assetpack
    for (const alias of [
      `main/cards/card/${definitionID}.png`,
      `main/cards/card/${definitionID}.jpg`,
      `${definitionID}.png`,
    ]) {
      const tex = Assets.get<Texture>(alias);
      if (tex) return tex;
    }
    return null;
  }
}
