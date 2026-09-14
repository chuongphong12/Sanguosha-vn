import { Graphics } from "pixi.js";
import { THEME } from "../theme";

export interface PanelOptions {
  width: number;
  height: number;
  color?: number;
  borderColor?: number;
  borderWidth?: number;
  radius?: number;
  alpha?: number;
}

export class Panel extends Graphics {
  constructor(options: PanelOptions) {
    super();

    const color = options.color ?? THEME.colors.panelBg;
    const borderColor = options.borderColor ?? THEME.colors.gold;
    const borderWidth = options.borderWidth ?? 1;
    const radius = options.radius ?? THEME.radius.md;
    const alpha = options.alpha ?? 0.96;

    this.roundRect(0, 0, options.width, options.height, radius)
      .fill({ color, alpha })
      .stroke({ color: borderColor, width: borderWidth, alpha: 0.9 });
  }
}
