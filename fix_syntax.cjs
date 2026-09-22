const fs = require('fs');
let mContent = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf8');
mContent = mContent.replace(/action\),/g, "");
mContent = mContent.replace(/onDashboardAvatarTap: \(\) => console\.log\("avatar tap"\),/g, ""); 
fs.writeFileSync('src/app/screens/main/MainScreen.ts', mContent, 'utf8');
