const fs = require('fs');
const files = [
  'src/app/ui/CardView.ts',
  'src/app/ui/Dashboard.ts',
  'src/app/ui/PlayerAvatar.ts',
  'src/app/ui/SeatView.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\\`/g, '`');
  fs.writeFileSync(file, content, 'utf-8');
}
