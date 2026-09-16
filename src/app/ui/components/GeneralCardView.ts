import { Container, Graphics, Sprite, Assets, Texture, Text } from "pixi.js";
import { GENERALS_BY_ID, SKILLS } from "../../../game/catalog/generals";
import { GENERAL_CARD_ALIAS } from "../assetAliases";
import { GAME_FONT_FAMILY } from "../typography";

export interface GeneralCardOptions {
  width?: number;
  height?: number;
  onConfirm?: () => void;
}

export class GeneralCardView extends Container {
  constructor(generalID: string, options?: GeneralCardOptions) {
    super();

    const targetW = options?.width ?? 280;
    
    // Always build the UI at base dimensions
    const w = 280;
    const h = 560;
    const general = GENERALS_BY_ID[generalID];

    const innerContainer = new Container();
    this.addChild(innerContainer);

    // Background Panel
    const bg = new Graphics()
      .roundRect(0, 0, w, h, 8)
      .fill({ color: 0x161a22 })
      .stroke({ color: 0xaa801a, width: 1, alpha: 0.5 });
    innerContainer.addChild(bg);

    // Confirm Button inside the card (pre-calculate so we know how much space we have)
    const btnW = w - 32;
    const btnH = 40;
    const btnY = h - btnH - 16;

    if (general) {
      const tex = this.resolveCard(general.id);
      const imgHeight = 220;

      if (tex) {
        const cardSprite = new Sprite(tex);
        const scale = w / tex.width;
        cardSprite.scale.set(scale);
        
        const cardMask = new Graphics()
          .roundRect(0, 0, w, imgHeight, 8)
          .fill(0xffffff);
        cardSprite.mask = cardMask;

        innerContainer.addChild(cardSprite);
        innerContainer.addChild(cardMask);
      } else {
        const placeholder = new Graphics()
          .roundRect(0, 0, w, imgHeight, 8)
          .fill({ color: 0x333333 });
        innerContainer.addChild(placeholder);
      }

      // Name (faux calligraphy using italic Noto Serif)
      const nameText = new Text({
        text: general.name,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 32,
          fill: 0xf3e5c8,
          fontStyle: "italic",
          fontWeight: "bold",
        }
      });
      nameText.anchor.set(0.5, 0);
      nameText.position.set(w / 2, imgHeight + 12);
      innerContainer.addChild(nameText);

      // Faction / HP
      const factionNames: Record<string, string> = {
        wei: "NGỤY",
        shu: "THỤC",
        wu: "NGÔ",
        qun: "QUẦN"
      };
      const factionName = factionNames[general.faction] ?? "VÔ";
      const statsText = new Text({
        text: `${factionName} · ${general.maxHP} MÁU`,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 12,
          fill: 0x8b8c88,
          letterSpacing: 1
        }
      });
      statsText.anchor.set(0.5, 0);
      statsText.position.set(w / 2, imgHeight + 52);
      innerContainer.addChild(statsText);

      // Skills
      const skillsStartY = imgHeight + 84;
      const skillsContainer = new Container();
      skillsContainer.position.set(16, skillsStartY);
      let currentY = 0;

      general.skillIDs.forEach(skillID => {
        const skill = SKILLS[skillID];
        if (!skill) return;

        const title = new Text({
          text: `◆ ${skill.name}`,
          style: {
            fontFamily: GAME_FONT_FAMILY,
            fontSize: 12,
            fill: 0xaa801a,
            fontWeight: "bold"
          }
        });
        title.position.set(0, currentY);
        skillsContainer.addChild(title);

        const desc = new Text({
          text: skill.description || "",
          style: {
            fontFamily: GAME_FONT_FAMILY,
            fontSize: 11,
            fill: 0x8b8c88,
            wordWrap: true,
            wordWrapWidth: w - 32,
            lineHeight: 16,
          }
        });
        desc.position.set(0, currentY + 16);
        skillsContainer.addChild(desc);
        
        currentY += 16 + desc.height + 8;
      });

      // Auto-scale text if it exceeds the available space
      const availableHeight = btnY - skillsStartY - 8;
      if (skillsContainer.height > availableHeight) {
        skillsContainer.scale.set(availableHeight / skillsContainer.height);
      }

      innerContainer.addChild(skillsContainer);
    }

    // Confirm Button inside the card
    const btn = new Graphics()
      .rect(16, btnY, btnW, btnH)
      .fill({ color: 0x000000, alpha: 0.5 })
      .stroke({ color: 0xaa801a, width: 1, alpha: 0.8 });
    
    const btnText = new Text({
      text: "CHỌN TƯỚNG NÀY",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 14,
        fill: 0xaa801a,
        fontWeight: "bold"
      }
    });
    btnText.anchor.set(0.5);
    btnText.position.set(16 + btnW / 2, btnY + btnH / 2);
    
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerover", () => {
      btn.clear()
        .rect(16, btnY, btnW, btnH)
        .fill({ color: 0xaa801a, alpha: 0.2 })
        .stroke({ color: 0xaa801a, width: 1, alpha: 1 });
      btnText.style.fill = 0xffffff;
    });
    btn.on("pointerout", () => {
      btn.clear()
        .rect(16, btnY, btnW, btnH)
        .fill({ color: 0x000000, alpha: 0.5 })
        .stroke({ color: 0xaa801a, width: 1, alpha: 0.8 });
      btnText.style.fill = 0xaa801a;
    });
    
    if (options?.onConfirm) {
      btn.on("pointertap", () => {
        options.onConfirm?.();
      });
    }

    innerContainer.addChild(btn);
    innerContainer.addChild(btnText);
    
    // Scale everything to fit the target width
    innerContainer.scale.set(targetW / 280);
  }

  private resolveCard(id: string): Texture | null {
    const alias = GENERAL_CARD_ALIAS[id];
    if (alias) {
      try {
        const t = Assets.get<Texture>(alias);
        if (t) return t;
      } catch (e) {}
    }
    return null;
  }
}
