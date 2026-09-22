const fs = require('fs');
let c = fs.readFileSync('src/app/screens/main/WaitingRoomScene.ts', 'utf8');
c = c.replace(/import type \{ TqsPlayerViewState, any \} from "\.\.\/\.\.\/\.\.\/game\/types";/, 'import type { TqsPlayerViewState } from "../../../game/types";');
c = c.replace(/private match\?: any;/, 'private match?: any;');
fs.writeFileSync('src/app/screens/main/WaitingRoomScene.ts', c, 'utf8');
