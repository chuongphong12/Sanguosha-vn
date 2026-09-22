const fs = require('fs');

let fContent = fs.readFileSync('src/app/screens/main/FormationScene.ts', 'utf8');
fContent = fContent.replace('../../../utils/playerNames', '../../utils/playerNames');
fs.writeFileSync('src/app/screens/main/FormationScene.ts', fContent, 'utf8');

let mContent = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf8');
mContent = mContent.replace(/hoveredCandidateID: this\.selectedCandidateID,/g, "");
mContent = mContent.replace(/onDashboardActionTap:[^,]*,/g, "");
mContent = mContent.replace(/onDashboardAvatarTap:[^,]*,/g, "");
fs.writeFileSync('src/app/screens/main/MainScreen.ts', mContent, 'utf8');

let wContent = fs.readFileSync('src/app/screens/main/WaitingRoomScene.ts', 'utf8');
wContent = wContent.replace(/import \{ TqsPlayerViewState, MatchClient \} from "\.\.\/\.\.\/\.\.\/game\/types";/g, 'import { TqsPlayerViewState } from "../../../game/types";\nimport { MatchClient } from "../../../client/MatchClient";');
wContent = wContent.replace(/p\.connected/g, 'p.role !== undefined');
fs.writeFileSync('src/app/screens/main/WaitingRoomScene.ts', wContent, 'utf8');
