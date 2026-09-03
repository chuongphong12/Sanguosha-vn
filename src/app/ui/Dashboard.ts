import { Container, Graphics, Text } from "pixi.js";

import type { PlayerID, TqsPlayerViewState } from "../../game/model";
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

/**
 * Dashboard — The bottom area of the game screen showing the current
 * viewer's avatar, hand cards (as CardView instances), equipment zone,
 * and HP info. It replaces drawHand's button-based cards with visual
 * CardView components and adds a PlayerAvatar portrait.
 */
export class Dashboard extends Container {
  constructor(
    G: TqsPlayerViewState,
    viewerID: PlayerID,
    options: {
      viewportWidth: number;
      selectedCardIDs: Set<string>;
      handPage: number;
      onCardTap: (cardID: string) => void;
      onPageChange: (page: number) => void;
    },
  ) {
    super();

    const player = G.players[viewerID];
    const vw = options.viewportWidth;

    // === Background panel ===
    const panelHeight = 240;
    const bg = new Graphics()
      .roundRect(0, 0, vw - 60, panelHeight, 8)
      .fill({ color: 0x181411, alpha: 0.96 })
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.7 });
    this.addChild(bg);

    // === Player Avatar (left side) ===
    const avatarW = 100;
    const avatarH = 120;
    const avatar = new PlayerAvatar(player, {
      width: avatarW,
      height: avatarH,
      isActiveActor: G.turn?.activePlayerID === viewerID,
    });
    avatar.position.set(12, 12);
    this.addChild(avatar);

    // === Equipment summary (compact, below avatar) ===
    const equipEntries = Object.entries(player.equipment)
      .filter(([, cardID]) => cardID)
      .map(([, cardID]) => {
        const card = G.cards[cardID!];
        return card ? `【${CARD_DEFINITIONS[card.definitionID].name}】` : "";
      })
      .filter(Boolean);

    const equipText = new Text({
      text: equipEntries.length > 0 ? equipEntries.join(" ") : "Không trang bị",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 9,
        fill: equipEntries.length > 0 ? COLORS.paperDark : COLORS.muted,
        wordWrap: true,
        wordWrapWidth: avatarW,
      },
    });
    equipText.position.set(12, avatarH + 18);
    this.addChild(equipText);

    // === Hand cards area (right of avatar) ===
    const handLeft = avatarW + 24;
    const handAreaWidth = vw - 60 - handLeft - 12;

    // "BÀI TRÊN TAY" label
    const handLabel = new Text({
      text: "BÀI TRÊN TAY",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 11,
        fill: COLORS.gold,
        letterSpacing: 1.5,
      },
    });
    handLabel.position.set(handLeft, 8);
    this.addChild(handLabel);

    // Cards
    const hand = player.hand;
    const cardW = 80;
    const cardH = 112;
    const cardGap = 6;
    const cardsPerPage = Math.max(
      1,
      Math.floor((handAreaWidth + cardGap) / (cardW + cardGap)),
    );
    const pageCount = Math.max(1, Math.ceil(hand.length / cardsPerPage));
    const currentPage = Math.min(options.handPage, pageCount - 1);
    const visibleHand = hand.slice(
      currentPage * cardsPerPage,
      (currentPage + 1) * cardsPerPage,
    );

    visibleHand.forEach((cardID, index) => {
      const card = G.cards[cardID];
      if (!card) return;
      const selected = options.selectedCardIDs.has(cardID);
      const cardView = new CardView(card, {
        selected,
        width: cardW,
        height: cardH,
        onTap: () => options.onCardTap(cardID),
      });
      cardView.position.set(
        handLeft + index * (cardW + cardGap),
        26 + (selected ? -8 : 0),
      );
      this.addChild(cardView);
    });

    // Empty hand message
    if (hand.length === 0) {
      const emptyText = new Text({
        text: "Không có bài trên tay",
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 13,
          fill: COLORS.muted,
        },
      });
      emptyText.position.set(handLeft, 70);
      this.addChild(emptyText);
    }

    // === Pager ===
    if (pageCount > 1) {
      const pagerY = cardH + 36;
      const pagerCenterX = handLeft + handAreaWidth / 2;

      // Previous
      const prevBtn = this.createPagerButton(
        "‹",
        pagerCenterX - 50,
        pagerY,
        currentPage > 0,
        () => options.onPageChange(Math.max(0, currentPage - 1)),
      );
      this.addChild(prevBtn);

      // Page info
      const pageInfo = new Text({
        text: `${currentPage + 1}/${pageCount}`,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 11,
          fill: COLORS.paperDark,
        },
      });
      pageInfo.anchor.set(0.5);
      pageInfo.position.set(pagerCenterX, pagerY);
      this.addChild(pageInfo);

      // Next
      const nextBtn = this.createPagerButton(
        "›",
        pagerCenterX + 50,
        pagerY,
        currentPage < pageCount - 1,
        () => options.onPageChange(Math.min(pageCount - 1, currentPage + 1)),
      );
      this.addChild(nextBtn);
    }

    // === Card count badge ===
    const countBadge = new Text({
      text: `${hand.length} lá`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 10,
        fill: COLORS.muted,
      },
    });
    countBadge.anchor.set(1, 0);
    countBadge.position.set(vw - 60 - 12, 8);
    this.addChild(countBadge);
  }

  private createPagerButton(
    label: string,
    x: number,
    y: number,
    enabled: boolean,
    onTap: () => void,
  ): Container {
    const btn = new Container();
    const bg = new Graphics()
      .roundRect(-18, -14, 36, 28, 5)
      .fill(COLORS.ink)
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.6 });
    btn.addChild(bg);

    const text = new Text({
      text: label,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 16,
        fill: COLORS.paper,
      },
    });
    text.anchor.set(0.5);
    btn.addChild(text);

    btn.position.set(x, y);
    btn.alpha = enabled ? 1 : 0.35;
    if (enabled) {
      btn.eventMode = "static";
      btn.cursor = "pointer";
      btn.on("pointertap", onTap);
    }
    return btn;
  }
}
