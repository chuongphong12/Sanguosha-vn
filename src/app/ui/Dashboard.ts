import { Container, Graphics, Text, Sprite, Texture, Assets } from "pixi.js";
import { animate } from "motion";
import { ROLE_NAMES } from "../../game/catalog/roles";

import type {
  PlayerID,
  PhysicalCard,
  TqsPlayerViewState,
} from "../../game/model";
import { CARD_DEFINITIONS } from "../../game/catalog/cards";
import { GAME_FONT_FAMILY } from "./typography";
import { CardView } from "./CardView";
import { PlayerAvatar } from "./PlayerAvatar";
import { THEME } from "./theme";
import { Panel } from "./components/Panel";

export class Dashboard extends Container {
  static hoveredCardID: string | null = null;

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
    const bg = new Panel({
      width: vw - 60,
      height: panelHeight,
    });
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

    // === Role Card (right side) ===
    const roleCardContainer = new Container();
    const roleLeft = vw - 60 - avatarW - 8;
    roleCardContainer.position.set(roleLeft, 8);

    let backTex: Texture | undefined;
    try {
      backTex = Assets.get<Texture>("cards/roles/back.jpg");
    } catch (e) {}
    let faceTex: Texture | undefined;
    if (player.role) {
      try {
        faceTex = Assets.get<Texture>(`cards/roles/${player.role}.jpg`);
      } catch (e) {}
    }

    const roleSprite = backTex ? new Sprite(backTex) : new Sprite();
    roleSprite.width = avatarW;
    roleSprite.height = avatarH;
    roleCardContainer.addChild(roleSprite);

    const roleBorder = new Graphics()
      .roundRect(0, 0, avatarW, avatarH, 6)
      .stroke({ color: THEME.colors.gold, width: 2, alpha: 0.8 });
    roleCardContainer.addChild(roleBorder);

    let roleRevealed = player.role === "lord";
    const roleLabelText = new Text({
      text: "Thân Phận\n(Nhấn để lật)",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 14,
        fill: THEME.colors.gold,
        align: "center",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    roleLabelText.anchor.set(0.5);
    roleLabelText.position.set(avatarW / 2, avatarH / 2);
    roleCardContainer.addChild(roleLabelText);

    if (player.role === "lord") {
      if (faceTex) roleSprite.texture = faceTex;
      roleLabelText.visible = false;
    } else {
      roleCardContainer.eventMode = "static";
      roleCardContainer.cursor = "pointer";
      roleCardContainer.on("pointerdown", () => {
        roleRevealed = !roleRevealed;
        if (roleRevealed) {
          if (faceTex) roleSprite.texture = faceTex;
          roleLabelText.visible = false;
        } else {
          if (backTex) roleSprite.texture = backTex;
          roleLabelText.visible = true;
        }
      });
    }

    this.addChild(roleCardContainer);

    // === Equipment Zone ===
    const equipLeft = 8 + avatarW + 12;
    const equipLabel = new Text({
      text: "TRANG BỊ",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 11,
        fill: THEME.colors.gold,
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

    const EQUIP_DESCRIPTIONS: Record<string, string> = {
      "zhuge-crossbow":
        "Tầm đánh: 1\nCó thể sử dụng vô hạn 【Sát】 trong giai đoạn xuất bài.",
      "qinggang-sword":
        "Tầm đánh: 2\nKhi sử dụng 【Sát】 bỏ qua phòng ngự của 【Bát Quái Trận】.",
      "serpent-spear":
        "Tầm đánh: 3\nCó thể gộp 2 lá bài bất kỳ làm 1 lá 【Sát】.",
      "rock-cleaving-axe":
        "Tầm đánh: 3\nKhi 【Sát】 bị 【Thiểm】 vô hiệu hóa, có thể bỏ 2 lá để bắt buộc trúng.",
      "green-dragon-blade":
        "Tầm đánh: 3\nKhi 【Sát】 bị vô hiệu hóa, có thể lập tức đánh thêm 【Sát】.",
      halberd:
        "Tầm đánh: 4\nNếu đây là lá bài cuối cùng trên tay, 【Sát】 có thể chọn tối đa 3 mục tiêu.",
      "qilin-bow":
        "Tầm đánh: 5\nKhi 【Sát】 gây sát thương, có thể phá 1 Ngựa của mục tiêu.",
      "ice-sword":
        "Tầm đánh: 2\nKhi 【Sát】 gây sát thương, có thể bỏ qua sát thương để hủy 2 lá của mục tiêu.",
      "ci-xiong-swords":
        "Tầm đánh: 2\nKhi 【Sát】 mục tiêu khác giới, mục tiêu phải chọn: Bỏ 1 lá hoặc cho bạn rút 1 lá.",
      "bagua-formation":
        "Khi cần sử dụng/đánh ra 【Thiểm】, phán xét Đỏ sẽ được tính là 1 lá 【Thiểm】.",
      "renwang-shield":
        "Vô hiệu hóa mọi sát thương từ 【Sát】 có chất màu Đen.",
      "silver-lion":
        "Mọi sát thương nhận vào nếu lớn hơn 1 đều được giảm xuống còn 1. Khi bị mất trang bị này, hồi 1 Thể Lực.",
      tengjia:
        "Vô hiệu hóa 【Sát】 thường, 【Nam Man】, 【Vạn Tiễn】. Chịu thêm 1 sát thương khi bị sát thương Hỏa.",
    };

    const showPopover = (card: PhysicalCard, x: number, y: number) => {
      popover.removeChildren();

      const cardDef = CARD_DEFINITIONS[card.definitionID];
      let descText = EQUIP_DESCRIPTIONS[cardDef.id] || "Không có thông tin.";
      if (
        cardDef.id === "red-hare" ||
        cardDef.id === "dayuan" ||
        cardDef.id === "zixing"
      ) {
        descText = "-1 Khoảng cách tính đến người chơi khác.";
      } else if (
        cardDef.id === "dilu" ||
        cardDef.id === "jueying" ||
        cardDef.id === "zhaohuang-feidian" ||
        (cardDef.id as string) === "hualiu"
      ) {
        descText = "+1 Khoảng cách phòng thủ.";
      }

      const bg = new Panel({
        width: 320,
        height: 150,
        color: THEME.colors.popoverBg,
        alpha: 0.95,
      });
      popover.addChild(bg);

      const miniCard = new CardView(card, { width: 80, height: 112 });
      miniCard.position.set(12, 19);
      popover.addChild(miniCard);

      const nameLabel = new Text({
        text: cardDef.name,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 16,
          fill: THEME.colors.gold,
          wordWrap: true,
          wordWrapWidth: 196,
          lineHeight: 20,
        },
      });
      nameLabel.position.set(104, 16);
      popover.addChild(nameLabel);

      const desc = new Text({
        text: descText,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 12,
          fill: THEME.colors.paper,
          wordWrap: true,
          wordWrapWidth: 196,
          lineHeight: 18,
        },
      });
      // Move description down a bit in case nameLabel wraps to 2 lines
      desc.position.set(104, nameLabel.height + 22);
      popover.addChild(desc);

      popover.position.set(x, y - 160);

      clearTimeout(hoverTimeout);
      animate(popover as any, { alpha: 1, y: y - 170 }, { duration: 0.2 });
    };

    const hidePopover = () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        animate(popover as any, { alpha: 0 }, { duration: 0.15 });
      }, 100);
    };

    equipments.forEach((eq, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      const eqX = equipLeft + col * 74;
      const eqY = 36 + row * 100;

      if (eq.id) {
        const card = G.cards[eq.id];
        const cardView = new CardView(card, { width: 66, height: 92 });
        cardView.position.set(eqX, eqY);
        this.addChild(cardView);

        cardView.eventMode = "static";
        cardView.cursor = "pointer";
        cardView.on("pointerenter", () => showPopover(card, eqX, eqY));
        cardView.on("pointerleave", hidePopover);
      } else {
        const slot = new Graphics()
          .roundRect(0, 0, 66, 92, 4)
          .fill({ color: 0x000000, alpha: 0.3 })
          .stroke({ color: 0x443322, width: 1 });
        slot.position.set(eqX, eqY);
        this.addChild(slot);

        const typeText = new Text({
          text: eq.label,
          style: {
            fontFamily: GAME_FONT_FAMILY,
            fontSize: 11,
            fill: THEME.colors.muted,
          },
        });
        typeText.anchor.set(0.5);
        typeText.position.set(eqX + 33, eqY + 46);
        this.addChild(typeText);
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
          fill: THEME.colors.redBright,
        },
      });
      delayText.position.set(equipLeft + 180, 12);
      this.addChild(delayText);
    }

    // === Hand cards (Radial Layout) ===
    const handLeft = equipLeft + 160;
    const handAreaWidth = vw - 60 - handLeft;

    const countBadge = new Text({
      text: `${player.hand.length} lá`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 11,
        fill: THEME.colors.muted,
      },
    });
    countBadge.anchor.set(1, 0);
    countBadge.position.set(roleLeft - 12, 12);
    this.addChild(countBadge);

    const cardContainer = new Container();
    cardContainer.sortableChildren = true;

    // Add mask to prevent cards bleeding below the dashboard bottom
    // We expand the mask upwards (-500) and horizontally (+/- 200) so hovered cards don't get clipped,
    // while still clipping the bottom at panelHeight.
    const handMask = new Graphics()
      .rect(handLeft - 200, -500, handAreaWidth + 400, panelHeight + 500)
      .fill(0xffffff);
    this.addChild(handMask);
    cardContainer.mask = handMask;

    this.addChild(cardContainer);

    const hand = player.hand;
    const cardW = 120;
    const cardH = 168;

    // Radial layout Math
    const radius = 1200;
    // EXACT CENTER OF AVAILABLE SPACE
    const centerX = (handLeft + roleLeft) / 2;
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

      const isHovered = Dashboard.hoveredCardID === cardID;

      if (isHovered) {
        cardView.zIndex = 1000;
        cardView.y = baseY + cardH - 60 - (selected ? 20 : 0);
        cardView.rotation = 0;
        cardView.scale.set(1.2);
      } else {
        cardView.zIndex = index;
      }

      cardView.on("pointerenter", () => {
        Dashboard.hoveredCardID = cardID;
        cardView.zIndex = 1000;
        if ((cardView as any)._anim) (cardView as any)._anim.stop();
        (cardView as any)._anim = animate(
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
        if (Dashboard.hoveredCardID === cardID) {
          Dashboard.hoveredCardID = null;
        }
        cardView.zIndex = index;
        if ((cardView as any)._anim) (cardView as any)._anim.stop();
        (cardView as any)._anim = animate(
          cardView as any,
          {
            y: baseY + cardH - (selected ? 20 : 0),
            rotation: baseRotation,
            scale: 1,
          },
          { duration: 0.2, ease: "easeOut" },
        );
      });

      cardView.once("destroyed", () => {
        if ((cardView as any)._anim) {
          (cardView as any)._anim.stop();
        }
      });

      cardContainer.addChild(cardView);
    });

    if (hand.length === 0) {
      const emptyText = new Text({
        text: "Không có bài trên tay",
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 13,
          fill: THEME.colors.muted,
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
