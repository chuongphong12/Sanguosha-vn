import {
  Assets,
  Container,
  Graphics,
  Text,
  Texture,
  TilingSprite,
  Sprite,
} from "pixi.js";

import { LobbyClient } from "boardgame.io/client";
import type {
  MatchClientState,
  MatchConfig,
} from "../../../client/MatchClient";
import { MatchClient } from "../../../client/MatchClient";
import { GeneralCardView } from "../../ui/components/GeneralCardView";
import {
  canRespondWithCard,
  canSelectCardTarget,
  getVirtualConversions,
} from "../../../game/cardEngine";
import { CARD_DEFINITIONS } from "../../../game/catalog/cards";
import {
  GENERALS_BY_ID,
  hasLordSkill,
  SKILLS,
} from "../../../game/catalog/generals";
import type {
  CardDefinition,
  CardResponsePrompt,
  PlayerID,
  PromptAnswer,
  TqsPlayerViewState,
  TurnStep,
  ZoneCardChoice,
} from "../../../game/model";
import { CardView } from "../../ui/CardView";
import { Dashboard } from "../../ui/Dashboard";
import { SeatView } from "../../ui/SeatView";
import { getEquipmentSlotViews } from "../../ui/equipmentView";
import { layoutActionRow } from "../../ui/layout";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import { THEME } from "../../ui/theme";
import { Button } from "../../ui/components/Button";
import { Panel } from "../../ui/components/Panel";

const STEP_NAMES: Record<TurnStep, string> = {
  start: "Bắt Đầu",
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
  // We remove assetBundles = ["main"] so WaitingRoom loads instantly.
  // Assets are still background-loaded by engine.

  private readonly content = new Container();
  private match?: MatchClient;
  private unsubscribe?: () => void;
  private state: MatchClientState = null;
  private selectedCardIDs = new Set<string>();
  private selectedTargetIDs: PlayerID[] = [];
  private selectedCandidateID: string | null = null;
  private selectedZoneChoices: ZoneCardChoice[] = [];
  private selectedPromptPlayerIDs: PlayerID[] = [];
  private lastPromptID: number | null = null;
  private nullificationTimeout: ReturnType<typeof setTimeout> | null = null;
  private handScrollX = 0;
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

  private mainBundleLoaded = false;
  private isAwaitingBundle = false;
  private autoSkipWuxie = true;
  private rolePopupDismissed = false;

  private rolePopupContainer?: PIXI.Container;
  private showRolePopup(role: string) {
    if (this.rolePopupContainer) return;
    const popup = new PIXI.Container();

    const overlay = new PIXI.Graphics();
    overlay
      .rect(0, 0, this.viewportWidth, this.viewportHeight)
      .fill({ color: 0x000000, alpha: 0.85 });
    overlay.eventMode = "static";
    overlay.cursor = "pointer";

    const roleNames: Record<string, string> = {
      chu_cong: "CHỦ CÔNG",
      trung_than: "TRUNG THẦN",
      phan_tac: "PHẢN TẶC",
      noi_gian: "NỘI GIAN",
    };

    const label = new PIXI.Text({
      text:
        "Thân phận của bạn là:\n\n" + (roleNames[role] || role.toUpperCase()),
      style: {
        fontFamily: "Noto Serif",
        fontSize: 48,
        fontWeight: "bold",
        fill: {
          type: "linear",
          colorStops: [
            { offset: 0, color: "#d4af37" },
            { offset: 1, color: "#aa801a" },
          ],
        },
        align: "center",
        stroke: { color: 0x1a1a1a, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(this.viewportWidth / 2, this.viewportHeight / 2);

    popup.addChild(overlay, label);

    // Auto dismiss after 3.5s or on click
    const dismiss = () => {
      if (this.rolePopupContainer && !this.rolePopupContainer.destroyed) {
        this.rolePopupContainer.destroy();
        this.rolePopupContainer = undefined;
        this.render();
      }
    };
    overlay.on("pointerdown", dismiss);
    setTimeout(dismiss, 3500);

    this.addChild(popup);
    this.rolePopupContainer = popup;
  }

  private roleCardRevealed = false;
  private lordExtraHp = 1;
  private turnTimeLimit: number | null = null;
  private targetNumPlayers: number = 8;
  private autoStartWhenFull: boolean = false;
  private startingMatch: boolean = false;

  private lobbyPollInterval?: number;

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
      const numPlayersParam = parseInt(urlParams.get("numPlayers") || "4", 10);
      config.numPlayers = isNaN(numPlayersParam) ? 4 : numPlayersParam;
    }

    this.match = new MatchClient(config);
    this.unsubscribe = this.match.subscribe((state) =>
      this.receiveState(state),
    );

    if (config.mode === "remote" && config.matchID && config.serverUrl) {
      const lobbyClient = new LobbyClient({ server: config.serverUrl });
      this.lobbyPollInterval = window.setInterval(async () => {
        if (this.state?.G.status === "waiting-room") {
          try {
            const matchInfo = await lobbyClient.getMatch(
              "tam-quoc-sat-standard-2013",
              config.matchID!,
            );
            if (this.state) {
              this.state.matchData = matchInfo.players as any;
              this.render();
            }
          } catch (err) {}
        }
      }, 2000);
    }
  }

  public reset(): void {
    if (this.lobbyPollInterval) {
      window.clearInterval(this.lobbyPollInterval);
      this.lobbyPollInterval = undefined;
    }
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
    if (this.nullificationTimeout) {
      clearTimeout(this.nullificationTimeout);
      this.nullificationTimeout = null;
    }
    this.handScrollX = 0;
    this.serpentSpearMode = false;
    this.virtualAs = null;
    this.pendingSkill = null;
    this.handoffConfirmedFor = null;
    this.lastRequiredActorID = null;
    this.clearContent();
  }

  private receiveState(state: MatchClientState): void {
    this.state = state;
    if (state && state.G.status !== "waiting-room" && !this.mainBundleLoaded) {
      if (!this.isAwaitingBundle) {
        this.isAwaitingBundle = true;
        // Draw a simple loading screen so it's not purely black
        this.clearContent();
        this.addText(
          "Đang tải dữ liệu trò chơi...",
          this.viewportWidth / 2,
          this.viewportHeight / 2,
          24,
          THEME.colors.gold,
        );

        Assets.loadBundle("main")
          .then(() => {
            this.mainBundleLoaded = true;
            this.isAwaitingBundle = false;
            this.render();
          })
          .catch((err) => {
            console.error("Lỗi tải tài nguyên:", err);
            this.addText(
              "Lỗi tải tài nguyên! Hãy thử làm mới trang.",
              this.viewportWidth / 2,
              this.viewportHeight / 2 + 40,
              16,
              THEME.colors.redBright,
            );
          });
      }
      return; // Skip normal rendering until loaded
    }
    const promptID = state?.G.prompt?.id ?? null;
    if (promptID !== this.lastPromptID) {
      if (this.nullificationTimeout) {
        clearTimeout(this.nullificationTimeout);
        this.nullificationTimeout = null;
      }
      this.selectedCardIDs.clear();
      this.selectedTargetIDs = [];
      this.selectedZoneChoices = [];
      this.selectedPromptPlayerIDs = [];
      this.lastPromptID = promptID;
      this.virtualAs = null;
      this.pendingSkill = null;

      const prompt = state?.G.prompt;
      if (
        prompt &&
        prompt.kind === "card-response" &&
        prompt.reason === "nullification"
      ) {
        this.nullificationTimeout = setTimeout(() => {
          this.nullificationTimeout = null;
          if (this.state?.G.prompt?.id === promptID) {
            this.match!.move("timeoutPrompt", promptID);
          }
        }, 4000);
      }
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
        THEME.colors.paper,
      );
      return;
    }

    const G = this.state.G;
    if (G.status === "waiting-room") {
      this.drawWaitingRoom();
      return;
    }

    if (!this.mainBundleLoaded) {
      this.addText(
        "Đang tải dữ liệu trò chơi...",
        this.viewportWidth / 2,
        this.viewportHeight / 2,
        24,
        THEME.colors.gold,
      );
      return;
    }

    this.drawViewerSelector(G);
    this.drawStatus(G);
    this.drawSeats(G);
    this.drawLog(G);
    this.drawPrivateArea(G);
    // Overlay for General Selection
    const viewer = G.players[this.match!.currentViewerID];
    const canSelectGeneral =
      viewer.generalID === null &&
      viewer.generalCandidates.length > 0 &&
      ((G.status === "lord-selection" &&
        this.match!.currentViewerID === G.lordID) ||
        (G.status === "general-selection" &&
          this.match!.currentViewerID !== G.lordID));

    if (canSelectGeneral) {
      this.drawGeneralCandidates(G, viewer.generalCandidates);
    }
  }
  private drawWaitingRoom(): void {
    const viewerID = this.match!.currentViewerID;

    // Add cinematic background over the default one
    this.addBackgroundTexture(
      "bg.jpg",
      this.viewportWidth,
      this.viewportHeight,
      0.5,
    );

    // Header
    this.addText(
      "SẢNH CHỜ",
      this.viewportWidth / 2,
      60,
      42,
      THEME.colors.gold,
      0.5,
      "center",
    );

    const leftCenterX = this.viewportWidth / 2 - 250;
    const rightCenterX = this.viewportWidth / 2 + 250;

    interface MatchPlayer {
      id: number;
      name?: string;
    }
    let joinedPlayers: MatchPlayer[] = [];
    if (this.match!.isRemote) {
      joinedPlayers =
        (this.state!.matchData as MatchPlayer[])?.filter((p) => p.name) || [];
    } else {
      const numPlayers = this.match!.playerIDs.length;
      for (let i = 0; i < numPlayers; i++) {
        joinedPlayers.push({ id: i, name: `Player ${i + 1}` });
      }
    }
    const joinedPlayerIDs = joinedPlayers.map((p) => String(p.id));

    const actualHostID =
      joinedPlayerIDs.length > 0
        ? String(Math.min(...joinedPlayerIDs.map(Number)))
        : "0";
    const amIHost = viewerID === actualHostID;

    // LEFT PANEL: Player List
    this.addText(
      `NGƯỜI CHƠI (${joinedPlayers.length}/${amIHost ? this.targetNumPlayers : 10})`,
      leftCenterX,
      130,
      22,
      THEME.colors.gold,
      0.5,
      "center",
    );

    const bgList = new Graphics()
      .rect(leftCenterX - 180, 160, 360, 470)
      .fill({ color: THEME.colors.panelBg, alpha: 0.85 })
      .stroke({ color: THEME.colors.gold, width: 2 });
    this.content.addChild(bgList);

    const slotCount = amIHost ? this.targetNumPlayers : 10;
    for (let i = 0; i < slotCount; i++) {
      const y = 175 + i * 44;
      const centerY = y + 19;
      const p = joinedPlayers[i];

      const slotBg = new Graphics()
        .rect(leftCenterX - 160, y, 320, 38)
        .fill({ color: p ? 0x222222 : 0x111111, alpha: 0.8 })
        .stroke({ color: THEME.colors.gold, width: 1, alpha: 0.5 });
      this.content.addChild(slotBg);

      const numTxt = this.addText(
        `${i + 1}`,
        leftCenterX - 145,
        centerY,
        18,
        THEME.colors.gold,
        0,
        "left",
      );
      numTxt.anchor.set(0, 0.5);

      if (p) {
        const isHost = String(p.id) === actualHostID;
        const isMe = String(p.id) === viewerID;
        const color = isMe ? THEME.colors.gold : THEME.colors.paper;

        let displayName = p.name || "Khách";
        if (isHost) displayName += " (Chủ phòng)";

        const nameTxt = this.addText(
          displayName,
          leftCenterX - 110,
          centerY,
          18,
          color,
          0,
          "left",
          0,
          200,
        );
        nameTxt.anchor.set(0, 0.5);

        const dot = new Graphics()
          .circle(leftCenterX + 130, centerY, 6)
          .fill(0x00ff00);
        this.content.addChild(dot);
      } else {
        const emptyTxt = this.addText(
          "Open Slot",
          leftCenterX - 110,
          centerY,
          18,
          0x555555,
          0,
          "left",
        );
        emptyTxt.anchor.set(0, 0.5);
      }
    }

    // Auto-start logic
    if (
      amIHost &&
      this.autoStartWhenFull &&
      joinedPlayers.length >= this.targetNumPlayers &&
      !this.startingMatch
    ) {
      this.startingMatch = true;
      this.match!.move("startGame", {
        autoSkipWuxie: this.autoSkipWuxie,
        lordExtraHp: this.lordExtraHp,
        turnTimeLimit: this.turnTimeLimit,
      });
      return;
    }

    // RIGHT PANEL: Game Settings
    this.addText(
      "TÙY CHỈNH GAME",
      rightCenterX,
      130,
      22,
      THEME.colors.gold,
      0.5,
      "center",
    );
    const bgSettings = new Graphics()
      .rect(rightCenterX - 180, 160, 360, 470)
      .fill({ color: THEME.colors.panelBg, alpha: 0.85 })
      .stroke({ color: THEME.colors.gold, width: 2 });
    this.content.addChild(bgSettings);

    if (amIHost) {
      let y = 190;

      this.addButton(
        `Số Người Chơi: ${this.targetNumPlayers}`,
        rightCenterX,
        y,
        320,
        36,
        () => {
          const options = [4, 5, 6, 8, 10];
          const idx = options.indexOf(this.targetNumPlayers);
          this.targetNumPlayers = options[(idx + 1) % options.length];
          this.render();
        },
        THEME.colors.ink,
        THEME.colors.paper,
      );
      y += 50;

      this.addButton(
        `Tự Bắt Đầu: ${this.autoStartWhenFull ? "BẬT" : "TẮT"}`,
        rightCenterX,
        y,
        320,
        36,
        () => {
          this.autoStartWhenFull = !this.autoStartWhenFull;
          this.render();
        },
        this.autoStartWhenFull ? THEME.colors.gold : THEME.colors.ink,
        THEME.colors.paper,
      );
      y += 50;

      this.addButton(
        `Vô Giải Khả Kích: ${this.autoSkipWuxie ? "Tự Động" : "Thủ Công"}`,
        rightCenterX,
        y,
        320,
        36,
        () => {
          this.autoSkipWuxie = !this.autoSkipWuxie;
          this.render();
        },
        this.autoSkipWuxie ? THEME.colors.gold : THEME.colors.ink,
        THEME.colors.paper,
      );
      y += 50;

      this.addButton(
        `Máu Chủ Công: ${this.lordExtraHp > 0 ? "+1" : "Giữ Nguyên"}`,
        rightCenterX,
        y,
        320,
        36,
        () => {
          this.lordExtraHp = this.lordExtraHp === 1 ? 0 : 1;
          this.render();
        },
        this.lordExtraHp > 0 ? THEME.colors.gold : THEME.colors.ink,
        THEME.colors.paper,
      );
      y += 50;

      let timeLimitStr = "Vô Hạn";
      if (this.turnTimeLimit === 15) timeLimitStr = "15 Giây";
      if (this.turnTimeLimit === 30) timeLimitStr = "30 Giây";
      this.addButton(
        `Thời Gian Lượt: ${timeLimitStr}`,
        rightCenterX,
        y,
        320,
        36,
        () => {
          if (this.turnTimeLimit === null) this.turnTimeLimit = 30;
          else if (this.turnTimeLimit === 30) this.turnTimeLimit = 15;
          else this.turnTimeLimit = null;
          this.render();
        },
        this.turnTimeLimit !== null ? THEME.colors.gold : THEME.colors.ink,
        THEME.colors.paper,
      );

      y += 200; // Push to bottom of panel
      const canStart = joinedPlayers.length >= 4;
      this.addButton(
        "Bắt Đầu Ngay",
        rightCenterX,
        y,
        280,
        50,
        () => {
          if (canStart) {
            this.match!.move("startGame", {
              autoSkipWuxie: this.autoSkipWuxie,
              lordExtraHp: this.lordExtraHp,
              turnTimeLimit: this.turnTimeLimit,
            });
          }
        },
        canStart ? THEME.colors.red : THEME.colors.ink,
        THEME.colors.gold,
        !canStart,
        { fontSize: 24, fontWeight: "700" },
      );
    } else {
      this.addText(
        "Chủ phòng đang thiết lập...",
        rightCenterX,
        250,
        18,
        THEME.colors.muted,
        0.5,
        "center",
      );
    }
  }

  private drawBackground(): void {
    const background = new Graphics()
      .rect(0, 0, this.viewportWidth, this.viewportHeight)
      .fill(THEME.colors.black);
    background
      .circle(
        this.viewportWidth * 0.82,
        this.viewportHeight * 0.22,
        Math.min(this.viewportWidth, 520) * 0.34,
      )
      .fill({ color: THEME.colors.red, alpha: 0.16 });
    background
      .rect(18, 18, this.viewportWidth - 36, this.viewportHeight - 36)
      .stroke({ color: THEME.colors.gold, width: 1, alpha: 0.55 });
    this.content.addChild(background);
    this.addBackgroundTexture(
      "system/tableBg",
      this.viewportWidth,
      this.viewportHeight,
      0.8,
    );
  }

  private addBackgroundTexture(
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
      `${name}.jpg`,
      `${name}.png`,
      `/assets/main/${name}.jpg`,
    ]) {
      texture = Assets.get<Texture>(alias);
      if (texture) break;
    }
    if (!texture) return;
    const sprite = new TilingSprite({
      texture,
      width,
      height,
    });
    sprite.alpha = alpha;
    sprite.position.set(x ?? 0, y ?? 0);
    this.content.addChild(sprite);
  }

  private async leaveMatchAndExit(): Promise<void> {
    if (this.match?.isRemote) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const serverUrl = urlParams.get("serverUrl");
        const matchID = urlParams.get("matchID");
        const playerID = urlParams.get("playerID");
        const credentials = urlParams.get("credentials");
        if (serverUrl && matchID && playerID && credentials) {
          const lc = new LobbyClient({ server: serverUrl });
          await lc.leaveMatch("tam-quoc-sat-standard-2013", matchID, {
            playerID,
            credentials,
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    window.location.href = "/";
  }

  private drawTitle(): void {
    // The user requested to remove the game title to avoid overlap.
    this.addButton(
      "Thoát",
      74, // centerX
      48, // centerY
      80,
      34,
      () => this.leaveMatchAndExit(),
      THEME.colors.ink,
      THEME.colors.paper,
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
      THEME.colors.paperDark,
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
          this.handScrollX = 0;
          this.serpentSpearMode = false;
          this.handoffConfirmedFor = null;
          this.match!.switchViewer(playerID, (state) =>
            this.receiveState(state),
          );
        },
        active ? THEME.colors.redBright : THEME.colors.ink,
        THEME.colors.paper,
        selectorLocked,
      );
    });
  }

  private drawStatus(G: TqsPlayerViewState): void {
    const playWidth = this.viewportWidth - 280; // offset for event log
    const panelWidth = 700;
    const panelX = (playWidth - panelWidth) / 2;
    const panelY = 24;
    this.addPanel(panelX, panelY, panelWidth, 54, 0x181411, THEME.colors.gold, 0.85);

    let status = "";
    let detail = "";
    if (G.status === "lord-selection") {
      status = `Chủ Công chọn Võ Tướng · Lượt chọn: ${this.generalName(G, G.lordID)}`;
      detail = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    } else if (G.status === "general-selection") {
      status = `Các người chơi còn lại bí mật chọn Võ Tướng`;
      detail = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    } else if (G.status === "ended") {
      status = G.winner?.reason ?? "Ván đấu kết thúc.";
      detail = `Chồng Bài Rút: ${G.deckSize} · Chồng Bài Bỏ: ${G.discard.length}`;
    } else if (G.prompt) {
      const responder = this.generalName(G, G.prompt.responderID);
      status = this.promptStatus(G, responder);
      detail = `Chồng Bài Rút: ${G.deckSize} · Chồng Bài Bỏ: ${G.discard.length}`;
    } else {
      status = `Lượt ${G.turn.number} · ${STEP_NAMES[G.turn.step]} · ${this.generalName(G, G.turn.activePlayerID)}`;
      detail = `Chồng Bài Rút: ${G.deckSize} · Chồng Bài Bỏ: ${G.discard.length}`;
    }

    this.addText(status, panelX + panelWidth / 2, panelY + 16, 18, THEME.colors.paper, 0.5, "center");
    this.addText(detail, panelX + panelWidth / 2, panelY + 38, 13, THEME.colors.muted, 0.5, "center");
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
    const panel = new Panel({
      width,
      height,
      color,
      borderColor,
      borderWidth,
    });
    panel.position.set(x, y);
    this.content.addChild(panel);
    return panel as Graphics;
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
    color = THEME.colors.ink,
    textColor = THEME.colors.paper,
    disabled = false,
    textOptions: {
      fontSize?: number;
      fontWeight?: "400" | "700";
      paddingX?: number;
      paddingY?: number;
    } = {},
  ): Container {
    const button = new Button({
      label,
      width,
      height,
      onPress,
      color,
      textColor,
      disabled,
      ...textOptions,
    });
    // Button is already a container with text inside. We just need to position it.
    // The previous implementation positioned it by its top-left corner.
    // Our Button class positions its graphics at 0,0.
    button.position.set(centerX - width / 2, centerY - height / 2);
    this.content.addChild(button);
    return button;
  }

  private clearContent(): void {
    for (const child of this.content.removeChildren())
      child.destroy({ children: true });
  }
}
