import { Container, Text } from "pixi.js";
import { GAME_FONT_FAMILY } from "../../ui/typography";
import { Button } from "../../ui/components/Button";
import type { TqsPlayerViewState } from "../../../game/types";
import { lobbyUrl } from "../../utils/lobbyUrl";

export class ResultScene extends Container {
  private title = new Text({
    text: "Kết quả",
    style: { fontFamily: GAME_FONT_FAMILY, fontSize: 48, fill: "#E2C373" },
  });
  private details = new Text({
    text: "",
    style: {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: 24,
      fill: "#FFFFFF",
      align: "center",
    },
  });

  private btnLobby = new Button({
    width: 200,
    height: 48,
    label: "Quay lại sảnh",
    onPress: () => window.location.assign(lobbyUrl(window.location.search)),
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.details.anchor.set(0.5);
    this.addChild(this.title, this.details, this.btnLobby);
  }

  public sync(
    G: TqsPlayerViewState,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.title.position.set(viewportWidth / 2, viewportHeight / 2 - 50);
    this.details.position.set(viewportWidth / 2, viewportHeight / 2 + 50);

    this.title.text = G.winner?.reason ?? "Ván đấu kết thúc.";
    this.details.text = `Chồng Bài Rút: ${G.deckSize} · Chồng Bài Bỏ: ${G.discard.length}`;
    this.btnLobby.position.set(
      viewportWidth / 2 - 100,
      viewportHeight / 2 + 100,
    );
  }
}
