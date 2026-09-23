const fs = require('fs');
let c = fs.readFileSync('src/app/screens/main/AnimationManager.ts', 'utf8');

if (!c.includes('Graphics')) {
  c = c.replace(/import \{ Text \}/, 'import { Text, Graphics }');
}
c = c.replace(/easing: "ease-out"/, 'ease: "ease-out"');

fs.writeFileSync('src/app/screens/main/AnimationManager.ts', c, 'utf8');
