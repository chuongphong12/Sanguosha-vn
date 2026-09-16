import { Container, Graphics } from "pixi.js";

const defaultRoundedBoxOptions = {
  color: 0xffffff,
  width: 350,
  height: 600,
  shadow: true,
  shadowColor: 0xa0a0a0,
  shadowOffset: 22,
};

export type RoundedBoxOptions = typeof defaultRoundedBoxOptions;

/**
 * Generic rounded box based on PIXI Graphics that can be resized freely.
 */
export class RoundedBox extends Container {
  /** The rectangular area */
  private image: Graphics;
  /** Optional shadow matching the box image, with y offest */
  private shadow?: Graphics;

  constructor(options: Partial<RoundedBoxOptions> = {}) {
    super();
    const opts = { ...defaultRoundedBoxOptions, ...options };
    this.image = new Graphics();
    this.image.roundRect(
      -opts.width * 0.5,
      -opts.height * 0.5,
      opts.width,
      opts.height,
      34,
    );
    this.image.fill(opts.color);
    this.addChild(this.image);

    if (opts.shadow) {
      this.shadow = new Graphics();
      this.shadow.roundRect(
        -opts.width * 0.5,
        -opts.height * 0.5 + opts.shadowOffset,
        opts.width,
        opts.height,
        34,
      );
      this.shadow.fill(opts.shadowColor);
      this.addChildAt(this.shadow, 0);
    }
  }

  /** Get the base width, without counting the shadow */
  public get boxWidth() {
    return this.image.width;
  }

  /** Get the base height, without counting the shadow */
  public get boxHeight() {
    return this.image.height;
  }
}
