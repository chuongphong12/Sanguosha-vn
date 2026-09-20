const fs = require('fs');
const files = [
  'src/app/screens/main/BattleScene.ts',
  'src/app/ui/CardView.ts',
  'src/app/ui/Dashboard.ts',
  'src/app/ui/PlayerAvatar.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/catch \([^)]+\) {\s*}/g, 'catch (e) { /* ignore */ }');
  fs.writeFileSync(file, content, 'utf-8');
}
