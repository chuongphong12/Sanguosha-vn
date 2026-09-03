import { animate } from "motion";
import type { ObjectTarget } from "motion/react";
import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";

import { GAME_FONT_FAMILY } from "../ui/typography";

/** Screen shown while loading assets */
export class LoadScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["preload"];
  /** Background image */
  private background: Sprite;
  /** Product logo */
  private logo: Sprite;
  /** Product title */
  private title: Text;
  /** Subtitle under the title */
  private subtitle: Text;
  /** Note about the Vietnamese port */
  private portNote: Text;
  /** Credit line in the bottom-right corner */
  private credit: Text;
  /** Linear loading bar */
  private barWidth = 420;
  private barBack: Graphics;
  private barFill: Graphics;

  constructor() {
    super();

    this.background = new Sprite(Assets.get<Texture>("bg.jpg"));
    this.background.tint = 0x8a8a8a;
    this.addChild(this.background);

    this.logo = new Sprite(Assets.get<Texture>("preload/logo.png"));
    this.logo.anchor.set(0.5);
    this.logo.width = 180;
    this.logo.height = 180;
    this.addChild(this.logo);

    this.title = new Text({
      text: "Tam Quốc Sát",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 44,
        fontWeight: "bold",
        fill: 0xf3e5c8,
        align: "center",
        letterSpacing: 3,
      },
    });
    this.title.anchor.set(0.5);
    this.addChild(this.title);

    this.subtitle = new Text({
      text: "Standard 2013",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 20,
        fill: 0xc59a45,
        align: "center",
        letterSpacing: 4,
      },
    });
    this.subtitle.anchor.set(0.5);
    this.addChild(this.subtitle);

    this.portNote = new Text({
      text: "Bản Việt hóa port lại từ dự án QSanguosha",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 13,
        fill: 0x9a836b,
        align: "center",
      },
    });
    this.portNote.anchor.set(0.5);
    this.addChild(this.portNote);

    this.credit = new Text({
      text: "Credit: QSanguosha",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 12,
        fill: 0x9a836b,
        align: "right",
      },
    });
    this.credit.anchor.set(1, 1);
    this.addChild(this.credit);

    this.barBack = new Graphics();
    this.barFill = new Graphics();
    this.addChild(this.barBack);
    this.addChild(this.barFill);
    this.drawBar(0.2);
  }

  public onLoad(progress: number) {
    this.drawBar(Math.min(1, Math.max(0, progress)));
  }

  private drawBar(progress: number): void {
    const height = 10;
    const radius = height / 2;
    this.barBack.clear();
    this.barBack
      .roundRect(-this.barWidth / 2, -height / 2, this.barWidth, height, radius)
      .fill({ color: 0x3d3d3d, alpha: 0.55 });
    this.barFill.clear();
    if (progress > 0) {
      const fillWidth = Math.max(height, this.barWidth * progress);
      this.barFill
        .roundRect(-this.barWidth / 2, -height / 2, fillWidth, height, radius)
        .fill({ color: 0xc59a45 });
    }
  }

  /** Resize the screen, fired whenever window size changes  */
  public resize(width: number, height: number) {
    this.background.width = width;
    this.background.height = height;
    this.title.position.set(width * 0.5, 84);
    this.subtitle.position.set(width * 0.5, 124);
    this.portNote.position.set(width * 0.5, 154);
    this.logo.position.set(width * 0.5, height * 0.5 - 10);
    this.barBack.position.set(width * 0.5, height * 0.5 + 130);
    this.barFill.position.copyFrom(this.barBack.position);
    this.credit.position.set(width - 24, height - 18);
  }

  /** Show screen with animations */
  public async show() {
    this.alpha = 1;
  }

  /** Hide screen with animations */
  public async hide() {
    await animate(this, { alpha: 0 } as ObjectTarget<this>, {
      duration: 0.3,
      ease: "linear",
      delay: 1,
    });
  }
}
