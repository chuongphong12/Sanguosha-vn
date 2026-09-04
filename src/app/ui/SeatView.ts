import { Container, Graphics, Text } from "pixi.js";
import type { PlayerID, TqsPlayerViewState } from "../../game/model";
import { PlayerAvatar } from "./PlayerAvatar";
import { GAME_FONT_FAMILY } from "./typography";

const COLORS = {
  paper: 0xf3e5c8,
  gold: 0xc59a45,
  redBright: 0xb93730,
  muted: 0x9a836b,
};

export class SeatView extends Container {
  constructor(
    G: TqsPlayerViewState,
    playerID: PlayerID,
    options: {
      selected?: boolean;
      isActor?: boolean;
      onTap?: () => void;
    },
  ) {
    super();

    const player = G.players[playerID];

    // Main avatar
    const avatar = new PlayerAvatar(player, {
      width: 140,
      height: 160,
      isSelected: options.selected,
      isActiveActor: options.isActor,
      onTap: options.onTap,
    });
    this.addChild(avatar);

    // Hand card count indicator
    if (
      player.alive &&
      (playerID !== G.turn.activePlayerID || player.hand.length > 0)
    ) {
      const handBadge = new Graphics()
        .roundRect(0, 0, 36, 24, 4)
        .fill({ color: 0x201812, alpha: 0.85 })
        .stroke({ color: COLORS.gold, width: 1 });
      handBadge.position.set(avatar.width - 20, avatar.height - 30);
      this.addChild(handBadge);

      const handCount = new Text({
        text: `🂠 ${player.hand.length}`,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 12,
          fill: COLORS.paper,
          fontWeight: "bold",
        },
      });
      handCount.anchor.set(0.5);
      handCount.position.set(handBadge.x + 18, handBadge.y + 12);
      this.addChild(handCount);
    }
  }
}
