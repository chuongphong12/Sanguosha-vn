const fs = require('fs');
let code = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');

// Imports
const imports = `import { WaitingRoomScene } from "./WaitingRoomScene";\nimport { FormationScene } from "./FormationScene";\nimport { ResultScene } from "./ResultScene";\n`;
code = code.replace('import { BattleScene } from "./BattleScene";', imports + 'import { BattleScene } from "./BattleScene";');

// Instantiations
const scenes = `  private readonly waitingRoomScene = new WaitingRoomScene();
  private readonly formationScene = new FormationScene();
  private readonly resultScene = new ResultScene();
`;
code = code.replace('  private readonly battleScene = new BattleScene();', scenes + '  private readonly battleScene = new BattleScene();');

// Add to children
code = code.replace('    this.addChild(this.battleScene);', '    this.addChild(this.waitingRoomScene, this.formationScene, this.resultScene, this.battleScene);');

// Scaling (already set to 1, but we should scale these too just in case)
code = code.replace('    this.battleScene.scale.set(scale);', '    this.battleScene.scale.set(scale);\n    this.waitingRoomScene.scale.set(scale);\n    this.formationScene.scale.set(scale);\n    this.resultScene.scale.set(scale);');

// Clean up old draw methods
code = code.replace(/private drawWaitingRoom\(\): void \{[\s\S]*?private drawBackground\(\): void \{/, 'private drawBackground(): void {');
code = code.replace(/private drawGeneralCandidates\([\s\S]*?private drawActions\(/, 'private drawActions(');

// Actually, replacing render logic:
const newRender = `
    if (this.state && this.match) {
      const G = this.state.G;
      this.waitingRoomScene.visible = G.status === "waiting-room";
      this.formationScene.visible = G.status === "lord-selection" || G.status === "general-selection";
      this.battleScene.visible = G.status === "playing";
      this.resultScene.visible = G.status === "ended";

      if (this.waitingRoomScene.visible) this.waitingRoomScene.sync(G, this.match, this.viewportWidth, this.viewportHeight);
      if (this.formationScene.visible) this.formationScene.sync(G, this.viewportWidth, this.viewportHeight);
      if (this.resultScene.visible) this.resultScene.sync(G, this.viewportWidth, this.viewportHeight);
      
      if (this.battleScene.visible) {
        this.battleScene.sync(
          G,
          this.state.ctx,
          this.match.currentViewerID,
          {
            viewportWidth: this.effectiveWidth,
            viewportHeight: this.viewportHeight,
            selectedCardIDs: this.selectedCardIDs,
            selectedTargetIDs: this.selectedTargetIDs,
            selectedZoneChoices: this.selectedZoneChoices,
            hoveredCandidateID: this.selectedCandidateID,
            onSeatTap: (pid) => this.handleSeatTap(pid),
            onDashboardCardTap: (cid) => this.handleCardTap(cid),
            onDashboardActionTap: (action) => console.log("action tap:", action),
            onDashboardAvatarTap: () => console.log("avatar tap"),
          },
        );
      }
      
      this.drawBackground();
      
      if (G.status !== "waiting-room") {
        this.drawTitle();
      }
      if (G.status === "playing") {
        this.drawViewerSelector(G);
        this.drawLog(G);
        this.drawPrivateArea(G);
        this.drawStatus(G);
        const viewerID = this.match.currentViewerID;
        this.drawActions(G, viewerID);
      }
    } else {
      this.waitingRoomScene.visible = false;
      this.formationScene.visible = false;
      this.battleScene.visible = false;
      this.resultScene.visible = false;
    }
`;

code = code.replace(/if \(this\.state && this\.match && this\.state\.G\.status !== "waiting-room"\) \{[\s\S]*?this\.drawActions\(G, viewerID\);\s*\}/, newRender);

fs.writeFileSync('src/app/screens/main/MainScreen.ts', code, 'utf-8');
