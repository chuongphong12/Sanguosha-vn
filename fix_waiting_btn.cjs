const fs = require('fs');

let c = fs.readFileSync('src/app/screens/main/WaitingRoomScene.ts', 'utf8');

if (!c.includes('Button')) {
  c = c.replace(/import \{ Container, Text \} from "pixi.js";/, 'import { Container, Text } from "pixi.js";\nimport { Button } from "../../ui/Button";');
  
  const inject = `
  private btnStart = new Button({
    width: 200,
    height: 48,
    text: "Bắt đầu",
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.matchInfo.anchor.set(0.5);
    this.btnStart.eventMode = 'static';
    this.btnStart.cursor = 'pointer';
    this.addChild(this.title, this.matchInfo, this.btnStart);
  }
`;

  c = c.replace(/constructor\(\) \{[\s\S]*?\}\n/, inject);
  
  const syncInject = `
  public sync(
    G: TqsPlayerViewState,
    match: any,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.title.position.set(viewportWidth / 2, 50);
    this.matchInfo.position.set(viewportWidth / 2, viewportHeight / 2 - 50);
    this.btnStart.position.set(viewportWidth / 2 - 100, viewportHeight / 2 + 50);

    const isHost = match?.currentViewerID === "0";
    this.btnStart.visible = isHost;
    
    // Make sure we only attach the listener once for this specific state
    this.btnStart.removeAllListeners();
    if (isHost) {
      this.btnStart.on('pointerdown', () => match.move("startGame"));
    }

    const players = Object.keys(G.players).length;
    this.matchInfo.text = \`Người chơi: \${players}/\${G.seatOrder.length}\\nĐang chờ người chơi khác...\`;
  }
`;

  c = c.replace(/public sync\([\s\S]*?\}\n/m, syncInject);
  fs.writeFileSync('src/app/screens/main/WaitingRoomScene.ts', c, 'utf8');
}
