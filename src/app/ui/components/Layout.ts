import { Container } from "pixi.js";
import { THEME } from "../theme";

export class VBox extends Container {
  public gap: number;

  constructor(gap: number = THEME.spacing.md) {
    super();
    this.gap = gap;
  }

  override addChild<U extends Container[]>(...children: U): U[0] {
    for (const child of children) {
      if (this.children.length > 0) {
        const lastChild = this.children[this.children.length - 1];
        child.y = lastChild.y + lastChild.height + this.gap;
      }
      super.addChild(child);
    }
    return children[0];
  }
}

export class HBox extends Container {
  public gap: number;

  constructor(gap: number = THEME.spacing.md) {
    super();
    this.gap = gap;
  }

  override addChild<U extends Container[]>(...children: U): U[0] {
    for (const child of children) {
      if (this.children.length > 0) {
        const lastChild = this.children[this.children.length - 1];
        child.x = lastChild.x + lastChild.width + this.gap;
      }
      super.addChild(child);
    }
    return children[0];
  }
}
