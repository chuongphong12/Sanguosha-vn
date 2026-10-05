import { FlexContainer } from "./FlexContainer";
import { Graphics } from "pixi.js";

export interface ActionRowLayout {
  centers: number[];
  widths: number[];
  centerY: number;
}

export function layoutActionRow(
  viewportWidth: number,
  viewportHeight: number,
  buttonWidths: number[],
  options: {
    rightInset?: number;
    bottomInset?: number;
    gap?: number;
    buttonHeight?: number;
  } = {},
): ActionRowLayout {
  const rightInset = options.rightInset ?? 314;
  const bottomInset = options.bottomInset ?? 280;
  const gap = options.gap ?? 8;
  const buttonHeight = options.buttonHeight ?? 48;

  const container = new FlexContainer({
    direction: "row",
    gap,
    maxWidth: Math.max(1, viewportWidth - rightInset * 2),
  });

  const dummies = buttonWidths.map((w) => {
    const g = new Graphics();
    g.beginFill(0);
    g.drawRect(0, 0, w, buttonHeight);
    g.endFill();
    container.addChild(g);
    return g;
  });

  container.layout();

  const lastChild = dummies[dummies.length - 1];
  // child.x is the center, child.width is the scaled width
  const totalWidth = lastChild ? lastChild.x + lastChild.width / 2 : 0;
  const containerLeft = viewportWidth - rightInset - totalWidth;

  return {
    centers: dummies.map((d: any) => containerLeft + d.x),
    widths: dummies.map((d: any) => Math.max(1, Math.floor(d.width))),
    centerY: viewportHeight - bottomInset - buttonHeight / 2,
  };
}
