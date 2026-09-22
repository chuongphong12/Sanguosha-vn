const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/game/g, '../../../game');
  content = content.replace(/\.\.\/\.\.\/\.\.\/utils/g, '../../../utils');
  fs.writeFileSync(file, content, 'utf8');
}

fix('src/app/screens/main/FormationScene.ts');
fix('src/app/screens/main/ResultScene.ts');
fix('src/app/screens/main/WaitingRoomScene.ts');

let index = fs.readFileSync('src/game/types/index.ts', 'utf8');
index = index.replace('export * from "./prompts";', 'export type { GamePrompt, PromptAnswer } from "./prompts";'); 
fs.writeFileSync('src/game/types/index.ts', index, 'utf8');
