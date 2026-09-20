import { Container, Text } from "pixi.js";
import type { TqsPlayerViewState } from "../../../../game/types";
import { getPlayerName } from "../../../utils/playerNames";

export class FormationScene extends Container {
  private title = new Text({
    text: "Chọn tướng",
    style: { fontSize: 36, fill: "#E2C373" },
  });
  private details = new Text({
    text: "",
    style: { fontSize: 24, fill: "#FFFFFF", align: "center" },
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.details.anchor.set(0.5);
    this.addChild(this.title, this.details);
  }

  public sync(
    G: TqsPlayerViewState,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.title.position.set(viewportWidth / 2, 50);
    this.details.position.set(viewportWidth / 2, 100);

    if (G.status === "lord-selection") {
      this.title.text = `Chủ Công chọn Võ Tướng · Lượt chọn: ${getPlayerName(G.lordID)}`;
      this.details.text = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    } else if (G.status === "general-selection") {
      const pending = G.seatOrder
        .filter((id) => !G.players[id].generalSelected)
        .map((id) => getPlayerName(id))
        .join(", ");
      this.title.text = `Các người chơi còn lại bí mật chọn Võ Tướng · Chưa hoàn tất: ${pending}`;
      this.details.text = `${G.seatOrder.length} người chơi · Standard 2013 · 108 lá bài`;
    }
  }
}
