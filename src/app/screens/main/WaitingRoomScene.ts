import { Container, Text } from "pixi.js";
import type { TqsPlayerViewState, any } from "../../../game/types";

export class WaitingRoomScene extends Container {
  private title = new Text({
    text: "Phòng chờ",
    style: { fontSize: 36, fill: "#E2C373" },
  });
  private matchInfo = new Text({
    text: "",
    style: { fontSize: 24, fill: "#FFFFFF", align: "center" },
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.matchInfo.anchor.set(0.5);
    this.addChild(this.title, this.matchInfo);
  }

  public sync(
    G: TqsPlayerViewState,
    match: any,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.title.position.set(viewportWidth / 2, 50);
    this.matchInfo.position.set(viewportWidth / 2, viewportHeight / 2);

    const players = Object.values(G.players).filter((p) => p.role !== undefined).length;
    this.matchInfo.text = `Người chơi: ${players}/${G.seatOrder.length}\nĐang chờ người chơi khác...`;
  }
}
