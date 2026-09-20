import { Container } from "pixi.js";

export interface FlexContainerOptions {
  direction?: "row" | "column";
  gap?: number;
  maxWidth?: number;
}

export class FlexContainer extends Container {
  public direction: "row" | "column";
  public gap: number;
  public maxWidth?: number;

  constructor(options: FlexContainerOptions = {}) {
    super();
    this.direction = options.direction ?? "row";
    this.gap = options.gap ?? 8;
    this.maxWidth = options.maxWidth;
  }

  public layout(): void {
    if (this.children.length === 0) return;

    const isRow = this.direction === "row";

    // Reset scales to measure natural bounds
    for (const child of this.children) {
      child.scale.set(1);
    }

    // Assumes child.width and child.height report the unscaled size.
    // In Pixi.js, setting width/height adjusts scale, and reading it reads bounding box.
    // We will read bounds assuming scale is 1.
    const childSizes = this.children.map((c) => ({
      width: c.width,
      height: c.height,
    }));

    const gapSpace = Math.max(0, this.children.length - 1) * this.gap;
    let requestedMainSize = 0;

    for (const size of childSizes) {
      requestedMainSize += isRow ? size.width : size.height;
    }

    let scale = 1;
    if (
      isRow &&
      this.maxWidth !== undefined &&
      this.maxWidth > 0 &&
      requestedMainSize + gapSpace > this.maxWidth
    ) {
      const available = Math.max(1, this.maxWidth - gapSpace);
      scale = available / requestedMainSize;
    }

    let mainCursor = 0;
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      const origSize = childSizes[i];

      child.scale.set(scale);

      const mSize = (isRow ? origSize.width : origSize.height) * scale;
      const cSize = (isRow ? origSize.height : origSize.width) * scale;

      // In the layoutActionRow paradigm, Button centers were used because Button might have anchor 0.5.
      // But if we just position the container itself, we should position children sequentially.
      if (isRow) {
        // If button uses center anchor, we add half width to its x.
        child.position.set(mainCursor + mSize / 2, 0);
      } else {
        child.position.set(0, mainCursor + mSize / 2);
      }

      mainCursor += mSize + this.gap;
    }
  }
}
