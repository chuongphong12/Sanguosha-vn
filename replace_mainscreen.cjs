const fs = require('fs');

let content = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');

const renderLogic = `
    this.clearContent();

    if (this.state && this.match && this.state.G.status !== "waiting-room") {
      this.battleScene.visible = true;
      this.battleScene.sync(
        this.state.G,
        this.state.ctx,
        this.match.currentViewerID,
        {
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          selectedCardIDs: this.selectedCardIDs,
          selectedTargetIDs: this.selectedTargetIDs,
          onSeatTap: (pid) => this.handleSeatTap(pid),
          onDashboardCardTap: (cid) => this.handleCardTap(cid)
        }
      );
    } else {
      this.battleScene.visible = false;
      this.drawBackground();
    }
`;

content = content.replace(/this\.clearContent\(\);\s*this\.drawBackground\(\);\s*this\.drawTitle\(\);/, renderLogic.trim() + '\n    this.drawTitle();');
content = content.replace(/\s*this\.drawSeats\(G\);\n/, '\n');

const dashboardPattern = /const dashboard = new Dashboard.*?this\.content\.addChild\(dashboard\);/s;
content = content.replace(dashboardPattern, '// Dashboard is now rendered by BattleScene');

fs.writeFileSync('src/app/screens/main/MainScreen.ts', content, 'utf-8');
console.log("Done");
