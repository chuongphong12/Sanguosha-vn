const fs = require('fs');
let code = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');
code = code.replace(
  'private selectedPromptPlayerIDs: string[] = [];',
  'private selectedPromptPlayerIDs: string[] = [];\n  private isLogOpen = true;\n  private get effectiveWidth(): number { return this.isLogOpen ? this.viewportWidth - 280 : this.viewportWidth; }'
);
fs.writeFileSync('src/app/screens/main/MainScreen.ts', code, 'utf-8');
