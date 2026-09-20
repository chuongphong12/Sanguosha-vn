const fs = require('fs');

// 1. main.ts
let mainTs = fs.readFileSync('src/main.ts', 'utf-8');
mainTs = mainTs.replace(
  'resizeOptions: { minWidth: 768, minHeight: 820, letterbox: false }',
  'resizeOptions: { minWidth: 0, minHeight: 0, letterbox: false }'
);
fs.writeFileSync('src/main.ts', mainTs, 'utf-8');

// 2. MainScreen.ts
let mainScreenTs = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');
mainScreenTs = mainScreenTs.replace(
  'const MIN_LAYOUT_HEIGHT = 860;',
  ''
);
mainScreenTs = mainScreenTs.replace(
  /public resize\(width: number, height: number\): void \{\s*const scale = Math\.min\(1, Math\.max\(0\.01, height \/ MIN_LAYOUT_HEIGHT\)\);\s*this\.content\.scale\.set\(scale\);\s*this\.viewportWidth = width \/ scale;\s*this\.viewportHeight = height \/ scale;\s*this\.render\(\);\s*\}/,
  `public resize(width: number, height: number): void {
    const scale = 1; // Unscaled logical/CSS 1:1 mapping
    this.content.scale.set(scale);
    this.battleScene.scale.set(scale);
    this.viewportWidth = width / scale;
    this.viewportHeight = height / scale;
    this.render();
  }`
);
fs.writeFileSync('src/app/screens/main/MainScreen.ts', mainScreenTs, 'utf-8');
