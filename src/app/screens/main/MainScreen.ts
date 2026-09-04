import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";

import type {
  MatchClientState,
  MatchConfig,
} from "../../../client/MatchClient";
import { MatchClient } from "../../../client/MatchClient";
import {
  canRespondWithCard,
  canSelectCardTarget,
  getVirtualConversions,
} from "../../../game/cardEngine";
import { CARD_DEFINITIONS } from "../../../game/catalog/cards";
import { GENERALS_BY_ID, hasLordSkill } from "../../../game/catalog/generals";
import type {
  CardDefinition,
  CardResponsePrompt,
  PlayerID,
  PromptAnswer,
  TqsPlayerViewState,
  TurnStep,
  ZoneCardChoice,
} from "../../../game/model";
import { Dashboard } from "../../ui/Dashboard";
import { SeatView } from "../../ui/SeatView";
import { getEquipmentSlotViews } from "../../ui/equipmentView";
import { layoutActionRow } from "../../ui/layout";
import { fitScale } from "../../ui/textLayout";
import { GAME_FONT_FAMILY } from "../../ui/typography";

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

const STEP_NAMES: Record<TurnStep, string> = {
  prepare: "Chuẩn Bị",
  judge: "Phán Xét",
  draw: "Rút Bài",
  play: "Xuất Bài",
  discard: "Bỏ Bài",
  end: "Kết Thúc",
};

const SUIT_LABELS = {
  heart: "♥",
  diamond: "♦",
  club: "♣",
  spade: "♠",
};

const MIN_LAYOUT_HEIGHT = 860;

export class MainScreen extends Container {
  public static assetBundles = ["main"];

  private readonly content = new Container();
  private match?: MatchClient;
  private unsubscribe?: () => void;
  private state: MatchClientState = null;
  private selectedCardIDs = new Set<string>();
  private selectedTargetIDs: PlayerID[] = [];
  private selectedZoneChoices: ZoneCardChoice[] = [];
  private selectedPromptPlayerIDs: PlayerID[] = [];
  private lastPromptID: number | null = null;
  private handPage = 0;
  private promptPage = 0;
  private serpentSpearMode = false;
  private virtualAs: "slash" | "snatch" | "indulgence" | null = null;
  private pendingSkill:
    | "zhi-heng"
    | "qing-nang"
    | "ren-de"
    | "jie-yin"
    | "li-jian"
    | "fan-jian"
    | null = null;
  private handoffConfirmedFor: PlayerID | null = null;
  private lastRequiredActorID: PlayerID | null = null;
  private viewportWidth = 768;
  private viewportHeight = 1024;

  constructor() {
    super();
    this.addChild(this.content);
  }

  public prepare(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode") as "local" | "remote" | null;
    const config: MatchConfig = {};

    if (mode === "remote") {
      config.mode = "remote";
      config.matchID = urlParams.get("matchID") || undefined;
      config.playerID = urlParams.get("playerID") || undefined;
      config.credentials = urlParams.get("credentials") || undefined;
      config.serverUrl = urlParams.get("serverUrl") || undefined;
    } else {
      config.mode = "local";
      config.numPlayers = 4;
    }

    this.match = new MatchClient(config);
    this.unsubscribe = this.match.subscribe((state) =>
      this.receiveState(state),
    );
  }

  public reset(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.match?.destroy();
    this.match = undefined;
    this.state = null;
    this.selectedCardIDs.clear();
    this.selectedTargetIDs = [];
    this.selectedZoneChoices = [];
    this.selectedPromptPlayerIDs = [];
    this.lastPromptID = null;
    this.handPage = 0;
    this.promptPage = 0;
    this.serpentSpearMode = false;
    this.virtualAs = null;
    this.pendingSkill = null;
    this.handoffConfirmedFor = null;
    this.lastRequiredActorID = null;
    this.clearContent();
  }

  private receiveState(state: MatchClientState): void {
    this.state = state;
    const promptID = state?.G.prompt?.id ?? null;
    if (promptID !== this.lastPromptID) {
      this.selectedCardIDs.clear();
      this.selectedTargetIDs = [];
      this.selectedZoneChoices = [];
      this.selectedPromptPlayerIDs = [];
      this.lastPromptID = promptID;
      this.promptPage = 0;
      this.virtualAs = null;
      this.pendingSkill = null;
    }
    const requiredActorID = state ? this.requiredActorID(state.G) : null;
    if (requiredActorID !== this.lastRequiredActorID) {
      this.selectedCardIDs.clear();
      this.selectedTargetIDs = [];
      this.selectedZoneChoices = [];
      this.selectedPromptPlayerIDs = [];
      this.serpentSpearMode = false;
      this.virtualAs = null;
      this.pendingSkill = null;
      this.lastRequiredActorID = requiredActorID;
    }
    this.pruneSelection();
    this.render();
  }

  public resize(width: number, height: number): void {
    const scale = Math.min(1, Math.max(0.01, height / MIN_LAYOUT_HEIGHT));
    this.content.scale.set(scale);
    this.viewportWidth = width / scale;
    this.viewportHeight = height / scale;
    this.render();
  }

  private render(): void {
    this.clearContent();
    this.drawBackground();
    this.drawTitle();

    if (!this.state || !this.match) {
      this.addText(
        "Đang khởi tạo trận đấu cục bộ...",
        this.viewportWidth / 2,
        160,
        24,
        COLORS.paper,
      );
      return;
    }

    const G = this.state.G;
    this.drawViewerSelector(G);
    this.drawStatus(G);
    this.drawSeats(G);
    this.drawLog(G);
    this.drawPrivateArea(G);
  }

  private drawBackground(): void {
    const background = new Graphics()
      .rect(0, 0, this.viewportWidth, this.viewportHeight)
      .fill(COLORS.black);
    background
      .circle(
        this.viewportWidth * 0.82,
        this.viewportHeight * 0.22,
        Math.min(this.viewportWidth, 520) * 0.34,
      )
      .fill({ color: COLORS.red, alpha: 0.16 });
    background
      .rect(18, 18, this.viewportWidth - 36, this.viewportHeight - 36)
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.55 });
    this.content.addChild(background);
    this.addTextureSprite("table", this.viewportWidth, this.viewportHeight, 0.8);
  }

  private addTextureSprite(
    name: string,
    width: number,
    height: number,
    alpha = 1,
    x?: number,
    y?: number,
  ): void {
    let texture: Texture | null = null;
    for (const alias of [
      `${name}.jpg`,
      `${name}.png`,
      `main/${name}.jpg`,
      `main/${name}.png`,
      `/assets/main/${name}.jpg`,
    ]) {
      texture = Assets.get<Texture>(alias);
      if (texture) break;
    }
    if (!texture) return;
    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = alpha;
    sprite.position.set(x ?? 0, y ?? 0);
    this.content.addChild(sprite);
  }

  private drawTitle(): void {
    this.addText("TAM QUỐC SÁT", 34, 30, 30, COLORS.paper, 0, "left");
    this.addText(
      "STANDARD 2013 · ĐẤU CỤC BỘ",
      35,
      66,
      12,
      COLORS.gold,
      0,
      "left",
      2,
    );
  }

  private drawViewerSelector(G: TqsPlayerViewState): void {
    if (this.match?.isRemote) return;

    const buttonWidth = 50;
    const buttonGap = 8;
    const selectorWidth =
      G.seatOrder.length * buttonWidth + (G.seatOrder.length - 1) * buttonGap;
    const selectorLeft = this.viewportWidth - 34 - selectorWidth;

    this.addText(
      "Góc nhìn",
      selectorLeft - 16,
      48,
      14,
      COLORS.paperDark,
      1,
      "right",
    );
    G.seatOrder.forEach((playerID, index) => {
      const active = this.match!.currentViewerID === playerID;
      const selectorLocked = G.status === "playing" || G.status === "ended";
      this.addButton(
        `P${index + 1}`,
        selectorLeft + buttonWidth / 2 + index * (buttonWidth + buttonGap),
        48,
        buttonWidth,
        34,
        () => {
          this.selectedCardIDs.clear();
          this.selectedTargetIDs = [];
          this.selectedZoneChoices = [];
          this.handPage = 0;
          this.promptPage = 0;
          this.serpentSpearMode = false;
          this.handoffConfirmedFor = null;
          this.match!.switchViewer(playerID, (state) =>
            this.receiveState(state),
          );
        },
        active ? COLORS.redBright : COLORS.ink,
        COLORS.paper,
        selectorLocked,
      );
    });
  }

  private drawStatus(G: TqsPlayerViewState): void {
    const panelY = 104;
    this.addPanel(
      30,
      panelY,
      this.viewportWidth - 60,
      66,
      COLORS.ink,
      COLORS.gold,
    );

    let status = "";
    let detail = "";
    if (G.status === "lord-selection") {
      status = `Chủ Công chọn Võ Tướng · Lượt chọn: P${G.players[G.lordID].seat + 1}`;
      detail = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    } else if (G.status === "general-selection") {
      const pending = G.seatOrder
        .filter((id) => !G.players[id].generalSelected)
        .map((id) => `P${G.players[id].seat + 1}`)
        .join(", ");
      status = `Các người chơi còn lại bí mật chọn Võ Tướng · Chưa hoàn tất: ${pending}`;
      detail = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    } else if (G.status === "ended") {
      status = G.winner?.reason ?? "Ván đấu kết thúc.";
      detail = `Chồng Bài Rút: ${G.deck.length} · Chồng Bài Bỏ: ${G.discard.length}`;
    } else if (G.prompt) {
      const responder = `P${G.players[G.prompt.responderID].seat + 1}`;
      status = this.promptStatus(G, responder);
      detail = `Chồng Bài Rút: ${G.deck.length} · Chồng Bài Bỏ: ${G.discard.length}`;
    } else {
      status = `Lượt ${G.turn.number} · Giai Đoạn ${STEP_NAMES[G.turn.step]} · ${this.generalName(G, G.turn.activePlayerID)}`;
      detail = `Chồng Bài Rút: ${G.deck.length} · Chồng Bài Bỏ: ${G.discard.length}`;
    }

    this.addText(
      status,
      52,
      panelY + 18,
      18,
      COLORS.paper,
      0,
      "left",
      0,
      this.viewportWidth - 104,
    );
    this.addText(
      detail,
      52,
      panelY + 44,
      12,
      COLORS.paperDark,
      0,
      "left",
      0,
      this.viewportWidth - 104,
    );
  }

  private drawSeats(G: TqsPlayerViewState): void {
    const viewerID = this.match!.currentViewerID;

    // Sort opponents starting from the next seat
    const opponents: string[] = [];
    const viewerIndex = G.seatOrder.indexOf(viewerID);
    for (let i = 1; i < G.seatOrder.length; i++) {
      opponents.push(G.seatOrder[(viewerIndex + i) % G.seatOrder.length]);
    }

    // Determine positions
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2 - 40;
    const radiusX = this.viewportWidth / 2 - 140;
    const radiusY = this.viewportHeight / 2 - 180;

    opponents.forEach((playerID, index) => {
      const isActor = this.requiredActorID(G) === playerID;
      const targetOrder = this.selectedTargetIDs.indexOf(playerID);
      const selected = targetOrder >= 0;
      const selectableTarget = selected || this.canSelectTarget(G, playerID);

      const seat = new SeatView(G, playerID, {
        selected,
        isActor,
        onTap: () => {
          if (selectableTarget) {
            if (selected) {
              const selectedCardID = [...this.selectedCardIDs][0];
              const selectedCardName = selectedCardID
                ? G.cards[selectedCardID]?.definitionID
                : undefined;
              if (selectedCardName === "borrowed-sword")
                this.selectedTargetIDs.splice(targetOrder);
              else this.selectedTargetIDs.splice(targetOrder, 1);
            } else {
              const maximum = this.maximumTargets(G);
              if (this.selectedTargetIDs.length < maximum)
                this.selectedTargetIDs.push(playerID);
            }
            this.render();
          }
        },
      });

      seat.eventMode = selectableTarget ? "static" : "none";
      seat.cursor = selectableTarget ? "pointer" : "default";

      // Calculate angle (spread evenly across the top arc from 0 to PI)
      let angle = Math.PI / 2; // Default 1 opponent (Top)
      if (opponents.length > 1) {
        // 0 is right, PI is left. We want left to right, so PI to 0
        angle = Math.PI - (index / (opponents.length - 1)) * Math.PI;
      }

      seat.position.set(
        centerX + Math.cos(angle) * radiusX - 50,
        centerY - Math.sin(angle) * radiusY - 60,
      );

      if (selected) {
        this.addText(
          String(targetOrder + 1),
          seat.x + 80,
          seat.y + 18,
          20,
          COLORS.white,
        );
      }

      this.content.addChild(seat);
    });
  }

  private drawLog(G: TqsPlayerViewState): void {
    const y = 466;
    const height = 114;
    this.addPanel(
      30,
      y,
      this.viewportWidth - 60,
      height,
      0x181411,
      COLORS.muted,
    );
    this.addText("DIỄN BIẾN", 46, y + 14, 12, COLORS.gold, 0, "left", 1.5);
    const entries = G.log.slice(-4);
    if (entries.length === 0) {
      this.addText(
        "Chưa có diễn biến nào.",
        46,
        y + 44,
        13,
        COLORS.muted,
        0,
        "left",
      );
      return;
    }
    entries.forEach((entry, index) => {
      this.addText(
        entry.message,
        46,
        y + 36 + index * 18,
        12,
        COLORS.paperDark,
        0,
        "left",
      );
    });
  }

  private drawPrivateArea(G: TqsPlayerViewState): void {
    const viewerID = this.match!.currentViewerID;
    const player = G.players[viewerID];
    const top = this.viewportHeight - 250;

    const requiredActorID = this.requiredActorID(G);
    if (
      !this.match!.isRemote &&
      requiredActorID &&
      (viewerID !== requiredActorID ||
        this.handoffConfirmedFor !== requiredActorID)
    ) {
      this.drawHandoff(G, requiredActorID, top);
      return;
    }

    const canSelectGeneral =
      !player.generalSelected &&
      player.generalCandidates.length > 0 &&
      ((G.status === "lord-selection" && viewerID === G.lordID) ||
        (G.status === "general-selection" && viewerID !== G.lordID));
    if (canSelectGeneral) {
      this.drawGeneralCandidates(G, player.generalCandidates, top + 42);
      return;
    }

    if (G.status !== "playing" && G.status !== "ended") {
      const instruction = requiredActorID
        ? `Hãy chuyển sang góc nhìn của P${G.players[requiredActorID].seat + 1} để chọn Võ Tướng.`
        : "Đang chờ các người chơi hoàn tất việc chọn Võ Tướng.";
      this.addText(
        instruction,
        34,
        top + 48,
        15,
        COLORS.muted,
        0,
        "left",
        0,
        this.viewportWidth - 68,
      );
      return;
    }

    const dashboard = new Dashboard(G, viewerID, {
      viewportWidth: this.viewportWidth,
      selectedCardIDs: this.selectedCardIDs,
      handPage: this.handPage,
      onCardTap: (cardID: string) => {
        if (G.turn.step === "discard") {
          if (this.selectedCardIDs.has(cardID))
            this.selectedCardIDs.delete(cardID);
          else this.selectedCardIDs.add(cardID);
        } else {
          const viewerWeaponID = player.equipment.weapon;
          const promptAllowsSpear =
            G.prompt?.kind === "card-response" &&
            G.prompt.response === "slash" &&
            G.prompt.allowSerpentSpear;
          const playAllowsSpear =
            !G.prompt &&
            this.serpentSpearMode &&
            viewerWeaponID !== undefined &&
            G.cards[viewerWeaponID]?.definitionID === "serpent-spear";
          const multiSelect = promptAllowsSpear || playAllowsSpear;

          if (this.selectedCardIDs.has(cardID)) {
            this.selectedCardIDs.delete(cardID);
          } else {
            if (!multiSelect) this.selectedCardIDs.clear();
            else if (this.selectedCardIDs.size >= 2) return;
            this.selectedCardIDs.add(cardID);
          }
          if (this.virtualAs === "slash" && this.selectedCardIDs.size === 0) {
            this.virtualAs = null;
          }
        }
        this.render();
      },
      onPageChange: (page: number) => {
        this.handPage = page;
        this.render();
      },
    });

    dashboard.position.set(30, top);
    this.content.addChild(dashboard);

    this.drawActions(G, viewerID);
  }

  private drawHandoff(
    G: TqsPlayerViewState,
    requiredActorID: PlayerID,
    top: number,
  ): void {
    const seat = G.players[requiredActorID].seat + 1;
    this.addPanel(
      30,
      top - 12,
      this.viewportWidth - 60,
      154,
      0x181411,
      COLORS.gold,
    );
    this.addText(
      `ĐƯA THIẾT BỊ CHO P${seat}`,
      this.viewportWidth / 2,
      top + 18,
      20,
      COLORS.paper,
    );
    this.addText(
      `P${seat} cần thực hiện hành động tiếp theo.`,
      this.viewportWidth / 2,
      top + 52,
      13,
      COLORS.paperDark,
    );
    this.addButton(
      `Tôi là P${seat} · Tiếp tục`,
      this.viewportWidth / 2,
      top + 102,
      230,
      48,
      () => {
        this.selectedCardIDs.clear();
        this.selectedTargetIDs = [];
        this.selectedZoneChoices = [];
        this.handoffConfirmedFor = requiredActorID;
        if (this.match!.currentViewerID !== requiredActorID) {
          this.match!.switchViewer(requiredActorID, (state) =>
            this.receiveState(state),
          );
        } else {
          this.render();
        }
      },
      COLORS.red,
    );
  }

  private drawGeneralCandidates(
    G: TqsPlayerViewState,
    candidates: string[],
    y: number,
  ): void {
    this.addText("Chọn Võ Tướng", 34, y, 16, COLORS.paperDark, 0, "left");
    const viewer = G.players[this.match!.currentViewerID];
    const includesLordSkill =
      viewer.role === "lord" && candidates.some(hasLordSkill);
    const buttonGap = 8;
    const availableWidth = this.viewportWidth - 68;
    const buttonWidth = Math.min(
      180,
      (availableWidth - buttonGap * (candidates.length - 1)) /
        candidates.length,
    );
    candidates.forEach((generalID, index) => {
      const general = GENERALS_BY_ID[generalID];
      const lordSkillLabel = hasLordSkill(generalID)
        ? viewer.role === "lord"
          ? "\nChủ Công Kỹ"
          : ""
        : "";
      const x = 34 + index * (buttonWidth + buttonGap);
      this.addButton(
        `${general.name}\nThể Lực ${general.maxHP}${lordSkillLabel}`,
        x + buttonWidth / 2,
        y + (includesLordSkill ? 88 : 68),
        buttonWidth,
        70,
        () => this.match!.move("selectGeneral", generalID),
        COLORS.red,
        COLORS.paper,
        false,
        { fontSize: 14, fontWeight: "700", paddingX: 12, paddingY: 10 },
      );
    });
    void G;
  }

  private drawActions(G: TqsPlayerViewState, viewerID: PlayerID): void {
    const prompt = G.prompt;

    if (prompt?.responderID === viewerID) {
      this.drawPromptActions(G, prompt as Exclude<typeof prompt, null>);
      return;
    }

    if (G.status !== "playing" || G.turn.activePlayerID !== viewerID || prompt)
      return;

    if (G.turn.step === "play") {
      const selectedCardIDs = [...this.selectedCardIDs];
      const selectedCardID = selectedCardIDs[0];
      const viewer = G.players[viewerID];
      const viewerWeaponID = viewer.equipment.weapon;
      const usedSkills = viewer.skillsUsedThisTurn;
      const othersAlive = G.seatOrder.some(
        (id) => id !== viewerID && G.players[id].alive,
      );
      const anyWounded = G.seatOrder.some(
        (id) => G.players[id].alive && G.players[id].hp < G.players[id].maxHP,
      );
      const skillBar = (
        [
          {
            id: "zhi-heng" as const,
            label: "【Chế Hành】",
            enabled: !usedSkills.includes("zhi-heng") && viewer.hand.length > 0,
          },
          {
            id: "ku-rou" as const,
            label: "【Khổ Nhục】",
            enabled: !usedSkills.includes("ku-rou") && viewer.hp > 1,
          },
          {
            id: "qing-nang" as const,
            label: "【Thanh Nang】",
            enabled:
              !usedSkills.includes("qing-nang") &&
              viewer.hand.length > 0 &&
              anyWounded,
          },
          {
            id: "ren-de" as const,
            label: "【Nhân Đức】",
            enabled:
              !usedSkills.includes("ren-de") &&
              viewer.hand.length > 0 &&
              othersAlive,
          },
          {
            id: "jie-yin" as const,
            label: "【Kết Nhân】",
            enabled:
              !usedSkills.includes("jie-yin") &&
              viewer.hand.length >= 2 &&
              G.seatOrder.some(
                (id) =>
                  id !== viewerID &&
                  G.players[id].alive &&
                  G.players[id].hp < G.players[id].maxHP &&
                  GENERALS_BY_ID[G.players[id].generalID!]?.gender === "male",
              ),
          },
          {
            id: "li-jian" as const,
            label: "【Ly Gián】",
            enabled:
              !usedSkills.includes("li-jian") &&
              viewer.hand.length > 0 &&
              G.seatOrder.filter(
                (id) =>
                  id !== viewerID &&
                  G.players[id].alive &&
                  GENERALS_BY_ID[G.players[id].generalID!]?.gender === "male",
              ).length >= 2,
          },
          {
            id: "fan-jian" as const,
            label: "【Phản Gián】",
            enabled:
              !usedSkills.includes("fan-jian") &&
              viewer.hand.length > 0 &&
              othersAlive,
          },
        ] as const
      ).filter((skill) => skill.enabled);
      if (
        this.pendingSkill &&
        !skillBar.some((skill) => this.pendingSkill === skill.id)
      )
        this.pendingSkill = null;
      const conversions =
        !this.pendingSkill && selectedCardID
          ? getVirtualConversions(G, viewerID, selectedCardID)
          : [];
      if (this.virtualAs && !conversions.includes(this.virtualAs))
        this.virtualAs = null;
      const canToggleSpear =
        !this.pendingSkill &&
        !this.virtualAs &&
        viewerWeaponID !== undefined &&
        G.cards[viewerWeaponID]?.definitionID === "serpent-spear";
      if (skillBar.length > 0) {
        const barWidth = Math.min(
          150,
          (this.viewportWidth - 68) / skillBar.length,
        );
        skillBar.forEach((skill, index) => {
          const active = this.pendingSkill === skill.id;
          this.addButton(
            skill.label,
            34 + barWidth / 2 + index * barWidth,
            this.viewportHeight - 122,
            barWidth - 6,
            40,
            () => {
              if (skill.id === "ku-rou") {
                this.match!.move("useSkill", "ku-rou");
                return;
              }
              this.pendingSkill = active ? null : skill.id;
              this.selectedCardIDs.clear();
              this.selectedTargetIDs = [];
              this.serpentSpearMode = false;
              this.virtualAs = null;
              this.render();
            },
            active ? COLORS.redBright : COLORS.ink,
          );
        });
      }
      const actionRow = layoutActionRow(
        this.viewportWidth,
        this.viewportHeight,
        [
          ...(conversions.length > 0 ? [150] : []),
          ...(canToggleSpear ? [184] : []),
          180,
          190,
        ],
      );
      let playActionIndex = 0;
      if (conversions.length > 0) {
        const conversionIndex = playActionIndex++;
        this.addButton(
          `Làm 【${CARD_DEFINITIONS[this.virtualAs ?? conversions[0]].name}】`,
          actionRow.centers[conversionIndex],
          actionRow.centerY,
          actionRow.widths[conversionIndex],
          48,
          () => {
            if (!this.virtualAs) {
              this.virtualAs = conversions[0];
            } else {
              const currentIndex = conversions.indexOf(this.virtualAs);
              this.virtualAs =
                currentIndex + 1 < conversions.length
                  ? conversions[currentIndex + 1]
                  : null;
            }
            this.selectedTargetIDs = [];
            this.render();
          },
          this.virtualAs ? COLORS.redBright : COLORS.ink,
        );
      }
      const spearIndex = canToggleSpear ? playActionIndex++ : -1;
      const useSerpentSpear =
        spearIndex >= 0 &&
        this.serpentSpearMode &&
        selectedCardIDs.length === 2;
      const virtualDefinition =
        this.virtualAs === "slash"
          ? CARD_DEFINITIONS.slash
          : this.virtualAs === "snatch"
            ? CARD_DEFINITIONS.snatch
            : this.virtualAs === "indulgence"
              ? CARD_DEFINITIONS.indulgence
              : undefined;
      const definition =
        virtualDefinition ??
        (useSerpentSpear
          ? CARD_DEFINITIONS.slash
          : selectedCardID
            ? CARD_DEFINITIONS[G.cards[selectedCardID]?.definitionID]
            : undefined);
      const viewerWeapon = viewerWeaponID
        ? G.cards[viewerWeaponID]?.definitionID
        : undefined;
      const slashAvailable =
        definition?.id !== "slash" ||
        viewerWeapon === "crossbow" ||
        G.players[viewerID].slashUses === 0;
      const lightningAvailable =
        definition?.id !== "lightning" ||
        !G.players[viewerID].judgement.some(
          (cardID) => G.cards[cardID]?.definitionID === "lightning",
        );
      const targetCount = this.targetRequirement(definition);
      const skillTargetCount =
        this.pendingSkill === "zhi-heng"
          ? { minimum: 0, maximum: 0 }
          : this.pendingSkill === "li-jian"
            ? { minimum: 2, maximum: 2 }
            : this.pendingSkill
              ? { minimum: 1, maximum: 1 }
              : null;
      const effectiveTargetCount = skillTargetCount ?? targetCount;
      const hasTargets =
        this.selectedTargetIDs.length >= effectiveTargetCount.minimum &&
        this.selectedTargetIDs.length <= effectiveTargetCount.maximum;
      const skillTargetID = this.selectedTargetIDs[0];
      const requiredCards =
        this.pendingSkill === "jie-yin" ? 2 : this.pendingSkill ? 1 : 0;
      const skillReady = !this.pendingSkill
        ? null
        : this.selectedCardIDs.size >= requiredCards &&
          this.selectedTargetIDs.length >= effectiveTargetCount.minimum &&
          (this.pendingSkill !== "qing-nang" ||
            (Boolean(G.players[skillTargetID]) &&
              G.players[skillTargetID].hp < G.players[skillTargetID].maxHP)) &&
          (this.pendingSkill !== "ren-de" ||
            (this.selectedTargetIDs.length === 1 &&
              skillTargetID !== viewerID));
      const proactivelyPlayable =
        definition !== undefined &&
        definition.id !== "dodge" &&
        definition.id !== "nullification" &&
        !(
          definition.id === "peach" &&
          G.players[viewerID].hp >= G.players[viewerID].maxHP
        ) &&
        slashAvailable &&
        lightningAvailable;
      const useDisabled =
        this.pendingSkill !== null
          ? !skillReady
          : !proactivelyPlayable || !hasTargets;
      this.addButton(
        this.pendingSkill
          ? `Xác nhận 【${
              {
                "zhi-heng": "Chế Hành",
                "qing-nang": "Thanh Nang",
                "ren-de": "Nhân Đức",
                "jie-yin": "Kết Nhân",
                "li-jian": "Ly Gián",
                "fan-jian": "Phản Gián",
              }[this.pendingSkill]
            }】`
          : useSerpentSpear
            ? "Dùng Xà Mâu làm 【Sát】"
            : "Sử dụng",
        actionRow.centers[playActionIndex],
        actionRow.centerY,
        actionRow.widths[playActionIndex],
        48,
        () => {
          if (this.pendingSkill) {
            if (this.pendingSkill === "zhi-heng")
              this.match!.move("useSkill", "zhi-heng", [
                ...this.selectedCardIDs,
              ]);
            else if (this.pendingSkill === "qing-nang")
              this.match!.move("useSkill", "qing-nang", {
                cardID: selectedCardID,
                targetID: skillTargetID,
              });
            else if (this.pendingSkill === "ren-de")
              this.match!.move("useSkill", "ren-de", {
                cardIDs: [...this.selectedCardIDs],
                targetID: skillTargetID,
              });
            else if (this.pendingSkill === "jie-yin")
              this.match!.move("useSkill", "jie-yin", {
                cardIDs: [...this.selectedCardIDs],
                targetID: skillTargetID,
              });
            else if (this.pendingSkill === "li-jian")
              this.match!.move("useSkill", "li-jian", {
                cardID: selectedCardID,
                firstID: this.selectedTargetIDs[0],
                secondID: this.selectedTargetIDs[1],
              });
            else
              this.match!.move("useSkill", "fan-jian", {
                targetID: skillTargetID,
              });
          } else {
            this.match!.move(
              "playCard",
              useSerpentSpear
                ? {
                    kind: "serpent-spear",
                    cardIDs: [selectedCardIDs[0], selectedCardIDs[1]],
                    targetIDs: [...this.selectedTargetIDs],
                  }
                : this.virtualAs && selectedCardID
                  ? {
                      kind: "virtual",
                      cardID: selectedCardID,
                      as: this.virtualAs,
                      targetIDs: [...this.selectedTargetIDs],
                    }
                  : {
                      kind: "physical",
                      cardID: selectedCardID,
                      targetIDs: [...this.selectedTargetIDs],
                    },
            );
          }
          this.selectedCardIDs.clear();
          this.selectedTargetIDs = [];
          this.serpentSpearMode = false;
          this.virtualAs = null;
          this.pendingSkill = null;
        },
        COLORS.red,
        COLORS.white,
        useDisabled,
      );
      if (spearIndex >= 0) {
        this.addButton(
          this.serpentSpearMode ? "Hủy chế độ Xà Mâu" : "Chế độ Xà Mâu",
          actionRow.centers[spearIndex],
          actionRow.centerY,
          actionRow.widths[spearIndex],
          48,
          () => {
            this.serpentSpearMode = !this.serpentSpearMode;
            this.selectedCardIDs.clear();
            this.selectedTargetIDs = [];
            this.render();
          },
          this.serpentSpearMode ? COLORS.redBright : COLORS.ink,
        );
      }
      this.addButton(
        "Kết thúc Xuất Bài",
        actionRow.centers[playActionIndex + 1],
        actionRow.centerY,
        actionRow.widths[playActionIndex + 1],
        48,
        () => {
          this.serpentSpearMode = false;
          this.virtualAs = null;
          this.pendingSkill = null;
          this.match!.move("endPlayPhase");
        },
        COLORS.ink,
      );
      if (this.pendingSkill) {
        const instructions: Record<string, string> = {
          "zhi-heng":
            "Chọn các lá muốn bỏ rồi xác nhận; sẽ rút lại đúng số lá đó.",
          "qing-nang":
            "Chọn 1 lá trên tay và 1 nhân vật đang tổn thất Thể Lực.",
          "ren-de": "Chọn các lá muốn đưa và 1 người chơi khác.",
          "jie-yin": "Chọn 2 lá tay và 1 nam đang tổn thất Thể Lực.",
          "li-jian": "Chọn 1 lá và 2 Võ Tướng nam (thứ tự ra 【Sát】).",
          "fan-jian": "Chọn 1 người chơi khác để bốc màu của họ.",
        };
        this.addText(
          instructions[this.pendingSkill],
          34,
          actionRow.centerY - 8,
          13,
          COLORS.muted,
          0,
          "left",
        );
        return;
      }
      if (definition) {
        let instruction = targetCount.instruction;
        if (definition.id === "dodge" || definition.id === "nullification")
          instruction = "Lá này chỉ được sử dụng khi có yêu cầu phản hồi.";
        else if (definition.id === "slash" && !slashAvailable)
          instruction =
            "Lượt này đã sử dụng 【Sát】. Cần Gia Cát Liên Nỗ để dùng thêm.";
        else if (definition.id === "lightning" && !lightningAvailable)
          instruction = "Vùng Phán Xét đã có 【Thiểm Điện】.";
        else if (
          definition.id === "peach" &&
          G.players[viewerID].hp >= G.players[viewerID].maxHP
        )
          instruction = "Chỉ có thể dùng 【Đào】 khi đã tổn thất Thể Lực.";
        this.addText(
          instruction,
          34,
          actionRow.centerY - 8,
          13,
          COLORS.muted,
          0,
          "left",
        );
      }
      return;
    }

    if (G.turn.step === "discard") {
      const canResumePlay = !G.turn.skippedSteps.includes("play");
      const actionRow = layoutActionRow(
        this.viewportWidth,
        this.viewportHeight,
        canResumePlay ? [190, 220] : [220],
      );
      const required =
        G.players[viewerID].hand.length - Math.max(0, G.players[viewerID].hp);
      this.addText(
        `Cần bỏ: ${required} lá · Đã chọn: ${this.selectedCardIDs.size} lá`,
        34,
        actionRow.centerY - 8,
        14,
        COLORS.paperDark,
        0,
        "left",
      );
      if (canResumePlay)
        this.addButton(
          "Quay lại Xuất Bài",
          actionRow.centers[0],
          actionRow.centerY,
          actionRow.widths[0],
          48,
          () => {
            this.selectedCardIDs.clear();
            this.match!.move("resumePlayPhase");
          },
          COLORS.ink,
        );
      this.addButton(
        "Xác nhận bỏ bài",
        actionRow.centers[canResumePlay ? 1 : 0],
        actionRow.centerY,
        actionRow.widths[canResumePlay ? 1 : 0],
        48,
        () => this.match!.move("discardCards", [...this.selectedCardIDs]),
        COLORS.red,
        COLORS.white,
        this.selectedCardIDs.size !== required,
      );
      return;
    }
  }

  private targetRequirement(definition?: CardDefinition): {
    minimum: number;
    maximum: number;
    instruction: string;
  } {
    if (!definition) return { minimum: 0, maximum: 0, instruction: "" };
    if (
      definition.kind === "equipment" ||
      [
        "peach",
        "ex-nihilo",
        "lightning",
        "arrow-barrage",
        "barbarian-invasion",
        "peach-garden",
        "harvest",
      ].includes(definition.id)
    )
      return {
        minimum: 0,
        maximum: 0,
        instruction: "Không cần chọn mục tiêu.",
      };
    if (definition.id === "borrowed-sword")
      return {
        minimum: 2,
        maximum: 2,
        instruction:
          "Chọn người có Vũ Khí trước, sau đó chọn mục tiêu của 【Sát】.",
      };
    if (definition.id === "slash") {
      const G = this.state!.G;
      const viewer = G.players[this.match!.currentViewerID];
      const hasHalberd = viewer.equipment.weapon
        ? G.cards[viewer.equipment.weapon]?.definitionID === "halberd"
        : false;
      const selectedMaterialCount = this.selectedCardIDs.size;
      const maximum =
        hasHalberd && viewer.hand.length === selectedMaterialCount ? 3 : 1;
      return {
        minimum: 1,
        maximum,
        instruction:
          maximum > 1
            ? `Chọn từ 1 đến ${maximum} mục tiêu theo thứ tự.`
            : "Chọn 1 mục tiêu trong Phạm Vi Công Kích.",
      };
    }
    return { minimum: 1, maximum: 1, instruction: "Chọn 1 mục tiêu." };
  }

  private maximumTargets(G: TqsPlayerViewState): number {
    if (G.prompt) return 0;
    if (this.pendingSkill === "zhi-heng") return 0;
    if (this.pendingSkill === "li-jian") return 2;
    if (this.pendingSkill) return 1;
    const selectedCardIDs = [...this.selectedCardIDs];
    const selectedCardID = selectedCardIDs[0];
    const viewer = G.players[this.match!.currentViewerID];
    const useSerpentSpear =
      this.serpentSpearMode &&
      selectedCardIDs.length === 2 &&
      viewer.equipment.weapon !== undefined &&
      G.cards[viewer.equipment.weapon]?.definitionID === "serpent-spear";
    const definition = this.virtualAs
      ? CARD_DEFINITIONS[this.virtualAs]
      : useSerpentSpear
        ? CARD_DEFINITIONS.slash
        : selectedCardID
          ? CARD_DEFINITIONS[G.cards[selectedCardID]?.definitionID]
          : undefined;
    return this.targetRequirement(definition).maximum;
  }

  private canSelectTarget(
    G: TqsPlayerViewState,
    candidateID: PlayerID,
  ): boolean {
    if (
      G.prompt ||
      G.status !== "playing" ||
      G.turn.step !== "play" ||
      G.turn.activePlayerID !== this.match!.currentViewerID
    )
      return false;
    if (this.pendingSkill === "zhi-heng") return false;
    if (this.pendingSkill === "fan-jian")
      return (
        candidateID !== this.match!.currentViewerID &&
        !this.selectedTargetIDs.includes(candidateID)
      );
    if (this.pendingSkill === "li-jian") {
      const general = GENERALS_BY_ID[G.players[candidateID].generalID!];
      return (
        candidateID !== this.match!.currentViewerID &&
        general?.gender === "male" &&
        !this.selectedTargetIDs.includes(candidateID)
      );
    }
    if (this.pendingSkill === "jie-yin") {
      const player = G.players[candidateID];
      const general = GENERALS_BY_ID[player.generalID!];
      return (
        candidateID !== this.match!.currentViewerID &&
        general?.gender === "male" &&
        player.hp < player.maxHP
      );
    }
    if (this.pendingSkill === "qing-nang")
      return (
        G.players[candidateID].hp < G.players[candidateID].maxHP &&
        !this.selectedTargetIDs.includes(candidateID)
      );
    if (this.pendingSkill === "ren-de")
      return (
        candidateID !== this.match!.currentViewerID &&
        !this.selectedTargetIDs.includes(candidateID)
      );
    const selectedCardIDs = [...this.selectedCardIDs];
    const viewerID = this.match!.currentViewerID;
    const viewer = G.players[viewerID];
    const useSerpentSpear =
      this.serpentSpearMode &&
      selectedCardIDs.length === 2 &&
      viewer.equipment.weapon !== undefined &&
      G.cards[viewer.equipment.weapon]?.definitionID === "serpent-spear";
    const cardName = this.virtualAs
      ? this.virtualAs
      : useSerpentSpear
        ? "slash"
        : selectedCardIDs[0]
          ? G.cards[selectedCardIDs[0]]?.definitionID
          : undefined;
    if (!cardName) return false;
    return canSelectCardTarget(
      G,
      viewerID,
      cardName,
      this.selectedTargetIDs,
      candidateID,
    );
  }

  private drawPromptActions(
    G: TqsPlayerViewState,
    prompt: NonNullable<TqsPlayerViewState["prompt"]>,
  ): void {
    if (prompt.kind === "card-response") {
      this.drawCardResponsePrompt(G, prompt);
      return;
    }
    if (prompt.kind === "option") {
      if (prompt.reason === "fan-jian-suit") {
        const suitLabels: Record<string, string> = {
          heart: "♥ Hồng Đào",
          diamond: "♦ Kim Cương",
          club: "♣ Mai Hoa",
          spade: "♠ Hắc Đào",
        };
        const row = layoutActionRow(
          this.viewportWidth,
          this.viewportHeight,
          [150, 150, 150, 150],
        );
        prompt.choices.forEach((choice, index) => {
          this.addButton(
            suitLabels[choice] ?? choice,
            row.centers[index],
            row.centerY,
            row.widths[index],
            48,
            () => this.answerPrompt(prompt.id, { kind: "option", choice }),
            COLORS.ink,
          );
        });
        return;
      }
      if (prompt.reason === "gender-swords-target") {
        const actionRow = layoutActionRow(
          this.viewportWidth,
          this.viewportHeight,
          [180, 220],
        );
        this.addButton(
          "Bỏ 1 lá trên tay",
          actionRow.centers[0],
          actionRow.centerY,
          actionRow.widths[0],
          48,
          () =>
            this.answerPrompt(prompt.id, { kind: "option", choice: "discard" }),
          COLORS.red,
        );
        this.addButton(
          "Để đối phương rút 1 lá",
          actionRow.centers[1],
          actionRow.centerY,
          actionRow.widths[1],
          48,
          () =>
            this.answerPrompt(prompt.id, { kind: "option", choice: "draw" }),
          COLORS.ink,
        );
        return;
      }
      if (prompt.reason === "yao-wu") {
        const labels: Record<string, string> = {
          recover: "Hồi phục 1 Thể Lực",
          draw: "Rút 1 lá",
        };
        const actionRow = layoutActionRow(
          this.viewportWidth,
          this.viewportHeight,
          prompt.choices.map(() => 200),
        );
        prompt.choices.forEach((choice, index) => {
          this.addButton(
            labels[choice] ?? choice,
            actionRow.centers[index],
            actionRow.centerY,
            actionRow.widths[index],
            48,
            () => this.answerPrompt(prompt.id, { kind: "option", choice }),
            choice === "recover" ? COLORS.red : COLORS.ink,
          );
        });
        return;
      }
      const actionRow = layoutActionRow(
        this.viewportWidth,
        this.viewportHeight,
        [180, 160],
      );
      this.addButton(
        this.optionActivateLabel(prompt.reason),
        actionRow.centers[0],
        actionRow.centerY,
        actionRow.widths[0],
        48,
        () =>
          this.answerPrompt(prompt.id, { kind: "option", choice: "activate" }),
        COLORS.red,
      );
      this.addButton(
        this.optionDeclineLabel(prompt.reason),
        actionRow.centers[1],
        actionRow.centerY,
        actionRow.widths[1],
        48,
        () =>
          this.answerPrompt(prompt.id, { kind: "option", choice: "decline" }),
        COLORS.ink,
      );
      return;
    }
    if (prompt.kind === "select-cards") {
      this.drawZoneSelection(G, prompt);
      return;
    }
    if (prompt.kind === "choose-players") {
      this.drawChoosePlayers(G, prompt);
      return;
    }
    if (prompt.kind === "harvest-choice") {
      this.drawHarvestSelection(G, prompt);
    }
  }

  private drawChoosePlayers(
    G: TqsPlayerViewState,
    prompt: Extract<
      NonNullable<TqsPlayerViewState["prompt"]>,
      { kind: "choose-players" }
    >,
  ): void {
    const y = this.viewportHeight - 154;
    const width = Math.min(
      120,
      (this.viewportWidth - 68) / Math.max(1, prompt.candidates.length),
    );
    this.addText(
      `Đột Tập: chọn từ ${prompt.minimum} đến ${prompt.maximum} người chơi`,
      this.viewportWidth / 2,
      y - 40,
      13,
      COLORS.paperDark,
    );
    prompt.candidates.forEach((playerID, index) => {
      const selected = this.selectedPromptPlayerIDs.includes(playerID);
      const canToggle =
        selected || this.selectedPromptPlayerIDs.length < prompt.maximum;
      this.addButton(
        `P${G.players[playerID].seat + 1}`,
        34 + width / 2 + index * width,
        y,
        width - 6,
        54,
        () => {
          if (selected)
            this.selectedPromptPlayerIDs = this.selectedPromptPlayerIDs.filter(
              (id) => id !== playerID,
            );
          else if (canToggle) this.selectedPromptPlayerIDs.push(playerID);
          this.render();
        },
        selected ? COLORS.redBright : COLORS.ink,
      );
    });
    const actionRow = layoutActionRow(
      this.viewportWidth,
      this.viewportHeight,
      [180, 150],
    );
    this.addButton(
      "Xác nhận",
      actionRow.centers[0],
      actionRow.centerY,
      actionRow.widths[0],
      48,
      () =>
        this.answerPrompt(prompt.id, {
          kind: "players",
          playerIDs: [...this.selectedPromptPlayerIDs],
        }),
      COLORS.red,
      COLORS.white,
      this.selectedPromptPlayerIDs.length < prompt.minimum,
    );
    if (prompt.minimum === 0)
      this.addButton(
        "Bỏ qua",
        actionRow.centers[1],
        actionRow.centerY,
        actionRow.widths[1],
        48,
        () => this.answerPrompt(prompt.id, { kind: "pass" }),
        COLORS.ink,
      );
  }

  private drawCardResponsePrompt(
    G: TqsPlayerViewState,
    prompt: CardResponsePrompt,
  ): void {
    const selectedCardIDs = [...this.selectedCardIDs];
    const selectedCardID = selectedCardIDs[0];
    const canUsePhysical =
      Boolean(selectedCardID) &&
      !prompt.forbidCard &&
      canRespondWithCard(
        G,
        prompt.responderID,
        selectedCardID,
        prompt.response,
      );
    const canUseSpear =
      prompt.allowSerpentSpear && selectedCardIDs.length === 2;
    const widths = [
      180,
      ...(prompt.allowBagua ? [170] : []),
      ...(prompt.summonFaction ? [180] : []),
      160,
    ];
    const actionRow = layoutActionRow(
      this.viewportWidth,
      this.viewportHeight,
      widths,
    );
    let actionIndex = 0;
    const responseIndex = actionIndex++;
    this.addButton(
      canUseSpear
        ? "Dùng Xà Mâu (2 lá)"
        : prompt.response === "nullification"
          ? "Dùng 【Vô Giải】"
          : `Dùng 【${CARD_DEFINITIONS[prompt.response].name}】`,
      actionRow.centers[responseIndex],
      actionRow.centerY,
      actionRow.widths[responseIndex],
      48,
      () =>
        this.answerPrompt(
          prompt.id,
          canUseSpear
            ? {
                kind: "serpent-spear",
                cardIDs: [selectedCardIDs[0], selectedCardIDs[1]],
              }
            : { kind: "card", cardID: selectedCardID },
        ),
      COLORS.red,
      COLORS.white,
      !canUsePhysical && !canUseSpear,
    );
    if (prompt.allowBagua) {
      const baguaIndex = actionIndex++;
      this.addButton(
        "Kích hoạt Bát Quái",
        actionRow.centers[baguaIndex],
        actionRow.centerY,
        actionRow.widths[baguaIndex],
        48,
        () => this.answerPrompt(prompt.id, { kind: "bagua" }),
        COLORS.ink,
      );
    }
    if (prompt.summonFaction) {
      const summonIndex = actionIndex++;
      this.addButton(
        prompt.summonFaction === "wei"
          ? "【Hộ Giá】 hỏi Ngụy tướng"
          : "【Kích Tướng】 hỏi Thục tướng",
        actionRow.centers[summonIndex],
        actionRow.centerY,
        actionRow.widths[summonIndex],
        48,
        () => this.answerPrompt(prompt.id, { kind: "summon" }),
        COLORS.green,
      );
    }
    this.addButton(
      this.responsePassLabel(prompt),
      actionRow.centers[actionIndex],
      actionRow.centerY,
      actionRow.widths[actionIndex],
      48,
      () => this.answerPrompt(prompt.id, { kind: "pass" }),
      COLORS.ink,
      COLORS.paper,
      !prompt.allowPass,
    );
  }

  private responsePassLabel(prompt: CardResponsePrompt): string {
    if (prompt.reason === "rescue") return "Không cứu";
    if (prompt.reason === "borrowed-sword") return "Giao Vũ Khí";
    if (prompt.response === "slash") return "Không đánh ra 【Sát】";
    if (prompt.response === "dodge") return "Không dùng 【Thiểm】";
    return "Bỏ qua";
  }

  private optionActivateLabel(
    reason: Extract<
      NonNullable<TqsPlayerViewState["prompt"]>,
      { kind: "option" }
    >["reason"],
  ): string {
    const labels: Record<string, string> = {
      "gender-swords": "Kích hoạt Thư Hùng",
      "ice-sword": "Kích hoạt Hàn Băng",
      "rock-cleaving-axe": "Bỏ 2 lá dùng Quán Thạch",
      "green-dragon-blade": "Dùng thêm 【Sát】",
      "qilin-bow": "Bỏ 1 Tọa Kỵ",
      "fan-kui": "【Phản Quỹ】 lấy lá của nguồn sát thương",
      "gui-cai": "【Quỷ Tài】 thay lá phán xét bằng 1 lá tay",
      "tu-xi": "【Đột Tập】 lấy bài tay người khác thay vì rút",
      "lian-ying": "【Liên Doanh】 rút 1 lá",
      "xiao-ji": "【Kiêu Cơ】 rút 2 lá",
      "luo-yi": "【Lõa Y】 rút ít 1 lá, tăng sát thương lượt này",
      "jian-xiong": "【Gian Hùng】 nhận lá gây sát thương",
      "tie-ji": "【Thiết Kỵ】 phán xét, lá đỏ khóa 【Thiểm】",
      "liu-li": "【Lưu Ly】 bỏ 1 lá, chuyển 【Sát】 cho người khác",
      "guan-xing": "【Quan Tinh】 sắp bài đầu Chồng Bài Rút",
      "wang-zun": "【Vọng Tôn】 rút 1 lá, giới hạn tay Chủ Công -1",
      "luo-shen": "【Lạc Thần】 tiến hành Phán Xét",
      "bi-yue": "【Bế Nguyệt】 rút 1 lá",
      "ke-ji": "【Khắc Kỷ】 bỏ qua Giai Đoạn Bỏ Bài",
      "ji-zhi": "【Tập Trí】 rút 1 lá",
    };
    return labels[reason] ?? "Kích hoạt";
  }

  private optionDeclineLabel(
    reason: Extract<
      NonNullable<TqsPlayerViewState["prompt"]>,
      { kind: "option" }
    >["reason"],
  ): string {
    if (reason === "ice-sword") return "Gây Sát Thương";
    if (reason === "guan-xing") return "Giữ nguyên thứ tự";
    return "Bỏ qua";
  }

  private drawZoneSelection(
    G: TqsPlayerViewState,
    prompt: Extract<
      NonNullable<TqsPlayerViewState["prompt"]>,
      { kind: "select-cards" }
    >,
  ): void {
    const owner = G.players[prompt.ownerID];
    const choices: Array<{ label: string; choice: ZoneCardChoice }> = [];
    if (prompt.zones.includes("hand")) {
      owner.hand.forEach((cardID, handIndex) => {
        const card = G.cards[cardID];
        choices.push({
          label: card
            ? `【${CARD_DEFINITIONS[card.definitionID].name}】`
            : `Lá úp ${handIndex + 1}`,
          choice: { zone: "hand", ownerID: prompt.ownerID, handIndex },
        });
      });
    }
    if (prompt.zones.includes("equipment")) {
      getEquipmentSlotViews(G.cards, owner.equipment)
        .filter(
          (slot) =>
            slot.cardID &&
            (prompt.reason !== "qilin-bow" ||
              slot.slot === "offensive-mount" ||
              slot.slot === "defensive-mount"),
        )
        .forEach((slot) =>
          choices.push({
            label: slot.cardLabel,
            choice: {
              zone: "equipment",
              ownerID: prompt.ownerID,
              slot: slot.slot,
            },
          }),
        );
    }
    if (prompt.zones.includes("judgement")) {
      owner.judgement.forEach((cardID) => {
        const card = G.cards[cardID];
        choices.push({
          label: `【${CARD_DEFINITIONS[card.definitionID].name}】`,
          choice: { zone: "judgement", ownerID: prompt.ownerID, cardID },
        });
      });
    }
    if (prompt.zones.includes("processing")) {
      G.processing.forEach((cardID) => {
        const card = G.cards[cardID];
        if (!card) return;
        choices.push({
          label: `【${CARD_DEFINITIONS[card.definitionID].name}】\n${SUIT_LABELS[card.suit]} ${card.rank}`,
          choice: { zone: "processing", cardID },
        });
      });
    }

    const y = this.viewportHeight - 154;
    const perPage = 6;
    const pageCount = Math.max(1, Math.ceil(choices.length / perPage));
    this.promptPage = Math.min(this.promptPage, pageCount - 1);
    const visibleChoices = choices.slice(
      this.promptPage * perPage,
      (this.promptPage + 1) * perPage,
    );
    const width = Math.min(
      150,
      (this.viewportWidth - 68) / Math.max(1, visibleChoices.length),
    );
    visibleChoices.forEach(({ label, choice }, index) => {
      const selectedIndex = this.selectedZoneChoices.findIndex(
        (selected) => JSON.stringify(selected) === JSON.stringify(choice),
      );
      this.addButton(
        label,
        34 + width / 2 + index * width,
        y,
        width - 6,
        54,
        () => {
          if (selectedIndex >= 0)
            this.selectedZoneChoices.splice(selectedIndex, 1);
          else if (this.selectedZoneChoices.length < prompt.maximum)
            this.selectedZoneChoices.push(choice);
          this.render();
        },
        selectedIndex >= 0 ? COLORS.redBright : COLORS.ink,
      );
    });
    if (pageCount > 1)
      this.drawPager(y + 38, this.promptPage, pageCount, (page) => {
        this.promptPage = page;
        this.render();
      });
    const actionRow = layoutActionRow(
      this.viewportWidth,
      this.viewportHeight,
      prompt.allowPass ? [180, 150] : [180],
    );
    this.addButton(
      "Xác nhận",
      actionRow.centers[0],
      actionRow.centerY,
      actionRow.widths[0],
      48,
      () =>
        this.answerPrompt(prompt.id, {
          kind: "zone-cards",
          choices: [...this.selectedZoneChoices],
        }),
      COLORS.red,
      COLORS.white,
      this.selectedZoneChoices.length < prompt.minimum ||
        this.selectedZoneChoices.length > prompt.maximum,
    );
    if (prompt.allowPass)
      this.addButton(
        "Bỏ qua",
        actionRow.centers[1],
        actionRow.centerY,
        actionRow.widths[1],
        48,
        () => this.answerPrompt(prompt.id, { kind: "pass" }),
        COLORS.ink,
      );
  }

  private drawHarvestSelection(
    G: TqsPlayerViewState,
    prompt: Extract<
      NonNullable<TqsPlayerViewState["prompt"]>,
      { kind: "harvest-choice" }
    >,
  ): void {
    const y = this.viewportHeight - 154;
    const perPage = 6;
    const pageCount = Math.max(
      1,
      Math.ceil(prompt.availableCardIDs.length / perPage),
    );
    this.promptPage = Math.min(this.promptPage, pageCount - 1);
    const visibleCardIDs = prompt.availableCardIDs.slice(
      this.promptPage * perPage,
      (this.promptPage + 1) * perPage,
    );
    const width = Math.min(
      150,
      (this.viewportWidth - 68) / Math.max(1, visibleCardIDs.length),
    );
    visibleCardIDs.forEach((cardID, index) => {
      const card = G.cards[cardID];
      const selected = this.selectedCardIDs.has(cardID);
      this.addButton(
        `【${CARD_DEFINITIONS[card.definitionID].name}】\n${SUIT_LABELS[card.suit]} ${card.rank}`,
        34 + width / 2 + index * width,
        y,
        width - 6,
        60,
        () => {
          this.selectedCardIDs = selected ? new Set() : new Set([cardID]);
          this.render();
        },
        selected ? COLORS.redBright : COLORS.paperDark,
        selected ? COLORS.white : COLORS.ink,
      );
    });
    if (pageCount > 1)
      this.drawPager(y + 42, this.promptPage, pageCount, (page) => {
        this.promptPage = page;
        this.render();
      });
    const selectedID = [...this.selectedCardIDs].find((cardID) =>
      prompt.availableCardIDs.includes(cardID),
    );
    const actionRow = layoutActionRow(
      this.viewportWidth,
      this.viewportHeight,
      [180],
    );
    this.addButton(
      "Nhận lá đã chọn",
      actionRow.centers[0],
      actionRow.centerY,
      actionRow.widths[0],
      48,
      () => {
        if (selectedID)
          this.answerPrompt(prompt.id, { kind: "harvest", cardID: selectedID });
      },
      COLORS.red,
      COLORS.white,
      !selectedID,
    );
  }

  private answerPrompt(promptID: number, answer: PromptAnswer): void {
    this.match!.move("answerPrompt", promptID, answer);
    this.selectedCardIDs.clear();
    this.selectedTargetIDs = [];
    this.selectedZoneChoices = [];
    this.selectedPromptPlayerIDs = [];
    this.serpentSpearMode = false;
    this.virtualAs = null;
    this.pendingSkill = null;
  }

  private drawPager(
    y: number,
    page: number,
    pageCount: number,
    onChange: (page: number) => void,
    centerX = this.viewportWidth / 2,
  ): void {
    this.addButton(
      "‹",
      centerX - 58,
      y,
      42,
      30,
      () => onChange(Math.max(0, page - 1)),
      COLORS.ink,
      COLORS.paper,
      page === 0,
    );
    this.addText(`${page + 1}/${pageCount}`, centerX, y, 11, COLORS.paperDark);
    this.addButton(
      "›",
      centerX + 58,
      y,
      42,
      30,
      () => onChange(Math.min(pageCount - 1, page + 1)),
      COLORS.ink,
      COLORS.paper,
      page === pageCount - 1,
    );
  }

  private promptStatus(G: TqsPlayerViewState, responder: string): string {
    const prompt = G.prompt;
    if (!prompt) return "";
    if (prompt.kind === "card-response") {
      if (prompt.reason === "rescue")
        return `Đang chờ ${responder} cứu ${this.generalName(G, prompt.targetID)}.`;
      if (prompt.reason === "nullification")
        return `【${prompt.subjectCardName ? CARD_DEFINITIONS[prompt.subjectCardName].name : "Cẩm Nang"}】 · ${responder} quyết định dùng 【Vô Giải Khả Kích】 · Chuỗi ${prompt.chainDepth} · ${prompt.currentlyNegated ? "Đang bị vô hiệu" : "Đang có hiệu lực"}.`;
      return `Đang chờ ${responder} đánh ra 【${CARD_DEFINITIONS[prompt.response].name}】.`;
    }
    if (prompt.kind === "option")
      return `Đang chờ ${responder} quyết định kích hoạt Trang Bị.`;
    if (prompt.kind === "select-cards")
      return `Đang chờ ${responder} chọn ${prompt.minimum} lá.`;
    if (prompt.kind === "choose-players")
      return `Đang chờ ${responder} chọn mục tiêu cho 【Đột Tập】.`;
    return `【Ngũ Cốc Phong Đăng】 · ${responder} chọn một lá.`;
  }

  private requiredActorID(G: TqsPlayerViewState): PlayerID | null {
    if (G.prompt) return G.prompt.responderID;
    if (G.status === "lord-selection") return G.lordID;
    if (G.status === "general-selection")
      return G.seatOrder.find((id) => !G.players[id].generalSelected) ?? null;
    if (G.status === "playing") return G.turn.activePlayerID;
    return null;
  }

  private generalName(G: TqsPlayerViewState, playerID: PlayerID): string {
    const generalID = G.players[playerID].generalID;
    return generalID
      ? GENERALS_BY_ID[generalID]?.name
      : `P${G.players[playerID].seat + 1}`;
  }

  private pruneSelection(): void {
    if (!this.state || !this.match) return;
    const player = this.state.G.players[this.match.currentViewerID];
    const availableCards = new Set([
      ...player.hand,
      ...Object.values(player.equipment).filter((cardID): cardID is string =>
        Boolean(cardID),
      ),
    ]);
    this.selectedCardIDs = new Set(
      [...this.selectedCardIDs].filter((cardID) => availableCards.has(cardID)),
    );
    this.selectedTargetIDs = this.selectedTargetIDs.filter(
      (playerID) => this.state!.G.players[playerID]?.alive,
    );
  }

  private addPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    borderColor: number,
    borderWidth = 1,
  ): Graphics {
    const panel = new Graphics()
      .roundRect(x, y, width, height, 8)
      .fill({ color, alpha: 0.96 })
      .stroke({ color: borderColor, width: borderWidth, alpha: 0.9 });
    this.content.addChild(panel);
    return panel;
  }

  private addText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: number,
    anchor = 0.5,
    align: "left" | "center" | "right" = "center",
    letterSpacing = 0,
    maxWidth?: number,
  ): Text {
    const label = new Text({
      text: text.normalize("NFC"),
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize,
        fill: color,
        align,
        letterSpacing,
      },
    });
    label.anchor.set(anchor, anchor === 0 ? 0 : 0.5);
    label.position.set(x, y);
    if (maxWidth && label.width > maxWidth) {
      label.scale.set(maxWidth / label.width);
    }
    this.content.addChild(label);
    return label;
  }

  private addButton(
    label: string,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    onPress: () => void,
    color = COLORS.ink,
    textColor = COLORS.paper,
    disabled = false,
    textOptions: {
      fontSize?: number;
      fontWeight?: "400" | "700";
      paddingX?: number;
      paddingY?: number;
    } = {},
  ): Container {
    const button = new Container();
    button.position.set(centerX - width / 2, centerY - height / 2);
    button.eventMode = disabled ? "none" : "static";
    button.cursor = disabled ? "default" : "pointer";
    button.alpha = disabled ? 0.38 : 1;
    button.addChild(
      new Graphics()
        .roundRect(0, 0, width, height, 7)
        .fill(color)
        .stroke({ color: COLORS.gold, width: 1, alpha: 0.75 }),
    );
    const paddingX = textOptions.paddingX ?? 14;
    const paddingY = textOptions.paddingY ?? 8;
    const maxTextWidth = Math.max(1, width - paddingX * 2);
    const maxTextHeight = Math.max(1, height - paddingY * 2);
    const fontSize = textOptions.fontSize ?? (height >= 64 ? 14 : 13);
    const text = new Text({
      text: label.normalize("NFC"),
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize,
        fontWeight: textOptions.fontWeight ?? "400",
        fill: textColor,
        align: "center",
        lineHeight: Math.round(fontSize * 1.25),
        wordWrap: true,
        wordWrapWidth: maxTextWidth,
      },
    });
    const textScale = fitScale(text, maxTextWidth, maxTextHeight);
    text.scale.set(textScale);
    text.anchor.set(0.5);
    text.position.set(width / 2, height / 2);
    button.addChild(text);
    if (!disabled) button.on("pointertap", onPress);
    this.content.addChild(button);
    return button;
  }

  private clearContent(): void {
    for (const child of this.content.removeChildren())
      child.destroy({ children: true });
  }
}
