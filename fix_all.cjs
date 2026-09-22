const fs = require('fs');
let code = fs.readFileSync('src/game/engine/core/index.ts', 'utf8');

let replaced = false;
while (true) {
  const match = code.match(/\(function\s*\(\s*p\s*\)\s*\{\s*G\.prompt\s*=\s*p;\s*if\s*\(p\)\s*\{[\s\S]*?\}\s*\}\)\s*\(([\s\S]*?)\)\s*(?:;|,|)/);
  if (!match) break;
  replaced = true;
  
  const fullMatch = match[0];
  const innerArg = match[1];
  
  let replacer = `setPrompt(G, ${innerArg})`;
  if (fullMatch.endsWith(';')) replacer += ';';
  if (fullMatch.endsWith(',')) replacer += ',';
  
  // Replace the match in the code
  code = code.substring(0, match.index) + replacer + code.substring(match.index + fullMatch.length);
}

fs.writeFileSync('src/game/engine/core/index.ts', code, 'utf8');
console.log("Replaced:", replaced);
