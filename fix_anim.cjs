const fs = require('fs');
let c = fs.readFileSync('src/app/screens/main/AnimationManager.ts', 'utf8');

c = c.replace(/default:\n/, `        case "role-revealed":
          await this.playRoleRevealed(event);
          break;
        case "player-died":
          await this.playPlayerDied(event);
          break;
        case "match-ended":
          await this.playMatchEnded(event);
          break;
        default:\n`);

const additionalMethods = `
  private async playRoleRevealed(event: any) {
    const seat = this.seats.get(event.playerID);
    if (!seat) return;
    
    // Simple glow effect for role reveal
    const glow = new Graphics().circle(0, 0, 80).fill({ color: 0xffd700, alpha: 0.5 });
    glow.position.copyFrom(seat.position);
    this.parentContainer.addChild(glow);
    
    await animate(glow, { alpha: [0.5, 0], scale: [1, 1.5] }, { duration: 0.8 });
    glow.destroy();
  }

  private async playPlayerDied(event: any) {
    const seat = this.seats.get(event.playerID);
    if (!seat) return;
    
    const text = new Text({
      text: "Tử Trận",
      style: { fill: 0xff0000, fontSize: 40, fontWeight: "bold" }
    });
    text.anchor.set(0.5);
    text.position.copyFrom(seat.position);
    this.parentContainer.addChild(text);
    
    await animate(text, { scale: [3, 1], alpha: [0, 1] }, { duration: 0.5, easing: "ease-out" });
    await new Promise(r => setTimeout(r, 1000));
    await animate(text, { alpha: [1, 0] }, { duration: 0.5 });
    text.destroy();
  }

  private async playMatchEnded(event: any) {
    const overlay = new Graphics().rect(0, 0, 3000, 3000).fill({ color: 0x000000, alpha: 0.5 });
    this.parentContainer.addChild(overlay);
    await animate(overlay, { alpha: [0, 0.5] }, { duration: 0.5 });
    await new Promise(r => setTimeout(r, 1000));
    overlay.destroy();
  }
`;

c = c.replace(/}\n*$/, additionalMethods + "\n}");
fs.writeFileSync('src/app/screens/main/AnimationManager.ts', c, 'utf8');
