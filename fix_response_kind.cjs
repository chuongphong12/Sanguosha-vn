const fs = require('fs');
let content = fs.readFileSync('src/game/types/index.ts', 'utf8');
content = content.replace('export type { GamePrompt, PromptAnswer } from "./prompts";', 'export * from "./prompts";');
fs.writeFileSync('src/game/types/index.ts', content, 'utf8');

let pContent = fs.readFileSync('src/game/types/presentation.ts', 'utf8');
pContent = pContent.replace('export type ResponseKind =', 'export type PresentationResponseKind =');
pContent = pContent.replace(/response: ResponseKind/g, 'response: PresentationResponseKind');
fs.writeFileSync('src/game/types/presentation.ts', pContent, 'utf8');

let bContent = fs.readFileSync('src/game/engine/core/index.ts', 'utf8');
bContent = bContent.replace(/response: ResponseKind/g, 'response: any');
fs.writeFileSync('src/game/engine/core/index.ts', bContent, 'utf8');
