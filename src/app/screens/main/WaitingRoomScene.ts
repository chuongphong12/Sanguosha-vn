import { Container, Graphics, Text } from "pixi.js";

import type { PlayerID } from "../../../game/model";
import { Button } from "../../ui/components/Button";
import { THEME } from "../../ui/theme";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import {
  DEFAULT_ROOM_SETTINGS,
  PLAYER_COUNT_OPTIONS,
  TURN_TIME_OPTIONS,
  buildStartGamePayload,
  canStartGame,
  cycleOption,
  isRoomHost,
  shouldAutoStart,
  waitingRoomLayout,
} from "./waitingRoomModel";
import type {
  RoomMember,
  RoomSettings,
  StartGamePayload,
} from "./waitingRoomModel";

const MAX_SLOTS = 10;

export interface WaitingRoomInput {
  members: RoomMember[];
  viewerID: PlayerID;
  viewportWidth: number;
  viewportHeight: number;
  onStart: (payload: StartGamePayload) => void;
}

export class WaitingRoomScene extends Container {
  private settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  private starting = false;
  private lastInput?: WaitingRoomInput;
  private lastSignature = "";

  /** Forget per-match state so a reused scene starts from a clean room. */
  public reset(): void {
    this.settings = { ...DEFAULT_ROOM_SETTINGS };
    this.starting = false;
    this.lastInput = undefined;
    this.lastSignature = "";
    this.clear();
  }

  public sync(input: WaitingRoomInput): void {
    this.lastInput = input;
    const signature = JSON.stringify([
      input.members,
      input.viewerID,
      input.viewportWidth,
      input.viewportHeight,
      this.settings,
    ]);
    // Rebuilding on every poll would swallow clicks that straddle a rebuild.
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.build(input);

    if (
      shouldAutoStart(
        input.members,
        input.viewerID,
        this.settings,
        this.starting,
      )
    ) {
      this.start(input);
    }
  }

  private start(input: WaitingRoomInput): void {
    if (!canStartGame(input.members, input.viewerID)) return;
    // `starting` only throttles auto-start; the host can always press the button.
    this.starting = true;
    input.onStart(buildStartGamePayload(input.members, this.settings));
  }

  private update(): void {
    if (!this.lastInput) return;
    this.lastSignature = "";
    this.sync(this.lastInput);
  }

  private clear(): void {
    for (const child of this.removeChildren())
      child.destroy({ children: true });
  }

  private build(input: WaitingRoomInput): void {
    this.clear();
    const { members, viewerID, viewportWidth } = input;
    const layout = waitingRoomLayout(viewportWidth);
    const isHost = isRoomHost(viewerID);
    const slotCount = isHost ? this.settings.targetNumPlayers : MAX_SLOTS;

    this.addLabel(
      "SẢNH CHỜ",
      viewportWidth / 2,
      60,
      42,
      THEME.colors.gold,
      "waiting-room-title",
    );

    // Player list
    this.addLabel(
      `NGƯỜI CHƠI (${members.length}/${slotCount})`,
      layout.listCenterX,
      130,
      22,
      THEME.colors.gold,
      "waiting-room-count",
    );
    this.addPanel(layout.listCenterX, layout);
    for (let i = 0; i < slotCount; i += 1) {
      const y = 175 + i * layout.slotPitch;
      const centerY = y + layout.slotHeight / 2;
      const member = members[i];
      this.addChild(
        new Graphics()
          .rect(layout.listCenterX - 160, y, 320, layout.slotHeight)
          .fill({ color: member ? 0x222222 : 0x111111, alpha: 0.8 })
          .stroke({ color: THEME.colors.gold, width: 1, alpha: 0.5 }),
      );
      this.addLabel(
        String(i + 1),
        layout.listCenterX - 145,
        centerY,
        18,
        THEME.colors.gold,
        undefined,
        0,
      );
      if (member) {
        const isMe = member.id === viewerID;
        const isHostSeat = isRoomHost(member.id);
        this.addLabel(
          isHostSeat ? `${member.name} (Chủ phòng)` : member.name,
          layout.listCenterX - 110,
          centerY,
          18,
          isMe ? THEME.colors.gold : THEME.colors.paper,
          `waiting-room-member-${member.id}`,
          0,
          200,
        );
        this.addChild(
          new Graphics()
            .circle(layout.listCenterX + 130, centerY, 6)
            .fill(THEME.colors.green),
        );
      } else {
        this.addLabel(
          "Ghế trống",
          layout.listCenterX - 110,
          centerY,
          18,
          0x555555,
          undefined,
          0,
        );
      }
    }

    // Settings
    this.addLabel(
      "TÙY CHỈNH GAME",
      layout.settingsCenterX,
      130,
      22,
      THEME.colors.gold,
      "waiting-room-settings-title",
    );
    this.addPanel(layout.settingsCenterX, layout);

    if (!isHost) {
      this.addLabel(
        "Chủ phòng đang thiết lập...",
        layout.settingsCenterX,
        250,
        18,
        THEME.colors.muted,
        "waiting-room-guest-note",
      );
      return;
    }

    const rows: Array<{ label: string; active: boolean; onPress: () => void }> =
      [
        {
          label: `Số Người Chơi: ${this.settings.targetNumPlayers}`,
          active: false,
          onPress: () => {
            this.settings.targetNumPlayers = cycleOption(
              PLAYER_COUNT_OPTIONS,
              this.settings.targetNumPlayers,
            );
            this.update();
          },
        },
        {
          label: `Tự Bắt Đầu: ${this.settings.autoStartWhenFull ? "BẬT" : "TẮT"}`,
          active: this.settings.autoStartWhenFull,
          onPress: () => {
            this.settings.autoStartWhenFull = !this.settings.autoStartWhenFull;
            this.update();
          },
        },
        {
          label: `Vô Giải Khả Kích: ${this.settings.autoSkipWuxie ? "Tự Động" : "Thủ Công"}`,
          active: this.settings.autoSkipWuxie,
          onPress: () => {
            this.settings.autoSkipWuxie = !this.settings.autoSkipWuxie;
            this.update();
          },
        },
        {
          label: `Máu Chủ Công: ${this.settings.lordExtraHp > 0 ? "+1" : "Giữ Nguyên"}`,
          active: this.settings.lordExtraHp > 0,
          onPress: () => {
            this.settings.lordExtraHp = this.settings.lordExtraHp === 1 ? 0 : 1;
            this.update();
          },
        },
        {
          label: `Thời Gian Lượt: ${this.settings.turnTimeLimit === null ? "Vô Hạn" : `${this.settings.turnTimeLimit} Giây`}`,
          active: this.settings.turnTimeLimit !== null,
          onPress: () => {
            this.settings.turnTimeLimit = cycleOption(
              TURN_TIME_OPTIONS,
              this.settings.turnTimeLimit,
            );
            this.update();
          },
        },
      ];
    rows.forEach((row, index) => {
      const { width, height } = layout.settingButton;
      const button = new Button({
        label: row.label,
        width,
        height,
        color: row.active ? THEME.colors.gold : THEME.colors.ink,
        textColor: row.active ? THEME.colors.ink : THEME.colors.paper,
        onPress: row.onPress,
      });
      button.position.set(
        layout.settingsCenterX - width / 2,
        layout.settingRowsY[index] - height / 2,
      );
      this.addChild(button);
    });

    const canStart = canStartGame(members, viewerID);
    const startLayout = layout.startButton;
    const startButton = new Button({
      label: "Bắt Đầu Ngay",
      width: startLayout.width,
      height: startLayout.height,
      color: canStart ? THEME.colors.red : THEME.colors.ink,
      textColor: THEME.colors.gold,
      disabled: !canStart,
      fontSize: 24,
      fontWeight: "700",
      onPress: () => this.start(input),
    });
    startButton.position.set(
      startLayout.centerX - startLayout.width / 2,
      startLayout.centerY - startLayout.height / 2,
    );
    this.addChild(startButton);
  }

  private addPanel(
    centerX: number,
    layout: ReturnType<typeof waitingRoomLayout>,
  ): void {
    this.addChild(
      new Graphics()
        .rect(
          centerX - layout.panelWidth / 2,
          layout.panelTop,
          layout.panelWidth,
          layout.panelHeight,
        )
        .fill({ color: THEME.colors.panelBg, alpha: 0.85 })
        .stroke({ color: THEME.colors.gold, width: 2 }),
    );
  }

  private addLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: number,
    label?: string,
    anchorX = 0.5,
    maxWidth?: number,
  ): Text {
    const node = new Text({
      text: text.normalize("NFC"),
      style: { fontFamily: GAME_FONT_FAMILY, fontSize, fill: color },
    });
    node.anchor.set(anchorX, 0.5);
    node.position.set(x, y);
    if (maxWidth && node.width > maxWidth)
      node.scale.set(maxWidth / node.width);
    if (label) node.label = label;
    this.addChild(node);
    return node;
  }
}
