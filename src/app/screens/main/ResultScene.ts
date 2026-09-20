import { Container, Text } from "pixi.js";
import type { TqsPlayerViewState } from "../../../../game/types";

export class ResultScene extends Container {
  private title = new Text({
    text: "Kết quả",
    style: { fontSize: 48, fill: "#E2C373" },
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
    this.title.position.set(viewportWidth / 2, viewportHeight / 2 - 50);
    this.details.position.set(viewportWidth / 2, viewportHeight / 2 + 50);

    this.title.text = G.winner?.reason ?? "Ván đấu kết thúc.";
    this.details.text = `Chồng Bài Rút: ${G.deckSize} · Chồng Bài Bỏ: ${G.discard.length}`;
  }
}
