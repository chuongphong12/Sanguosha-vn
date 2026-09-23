const fs = require('fs');
let c = fs.readFileSync('src/app/screens/main/ResultScene.ts', 'utf8');

if (!c.includes('Button')) {
  c = c.replace(/import \{ Container, Text \} from "pixi.js";/, 'import { Container, Text } from "pixi.js";\nimport { Button } from "../../ui/Button";');
  
  const inject = `
  private btnLobby = new Button({
    width: 200,
    height: 48,
    label: "Quay lại sảnh",
    color: 0xaa2222,
    onClick: () => {
      window.location.reload(); // Quick CTA implementation since we don't have routing yet
    }
  });

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.details.anchor.set(0.5);
    this.addChild(this.title, this.details, this.btnLobby);
  }
`;

  c = c.replace(/constructor\(\) \{[\s\S]*?\}\n/, inject);
  
  c = c.replace(/this.details.text = (.*);/, `this.details.text = $1;\n    this.btnLobby.position.set(viewportWidth / 2 - 100, viewportHeight / 2 + 100);`);
  fs.writeFileSync('src/app/screens/main/ResultScene.ts', c, 'utf8');
}
