const fs = require('fs');

let res = fs.readFileSync('src/app/screens/main/ResultScene.ts', 'utf8');

const inject = `
  private btnLobby = new Button({
    width: 200,
    height: 48,
    text: "Quay lại sảnh",
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.details.anchor.set(0.5);
    this.btnLobby.on('pointerdown', () => window.location.reload());
    this.btnLobby.eventMode = 'static';
    this.btnLobby.cursor = 'pointer';
    this.addChild(this.title, this.details, this.btnLobby);
  }
`;

res = res.replace(/private btnLobby[\s\S]*?constructor\(\) \{[\s\S]*?\}\n/, inject);
fs.writeFileSync('src/app/screens/main/ResultScene.ts', res, 'utf8');
