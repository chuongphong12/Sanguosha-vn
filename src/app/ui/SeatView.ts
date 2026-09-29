import { Container, Graphics, Text } from "pixi.js";
import type { PlayerID, TqsPlayerViewState } from "../../game/model";
import { PlayerAvatar } from "./PlayerAvatar";
import { GAME_FONT_FAMILY } from "./typography";

import { THEME } from "./theme";

export class SeatView extends Container {
  private innerContainer = new Container();
  private avatar: PlayerAvatar;
  private glow = new Graphics();

  private handBadge = new Graphics();
  private handCount = new Text({
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 12,
      fill: THEME.colors.paper,
      fontWeight: "bold",
    },
  });

  private playerID: PlayerID;

  constructor(
    G: TqsPlayerViewState,
    playerID: PlayerID,
    options: {
      selected?: boolean;
      isActor?: boolean;
      isHighlighted?: boolean;
      onTap?: () => void;
    },
  ) {
    super();
    this.playerID = playerID;

    const player = G.players[playerID];

    this.avatar = new PlayerAvatar(player, {
      width: 140,
      height: 160,
      isSelected: options.selected,
      isActiveActor: options.isActor,
      onTap: options.onTap,
    });

    this.innerContainer.addChild(this.glow, this.avatar);
    this.addChild(this.innerContainer);

    this.handCount.anchor.set(0.5);
    this.addChild(this.handBadge, this.handCount);

    this.sync(G, options);
  }

  public sync(
    G: TqsPlayerViewState,
    options: {
      selected?: boolean;
      isActor?: boolean;
      isHighlighted?: boolean;
      onTap?: () => void;
    },
  ): void {
    const player = G.players[this.playerID];

    this.avatar.sync(player, {
      isActiveActor: options.isActor,
      isSelected: options.selected,
    });

    if (options.onTap && this.avatar.eventMode !== "static") {
      this.avatar.eventMode = "static";
      this.avatar.cursor = "pointer";
      this.avatar.on("pointertap", options.onTap);
    } else if (!options.onTap) {
      this.avatar.eventMode = "none";
      this.avatar.cursor = "auto";
      this.avatar.removeAllListeners("pointertap");
    }

    if (options.isHighlighted) {
      this.glow
        .clear()
        .roundRect(-6, -6, 140 + 12, 160 + 12, 10)
        .fill({ color: 0xffea00, alpha: 0.25 })
        .stroke({ color: 0xffd700, width: 4, alpha: 0.9 });
      this.glow.visible = true;

      this.innerContainer.scale.set(1.1);
      this.innerContainer.pivot.set(70, 80);
      this.innerContainer.position.set(70, 80);
    } else {
      this.glow.visible = false;
      this.innerContainer.scale.set(1);
      this.innerContainer.pivot.set(0, 0);
      this.innerContainer.position.set(0, 0);
    }

    if (
      player.alive &&
      (this.playerID !== G.turn.activePlayerID || player.hand.length > 0)
    ) {
      this.handBadge
        .clear()
        .roundRect(0, 0, 36, 24, 4)
        .fill({ color: 0x201812, alpha: 0.85 })
        .stroke({ color: THEME.colors.gold, width: 1 });
      this.handBadge.position.set(140 - 20, 160 - 30);
      this.handBadge.visible = true;

      this.handCount.text = `🂠 ${player.hand.length}`;
      this.handCount.position.set(this.handBadge.x + 18, this.handBadge.y + 12);
      this.handCount.visible = true;
    } else {
      this.handBadge.visible = false;
      this.handCount.visible = false;
    }
  }
}
