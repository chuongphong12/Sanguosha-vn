const fs = require('fs');

// Fix AnimationManager
let anim = fs.readFileSync('src/app/screens/main/AnimationManager.ts', 'utf8');
if (!anim.includes('import { Graphics }')) {
  anim = anim.replace(/import \{ Text \}/, 'import { Text }\nimport { Graphics }');
}
anim = anim.replace(/ease: "ease-out"/, 'ease: "easeOut"');
fs.writeFileSync('src/app/screens/main/AnimationManager.ts', anim, 'utf8');

// Fix ResultScene
let result = fs.readFileSync('src/app/screens/main/ResultScene.ts', 'utf8');
result = result.replace(/label: "Quay lại sảnh"/, 'text: "Quay lại sảnh"');
fs.writeFileSync('src/app/screens/main/ResultScene.ts', result, 'utf8');
