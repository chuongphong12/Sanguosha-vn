import { Container, Graphics, Sprite, Assets, Texture } from "pixi.js";
import { GENERALS_BY_ID } from "../../../game/catalog/generals";
import { GENERAL_CARD_ALIAS } from "../assetAliases";
import { THEME } from "../theme";

export interface GeneralCardOptions {
  width?: number;
  height?: number;
  isSelected?: boolean;
  onTap?: () => void;
}

export class GeneralCardView extends Container {
  constructor(generalID: string, options?: GeneralCardOptions) {
    super();

    const w = options?.width ?? 140;
    const h = options?.height ?? 196;
    const isSelected = options?.isSelected ?? false;
    const general = GENERALS_BY_ID[generalID];

    // --- Portrait (Full Card) ---
    if (general) {
      const tex = this.resolveCard(general.id);
      if (tex) {
        const cardSprite = new Sprite(tex);
        cardSprite.width = w;
        cardSprite.height = h;
        
        // Slightly round the corners of the card itself if needed
        const mask = new Graphics()
          .roundRect(0, 0, w, h, THEME.radius.sm)
          .fill(0xffffff);
        cardSprite.mask = mask;
        
        this.addChild(cardSprite);
        this.addChild(mask);
      } else {
        // Fallback if full card is missing
        const bg = new Graphics()
          .roundRect(0, 0, w, h, THEME.radius.sm)
          .fill({ color: THEME.colors.panelBg, alpha: 1 });
        this.addChild(bg);
      }
    }

    // --- Glow/Border Effect ---
    if (isSelected) {
      const glow = new Graphics()
        .roundRect(-4, -4, w + 8, h + 8, THEME.radius.sm + 2)
        .stroke({ color: THEME.colors.highlightGlow, width: 4, alpha: 0.8 });
      this.addChild(glow);
      
      const border = new Graphics()
        .roundRect(0, 0, w, h, THEME.radius.sm)
        .stroke({ color: THEME.colors.highlightStroke, width: 3, alpha: 1 });
      this.addChild(border);
    } else {
      const border = new Graphics()
        .roundRect(0, 0, w, h, THEME.radius.sm)
        .stroke({ color: 0x333333, width: 2, alpha: 0.8 }); // Subtle border for non-selected
      this.addChild(border);
    }

    this.eventMode = "static";
    this.cursor = "pointer";
    if (options?.onTap) {
      this.on("pointertap", options.onTap);
    }
  }

  private resolveCard(id: string): Texture | null {
    const alias = GENERAL_CARD_ALIAS[id];
    if (alias) {
      const t = Assets.get<Texture>(alias);
      if (t) return t;
    }
    return null;
  }
}

