/* eslint-disable @typescript-eslint/no-explicit-any */
import { Container, Graphics, Text } from "pixi.js";
import { animate } from "motion";

import type {
  PlayerID,
  PhysicalCard,
  TqsPlayerViewState,
} from "../../game/model";
import { CARD_DEFINITIONS } from "../../game/catalog/cards";
import { GAME_FONT_FAMILY } from "./typography";
import { CardView } from "./CardView";
import { PlayerAvatar } from "./PlayerAvatar";

const COLORS = {
  ink: 0x201812,
  paper: 0xf3e5c8,
  paperDark: 0xd6bd91,
  red: 0x8f1d20,
  redBright: 0xb93730,
  gold: 0xc59a45,
  muted: 0x9a836b,
  black: 0x120f0d,
  white: 0xfffbef,
  green: 0x3f6f55,
};

export class Dashboard extends Container {
  constructor(
    G: TqsPlayerViewState,
    viewerID: PlayerID,
    options: {
      viewportWidth: number;
      selectedCardIDs: Set<string>;
      handScrollX: number;
      onCardTap: (cardID: string) => void;
      onScroll: (scrollX: number) => void;
    },
  ) {
    super();

    const player = G.players[viewerID];
    const vw = options.viewportWidth;
    const panelHeight = 240;

    // === Background panel ===
    const bg = new Graphics()
      .roundRect(0, 0, vw - 60, panelHeight, 8)
      .fill({ color: 0x181411, alpha: 0.96 })
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.7 });
    this.addChild(bg);

    // === Player Avatar (left side) ===
    // Match height to the dashboard for a prominent hero portrait
    const avatarW = 180;
    const avatarH = 224;
    const avatar = new PlayerAvatar(player, {
      width: avatarW,
      height: avatarH,
      isActiveActor: G.turn?.activePlayerID === viewerID,
    });
    avatar.position.set(8, 8);
    this.addChild(avatar);

    // === Equipment Zone ===
    const equipLeft = 8 + avatarW + 12;
    const equipLabel = new Text({
      text: "TRANG BỊ",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 11,
        fill: COLORS.gold,
        letterSpacing: 1.5,
      },
    });
    equipLabel.position.set(equipLeft, 12);
    this.addChild(equipLabel);

    const equipments = [
      { type: "weapon", id: player.equipment.weapon, label: "Vũ Khí" },
      { type: "armor", id: player.equipment.armor, label: "Phòng Cụ" },
      {
        type: "plusMount",
        id: player.equipment["defensive-mount"],
        label: "+1 Ngựa",
      },
      {
        type: "minusMount",
        id: player.equipment["offensive-mount"],
        label: "-1 Ngựa",
      },
    ];

    // === Popover for equipment ===
    const popover = new Container();
    popover.alpha = 0;
    popover.zIndex = 2000;
    this.addChild(popover);

    let hoverTimeout: any;

    const showPopover = (card: PhysicalCard, x: number, y: number) => {
      popover.removeChildren();

      const cardDef = CARD_DEFINITIONS[card.definitionID];

      // Background for popover
      const bg = new Graphics()
        .roundRect(0, 0, 240, 140, 8)
        .fill({ color: 0x110c0a, alpha: 0.95 })
        .stroke({ color: COLORS.gold, width: 1, alpha: 0.8 });
      popover.addChild(bg);

      // Draw a mini CardView inside
      const miniCard = new CardView(card, { width: 80, height: 112 });
      miniCard.position.set(12, 14);
      popover.addChild(miniCard);

      // Description text
      // We don't have description in CardDefinition yet, so just show name/kind for now
      const desc = new Text({
        text:
          cardDef.name +
          "\n" +
          (cardDef.kind === "equipment" ? "Trang bị" : cardDef.kind),
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 12,
          fill: COLORS.paper,
          wordWrap: true,
          wordWrapWidth: 124,
          lineHeight: 16,
        },
      });
      desc.position.set(104, 14);
      popover.addChild(desc);

      popover.position.set(x, y - 150);

      clearTimeout(hoverTimeout);
      animate(popover as any, { alpha: 1, y: y - 160 }, { duration: 0.2 });
    };

    const hidePopover = () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        animate(popover as any, { alpha: 0 }, { duration: 0.15 });
      }, 100);
    };

    equipments.forEach((eq, index) => {
      const eqY = 32 + index * 36;

      const slot = new Graphics()
        .roundRect(equipLeft, eqY, 150, 30, 4)
        .fill({ color: 0x000000, alpha: 0.3 })
        .stroke({ color: 0x443322, width: 1 });
      this.addChild(slot);

      const typeText = new Text({
        text: eq.label,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 10,
          fill: COLORS.muted,
        },
      });
      typeText.position.set(equipLeft + 6, eqY + 8);
      this.addChild(typeText);

      if (eq.id) {
        const card = G.cards[eq.id];
        const cardDef = CARD_DEFINITIONS[card.definitionID];
        const nameText = new Text({
          text: cardDef.name,
          style: {
            fontFamily: GAME_FONT_FAMILY,
            fontSize: 12,
            fill: COLORS.paper,
          },
        });

        // Prevent overflow
        if (nameText.width > 90) {
          nameText.scale.set(90 / nameText.width);
        }
        nameText.position.set(equipLeft + 54, eqY + 7);
        this.addChild(nameText);

        // Hover events
        slot.eventMode = "static";
        slot.cursor = "pointer";
        slot.on("pointerenter", () => showPopover(card, equipLeft + 160, eqY));
        slot.on("pointerleave", hidePopover);
      }
    });

    // === Delayed (Judgment) Zone ===
    const delayedEntries = player.judgement
      .map((id) => {
        const c = G.cards[id];
        return c ? `【${CARD_DEFINITIONS[c.definitionID].name}】` : "";
      })
      .filter(Boolean);

    if (delayedEntries.length > 0) {
      const delayText = new Text({
        text: `Phán xét: ${delayedEntries.join(" ")}`,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 11,
          fill: COLORS.redBright,
        },
      });
      delayText.position.set(equipLeft, 190);
      this.addChild(delayText);
    }

    // === Hand cards (Radial Layout) ===
    const handLeft = equipLeft + 160;
    const handAreaWidth = vw - 60 - handLeft;

    const countBadge = new Text({
      text: `${player.hand.length} lá`,
      style: { fontFamily: GAME_FONT_FAMILY, fontSize: 11, fill: COLORS.muted },
    });
    countBadge.anchor.set(1, 0);
    countBadge.position.set(vw - 60 - 12, 12);
    this.addChild(countBadge);

    const cardContainer = new Container();
    cardContainer.sortableChildren = true;

    // Add mask to prevent cards bleeding below the dashboard bottom
    const handMask = new Graphics()
      .rect(handLeft, 0, handAreaWidth, panelHeight)
      .fill(0xffffff);
    this.addChild(handMask);
    cardContainer.mask = handMask;

    this.addChild(cardContainer);

    const hand = player.hand;
    const cardW = 120;
    const cardH = 168;

    // Radial layout Math
    const radius = 1200;
    // EXACT CENTER OF DASHBOARD
    const centerX = (vw - 60) / 2;
    // Push the center way down so the arc is flat
    const centerY = panelHeight + radius - 90;

    // Spread angle depends on hand size, max 45 degrees span
    const maxSpan = Math.PI / 4;
    const anglePerCard = Math.min(0.08, maxSpan / Math.max(1, hand.length));
    const totalAngle = anglePerCard * (hand.length - 1);
    const startAngle = -totalAngle / 2;

    hand.forEach((cardID, index) => {
      const card = G.cards[cardID];
      if (!card) return;

      const selected = options.selectedCardIDs.has(cardID);
      const angle = startAngle + index * anglePerCard;

      const baseX = centerX + radius * Math.sin(angle) - cardW / 2;
      const baseY = centerY - radius * Math.cos(angle) - cardH / 2;
      const baseRotation = angle;

      const cardView = new CardView(card, {
        selected,
        width: cardW,
        height: cardH,
        onTap: () => options.onCardTap(cardID),
      });

      cardView.position.set(baseX, baseY - (selected ? 20 : 0));
      cardView.rotation = baseRotation;

      // Pivot at center bottom for natural fan rotation and scaling
      cardView.pivot.set(cardW / 2, cardH);
      cardView.x += cardW / 2;
      cardView.y += cardH;

      cardView.zIndex = index;

      cardView.on("pointerenter", () => {
        cardView.zIndex = 1000;
        animate(
          cardView as any,
          {
            y: baseY + cardH - 60 - (selected ? 20 : 0),
            rotation: 0,
            scale: 1.2,
          },
          { duration: 0.15, ease: "easeOut" },
        );
      });

      cardView.on("pointerleave", () => {
        cardView.zIndex = index;
        animate(
          cardView as any,
          {
            y: baseY + cardH - (selected ? 20 : 0),
            rotation: baseRotation,
            scale: 1,
          },
          { duration: 0.2, ease: "easeOut" },
        );
      });

      cardContainer.addChild(cardView);
    });

    if (hand.length === 0) {
      const emptyText = new Text({
        text: "Không có bài trên tay",
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 13,
          fill: COLORS.muted,
        },
      });
      emptyText.position.set(centerX, panelHeight - 80);
      emptyText.anchor.set(0.5);
      this.addChild(emptyText);
    }

    // Make sure popover is above hand cards
    this.setChildIndex(popover, this.children.length - 1);
  }
}
