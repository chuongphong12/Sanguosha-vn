import type { DestroyOptions } from "pixi.js";
import { Container, Graphics, Text, Sprite, Texture, Assets } from "pixi.js";
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
import { THEME } from "./theme";
import { Panel } from "./components/Panel";
import { ROLE_CARD_ALIAS, ROLE_CARD_BACK_ALIAS } from "./assetAliases";

type DashboardOptions = {
  viewportWidth: number;
  selectedCardIDs: Set<string>;
  handScrollX: number;
  onCardTap: (cardID: string) => void;
  onScroll: (scrollX: number) => void;
};

type HandCardLayout = {
  x: number;
  restY: number;
  hoverY: number;
  zIndex: number;
};

const HAND_HOVER_LIFT = 60;
const HAND_SELECTED_LIFT = 20;
const HAND_HOVER_SCALE = 1.2;

export class Dashboard extends Container {
  static hoveredCardID: string | null = null;

  public readonly viewerID: PlayerID;
  private panelHeight = 240;

  private bg: Panel;
  private avatar: PlayerAvatar;

  private roleCardContainer = new Container();
  private roleSprite = new Sprite();
  private roleBorder = new Graphics();
  private roleLabelText = new Text({
    text: "Thân Phận\n(Nhấn để lật)",
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 14,
      fill: THEME.colors.gold,
      align: "center",
      stroke: { color: 0x000000, width: 3 },
    },
  });
  private roleRevealed = false;
  private backTex?: Texture;
  private faceTex?: Texture;

  private equipLabel = new Text({
    text: "TRANG BỊ",
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 11,
      fill: THEME.colors.gold,
      letterSpacing: 1.5,
    },
  });
  private equipContainer = new Container();
  private equipViews = new Map<
    number,
    { cardView?: CardView; slot?: Graphics; typeText?: Text }
  >();

  private popover = new Container();
  private hoverTimeout: any;

  private delayText = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 11,
      fill: THEME.colors.redBright,
    },
  });

  private countBadge = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 11,
      fill: THEME.colors.muted,
    },
  });

  private cardContainer = new Container();
  private handMask = new Graphics();
  private emptyText = new Text({
    text: "Không có bài trên tay",
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 13,
      fill: THEME.colors.muted,
    },
  });

  private handCardViews = new Map<string, CardView>();
  private handCardLayouts = new Map<string, HandCardLayout>();
  private lastState?: { G: TqsPlayerViewState; options: DashboardOptions };
  private handCardAnimations = new Map<CardView, { stop: () => void }>();
  private popoverAnimation?: { stop: () => void };
  private destroying = false;

  constructor(
    G: TqsPlayerViewState,
    viewerID: PlayerID,
    options: DashboardOptions,
  ) {
    super();
    this.viewerID = viewerID;
    const vw = options.viewportWidth;

    // Background
    this.bg = new Panel({ width: vw - 60, height: this.panelHeight });
    this.addChild(this.bg);

    // Avatar
    const avatarW = 180;
    const avatarH = 224;
    const player = G.players[viewerID];
    this.avatar = new PlayerAvatar(player, {
      width: avatarW,
      height: avatarH,
      isActiveActor: G.turn?.activePlayerID === viewerID,
    });
    this.avatar.position.set(8, 8);
    this.addChild(this.avatar);

    // Role
    const roleLeft = vw - 60 - avatarW - 8;
    this.roleCardContainer.position.set(roleLeft, 8);

    this.roleSprite.width = avatarW;
    this.roleSprite.height = avatarH;
    this.roleBorder
      .roundRect(0, 0, avatarW, avatarH, 6)
      .stroke({ color: THEME.colors.gold, width: 2, alpha: 0.8 });
    this.roleLabelText.anchor.set(0.5);
    this.roleLabelText.position.set(avatarW / 2, avatarH / 2);

    this.roleCardContainer.addChild(
      this.roleSprite,
      this.roleBorder,
      this.roleLabelText,
    );
    this.addChild(this.roleCardContainer);

    try {
      this.backTex = Assets.get<Texture>(ROLE_CARD_BACK_ALIAS);
    } catch {
      /* ignore */
    }

    // Equips
    const equipLeft = 8 + avatarW + 12;
    this.equipLabel.position.set(equipLeft, 12);
    this.addChild(this.equipLabel, this.equipContainer);

    // Popover
    this.popover.alpha = 0;
    this.popover.zIndex = 2000;
    this.addChild(this.popover);

    // Delay & Badges
    this.addChild(this.delayText, this.countBadge);

    // Hand
    this.cardContainer.sortableChildren = true;
    this.addChild(this.handMask, this.cardContainer, this.emptyText);
    this.cardContainer.mask = this.handMask;

    this.sync(G, options);
  }

  public sync(G: TqsPlayerViewState, options: DashboardOptions): void {
    this.lastState = { G, options };
    const player = G.players[this.viewerID];
    const vw = options.viewportWidth;
    const avatarW = 180;

    this.bg.width = vw - 60;
    this.avatar.sync(player, {
      isActiveActor: G.turn?.activePlayerID === this.viewerID,
    });

    // Role updates
    const roleLeft = vw - 60 - avatarW - 8;
    this.roleCardContainer.position.set(roleLeft, 8);

    if (player.role) {
      try {
        this.faceTex = Assets.get<Texture>(ROLE_CARD_ALIAS[player.role]);
      } catch {
        /* ignore */
      }
    }

    if (player.role === "lord") {
      if (this.faceTex) this.roleSprite.texture = this.faceTex;
      this.roleLabelText.visible = false;
      this.roleRevealed = true;
    } else {
      if (this.roleRevealed && this.faceTex) {
        this.roleSprite.texture = this.faceTex;
        this.roleLabelText.visible = false;
      } else {
        if (this.backTex) this.roleSprite.texture = this.backTex;
        this.roleLabelText.visible = true;
      }
      if (this.roleCardContainer.eventMode !== "static") {
        this.roleCardContainer.eventMode = "static";
        this.roleCardContainer.cursor = "pointer";
        this.roleCardContainer.on("pointerdown", this.handleRoleCardToggle);
      }
    }

    // Equipments
    const equipLeft = 8 + avatarW + 12;
    this.equipLabel.position.set(equipLeft, 12);

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

    equipments.forEach((eq, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const eqX = equipLeft + col * 74;
      const eqY = 36 + row * 100;

      let viewCache = this.equipViews.get(index);
      if (!viewCache) {
        viewCache = {};
        this.equipViews.set(index, viewCache);
      }

      if (eq.id) {
        const card = G.cards[eq.id];
        if (viewCache.slot) {
          viewCache.slot.destroy();
          viewCache.slot = undefined;
        }
        if (viewCache.typeText) {
          viewCache.typeText.destroy();
          viewCache.typeText = undefined;
        }

        if (!viewCache.cardView) {
          viewCache.cardView = new CardView(card, { width: 66, height: 92 });
          this.equipContainer.addChild(viewCache.cardView);
          viewCache.cardView.eventMode = "static";
          viewCache.cardView.cursor = "pointer";
          viewCache.cardView.on("pointerenter", () =>
            this.showPopover(card, eqX, eqY),
          );
          viewCache.cardView.on("pointerleave", () => this.hidePopover());
        } else {
          viewCache.cardView.sync(card);
        }
        viewCache.cardView.position.set(eqX, eqY);
        viewCache.cardView.visible = true;
      } else {
        if (viewCache.cardView) {
          viewCache.cardView.destroy();
          viewCache.cardView = undefined;
        }

        if (!viewCache.slot) {
          viewCache.slot = new Graphics()
            .roundRect(0, 0, 66, 92, 4)
            .fill({ color: 0x000000, alpha: 0.3 })
            .stroke({ color: 0x443322, width: 1 });
          this.equipContainer.addChild(viewCache.slot);
        }
        viewCache.slot.position.set(eqX, eqY);

        if (!viewCache.typeText) {
          viewCache.typeText = new Text({
            text: eq.label,
            style: {
              fontFamily: GAME_FONT_FAMILY,
              fontSize: 11,
              fill: THEME.colors.muted,
            },
          });
          viewCache.typeText.anchor.set(0.5);
          this.equipContainer.addChild(viewCache.typeText);
        }
        viewCache.typeText.position.set(eqX + 33, eqY + 46);
      }
    });

    // Delayed (Judgment) Zone
    const delayedEntries = player.judgement
      .map((id) => {
        const c = G.cards[id];
        return c ? `【${CARD_DEFINITIONS[c.definitionID].name}】` : "";
      })
      .filter(Boolean);

    if (delayedEntries.length > 0) {
      this.delayText.text = `Phán xét: ${delayedEntries.join(" ")}`;
      this.delayText.position.set(equipLeft + 180, 12);
      this.delayText.visible = true;
    } else {
      this.delayText.visible = false;
    }

    // Hand cards
    const handLeft = equipLeft + 160;
    const handAreaWidth = vw - 60 - handLeft;

    this.countBadge.text = `${player.hand.length} lá`;
    this.countBadge.anchor.set(1, 0);
    this.countBadge.position.set(roleLeft - 12, 12);

    this.handMask
      .clear()
      .rect(handLeft - 200, -500, handAreaWidth + 400, this.panelHeight + 500)
      .fill(0xffffff);

    const hand = player.hand;
    const newHandSet = new Set(hand);
    const cardW = 120;
    const cardH = 168;

    // Horizontal layout
    const maxSpacing = 80;
    const totalAvailable = handAreaWidth - cardW;
    const requiredSpacing =
      hand.length > 1 ? totalAvailable / (hand.length - 1) : maxSpacing;
    const spacing = Math.min(maxSpacing, requiredSpacing);
    const startX =
      handLeft + (handAreaWidth - (cardW + (hand.length - 1) * spacing)) / 2;

    // Remove missing
    for (const [id, view] of this.handCardViews) {
      if (!newHandSet.has(id)) {
        view.destroy();
        this.handCardViews.delete(id);
        this.handCardLayouts.delete(id);
        if (Dashboard.hoveredCardID === id) Dashboard.hoveredCardID = null;
      }
    }

    // Update / Create
    hand.forEach((cardID, index) => {
      const card = G.cards[cardID];
      if (!card) return;

      const selected = options.selectedCardIDs.has(cardID);
      // Hand cards are pivoted at their bottom-centre so the hover scale grows upwards.
      const restY = this.panelHeight - 10 - (selected ? HAND_SELECTED_LIFT : 0);
      const layout: HandCardLayout = {
        x: startX + index * spacing + cardW / 2,
        restY,
        hoverY: restY - HAND_HOVER_LIFT,
        zIndex: index,
      };
      this.handCardLayouts.set(cardID, layout);

      let cardView = this.handCardViews.get(cardID);
      if (!cardView) {
        cardView = this.createHandCardView(card, cardW, cardH, selected, () =>
          options.onCardTap(cardID),
        );
        this.handCardViews.set(cardID, cardView);
        this.cardContainer.addChild(cardView);
        cardView.position.set(layout.x, layout.restY + 100);
        cardView.alpha = 0;
        this.animateHandCard(
          cardView,
          { y: layout.restY, alpha: 1 },
          { duration: 0.3, ease: "backOut" },
        );
      } else {
        cardView.sync(card, {
          selected,
          onTap: () => options.onCardTap(cardID),
        });
        this.placeHandCard(cardID, cardView, layout);
      }
    });

    if (hand.length === 0) {
      this.emptyText.position.set(vw / 2, this.panelHeight - 80);
      this.emptyText.anchor.set(0.5);
      this.emptyText.visible = true;
    } else {
      this.emptyText.visible = false;
    }

    this.setChildIndex(this.popover, this.children.length - 1);
  }

  private readonly handleRoleCardToggle = (): void => {
    this.roleRevealed = !this.roleRevealed;
    if (!this.lastState) return;
    this.sync(this.lastState.G, this.lastState.options);
  };

  private createHandCardView(
    card: PhysicalCard,
    cardW: number,
    cardH: number,
    selected: boolean,
    onTap: () => void,
  ): CardView {
    const cardID = card.id;
    const cardView = new CardView(card, {
      width: cardW,
      height: cardH,
      selected,
      onTap,
    });
    cardView.pivot.set(cardW / 2, cardH);

    const handlePointerEnter = (): void => {
      const layout = this.handCardLayouts.get(cardID);
      if (!layout) return;
      Dashboard.hoveredCardID = cardID;
      cardView.zIndex = 1000;
      this.animateHandCard(
        cardView,
        { x: layout.x, y: layout.hoverY, scale: HAND_HOVER_SCALE },
        { duration: 0.15, ease: "easeOut" },
      );
    };

    const handlePointerLeave = (): void => {
      const layout = this.handCardLayouts.get(cardID);
      if (!layout) return;
      if (Dashboard.hoveredCardID === cardID) Dashboard.hoveredCardID = null;
      cardView.zIndex = layout.zIndex;
      this.animateHandCard(
        cardView,
        { x: layout.x, y: layout.restY, scale: 1 },
        { duration: 0.2, ease: "easeOut" },
      );
    };

    cardView.on("pointerenter", handlePointerEnter);
    cardView.on("pointerleave", handlePointerLeave);
    cardView.once("destroyed", () => {
      this.handCardAnimations.get(cardView)?.stop();
      this.handCardAnimations.delete(cardView);
    });

    return cardView;
  }

  private placeHandCard(
    cardID: string,
    cardView: CardView,
    layout: HandCardLayout,
  ): void {
    this.handCardAnimations.get(cardView)?.stop();
    this.handCardAnimations.delete(cardView);
    cardView.alpha = 1;

    const isHovered = Dashboard.hoveredCardID === cardID;
    cardView.zIndex = isHovered ? 1000 : layout.zIndex;
    cardView.position.set(layout.x, isHovered ? layout.hoverY : layout.restY);
    cardView.scale.set(isHovered ? HAND_HOVER_SCALE : 1);
  }

  private animateHandCard(
    cardView: CardView,
    target: Record<string, number>,
    transition: { duration: number; ease: "easeOut" | "backOut" },
  ): void {
    this.handCardAnimations.get(cardView)?.stop();
    if (Dashboard.prefersReducedMotion()) {
      const { scale, ...rest } = target;
      Object.assign(cardView, rest);
      if (scale !== undefined) cardView.scale.set(scale);
      return;
    }
    this.handCardAnimations.set(
      cardView,
      animate(cardView as never, target as never, transition),
    );
  }

  private static prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    );
  }

  private showPopover(card: PhysicalCard, x: number, y: number) {
    this.popover.removeChildren();

    const cardDef = CARD_DEFINITIONS[card.definitionID];
    let descText = "Không có thông tin.";
    // Simplified descriptions for size, add full EQUIP_DESCRIPTIONS back later if needed
    if (["red-hare", "dayuan", "zixing"].includes(cardDef.id as string))
      descText = "-1 Khoảng cách tính đến người chơi khác.";
    if (
      ["dilu", "jueying", "zhaohuang-feidian", "hualiu"].includes(
        cardDef.id as string,
      )
    )
      descText = "+1 Khoảng cách phòng thủ.";

    // Add known hardcoded strings for weapons
    const wep = {
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
    } as any;
    if (wep[cardDef.id]) descText = wep[cardDef.id];

    const bg = new Panel({
      width: 320,
      height: 150,
      color: THEME.colors.popoverBg,
      alpha: 0.95,
    });
    this.popover.addChild(bg);

    const miniCard = new CardView(card, { width: 80, height: 112 });
    miniCard.position.set(12, 19);
    this.popover.addChild(miniCard);

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
    this.popover.addChild(nameLabel);

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
    desc.position.set(104, nameLabel.height + 22);
    this.popover.addChild(desc);

    this.popover.position.set(x, y - 160);

    clearTimeout(this.hoverTimeout);
    this.popoverAnimation?.stop();
    this.popoverAnimation = animate(
      this.popover as any,
      { alpha: 1, y: y - 170 },
      { duration: 0.2 },
    );
  }

  private hidePopover() {
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      this.popoverAnimation?.stop();
      this.popoverAnimation = animate(
        this.popover as any,
        { alpha: 0 },
        { duration: 0.15 },
      );
    }, 100);
  }

  /**
   * motion writes a tween's last frame on the next render and the hover timer
   * can still fire, so a Dashboard destroyed on a hot-seat viewer switch would
   * be written to after it was destroyed. Detach now, free it a few frames on.
   */
  public override destroy(options?: DestroyOptions): void {
    if (this.destroying || this.destroyed) return;
    this.destroying = true;
    clearTimeout(this.hoverTimeout);
    this.popoverAnimation?.stop();
    this.removeFromParent();
    this.visible = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => super.destroy(options)),
    );
  }
}
