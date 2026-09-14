import { Container, Graphics, Text } from "pixi.js";
import type { PlayerID, TqsPlayerViewState } from "../../game/model";
import { PlayerAvatar } from "./PlayerAvatar";
import { GAME_FONT_FAMILY } from "./typography";

import { THEME } from "./theme";

export class SeatView extends Container {
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

    const player = G.players[playerID];

    // Wrap contents in a container so we can scale from center
    const innerContainer = new Container();

    // Main avatar
    const avatar = new PlayerAvatar(player, {
      width: 140,
      height: 160,
      isSelected: options.selected,
      isActiveActor: options.isActor,
      onTap: options.onTap,
    });
    innerContainer.addChild(avatar);

    if (options.isHighlighted) {
      // Glow effect
      const glow = new Graphics()
        .roundRect(-6, -6, 140 + 12, 160 + 12, 10)
        .fill({ color: 0xffea00, alpha: 0.25 })
        .stroke({ color: 0xffd700, width: 4, alpha: 0.9 });
      innerContainer.addChildAt(glow, 0);

      // Scale up
      innerContainer.scale.set(1.1);
      // Pivot at center to scale outwards, adjust position to keep it in place
      innerContainer.pivot.set(70, 80);
      innerContainer.position.set(70, 80);
    }

    this.addChild(innerContainer);

    // Hand card count indicator
    if (
      player.alive &&
      (playerID !== G.turn.activePlayerID || player.hand.length > 0)
    ) {
      const handBadge = new Graphics()
        .roundRect(0, 0, 36, 24, 4)
        .fill({ color: 0x201812, alpha: 0.85 })
        .stroke({ color: THEME.colors.gold, width: 1 });
      handBadge.position.set(avatar.width - 20, avatar.height - 30);
      this.addChild(handBadge);

      const handCount = new Text({
        text: `🂠 ${player.hand.length}`,
        style: {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: 12,
          fill: THEME.colors.paper,
          fontWeight: "bold",
        },
      });
      handCount.anchor.set(0.5);
      handCount.position.set(handBadge.x + 18, handBadge.y + 12);
      this.addChild(handCount);
    }
  }
}
