const fs = require('fs');
let content = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf8');

content = content.replace(/this\.handleSeatTap\(pid\)/g, "console.log('seat tap', pid)");
content = content.replace(/this\.handleCardTap\(cid\)/g, "console.log('card tap', cid)");
content = content.replace(/selectedZoneChoices: this\.selectedZoneChoices,/g, "");

content = content.replace(/this\.drawBackground\(\);/g, "");
content = content.replace(/this\.drawTitle\(\);/g, "");
content = content.replace(/this\.drawViewerSelector\(G\);/g, "");
content = content.replace(/this\.drawLog\(G\);/g, "");
content = content.replace(/this\.drawPrivateArea\(G\);/g, "");
content = content.replace(/this\.drawStatus\(G\);/g, "");
content = content.replace(/const viewerID = this\.match\.currentViewerID;\s*this\.drawActions\(G, viewerID\);/g, "");

fs.writeFileSync('src/app/screens/main/MainScreen.ts', content, 'utf8');
