const fs = require('fs');

let anim = fs.readFileSync('src/app/screens/main/AnimationManager.ts', 'utf8');
if (!anim.includes('import { Graphics }') && !anim.includes('Graphics, Text')) {
  anim = anim.replace(/import \{ Text \}/, 'import { Text, Graphics }');
}
fs.writeFileSync('src/app/screens/main/AnimationManager.ts', anim, 'utf8');

let res = fs.readFileSync('src/app/screens/main/ResultScene.ts', 'utf8');
res = res.replace(/color: 0xaa2222,/, '/* color removed */');
fs.writeFileSync('src/app/screens/main/ResultScene.ts', res, 'utf8');
