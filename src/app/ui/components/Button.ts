import { Container, Graphics, Text } from "pixi.js";
import { THEME } from "../theme";
import { GAME_FONT_FAMILY } from "../typography";
import { fitScale } from "../textLayout";

export interface ButtonOptions {
  label: string;
  width: number;
  height: number;
  onPress: () => void;
  color?: number;
  textColor?: number;
  disabled?: boolean;
  fontSize?: number;
  fontWeight?: "400" | "700";
  paddingX?: number;
  paddingY?: number;
}

export class Button extends Container {
  constructor(options: ButtonOptions) {
    super();

    const color = options.color ?? THEME.colors.ink;
    const textColor = options.textColor ?? THEME.colors.paper;
    const disabled = options.disabled ?? false;
    const width = options.width;
    const height = options.height;

    this.eventMode = disabled ? "none" : "static";
    this.cursor = disabled ? "default" : "pointer";
    this.alpha = disabled ? 0.38 : 1;

    this.addChild(
      new Graphics()
        .roundRect(0, 0, width, height, 7)
        .fill(color)
        .stroke({ color: THEME.colors.gold, width: 1, alpha: 0.75 }),
    );

    const paddingX = options.paddingX ?? 14;
    const paddingY = options.paddingY ?? 8;
    const maxTextWidth = Math.max(1, width - paddingX * 2);
    const maxTextHeight = Math.max(1, height - paddingY * 2);
    const fontSize = options.fontSize ?? (height >= 64 ? 14 : 13);

    const text = new Text({
      text: options.label.normalize("NFC"),
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize,
        fontWeight: options.fontWeight ?? "400",
        fill: textColor,
        align: "center",
        lineHeight: Math.round(fontSize * 1.25),
        wordWrap: true,
        wordWrapWidth: maxTextWidth,
      },
    });

    const textScale = fitScale(text, maxTextWidth, maxTextHeight);
    text.scale.set(textScale);
    text.anchor.set(0.5);
    text.position.set(width / 2, height / 2);
    this.addChild(text);

    if (!disabled) this.on("pointertap", options.onPress);
  }
}
