const fs = require('fs');
let content = fs.readFileSync('src/app/screens/main/BattleScene.ts', 'utf8');

if (!content.includes('AnimationManager')) {
  content = content.replace(
    'import { THEME } from "../../ui/theme";',
    'import { THEME } from "../../ui/theme";\nimport { AnimationManager } from "./AnimationManager";'
  );

  content = content.replace(
    'private dashboard?: Dashboard;',
    'private dashboard?: Dashboard;\n  private animationManager?: AnimationManager;\n  private lastSequence = 0;'
  );

  content = content.replace(
    'this.syncBackground(options.viewportWidth, options.viewportHeight);',
    `this.syncBackground(options.viewportWidth, options.viewportHeight);

    if (!this.animationManager) {
      this.animationManager = new AnimationManager(this, this.seatViews, () => viewerID);
    }

    if (G.stream) {
      const newEvents = G.stream.events.filter(e => e.sequence > this.lastSequence);
      if (newEvents.length > 0) {
        this.lastSequence = newEvents[newEvents.length - 1].sequence;
        this.animationManager.enqueue(newEvents);
      }
    }`
  );

  fs.writeFileSync('src/app/screens/main/BattleScene.ts', content, 'utf8');
}
