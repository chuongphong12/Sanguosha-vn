const fs = require('fs');
let c = fs.readFileSync('src/app/screens/main/AnimationManager.ts', 'utf8');

if (!c.includes('dispose()')) {
  const inject = `
    public dispose() {
      this.queue = [];
      this.isPlaying = false;
      this.isDisposed = true;
    }

    private get prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
`;

  c = c.replace(/public enqueue/, inject + '\n    public enqueue');
  
  c = c.replace(/private isPlaying = false;/, 'private isPlaying = false;\n    private isDisposed = false;');
  
  c = c.replace(/if \(this\.isPlaying \|\| this\.queue\.length === 0\) return;/, 'if (this.isDisposed || this.isPlaying || this.queue.length === 0) return;');
  
  c = c.replace(/private async playEvent\(event: PresentationEvent\) \{/, 'private async playEvent(event: PresentationEvent) {\n      if (this.prefersReducedMotion) return;');

  fs.writeFileSync('src/app/screens/main/AnimationManager.ts', c, 'utf8');
}

// Ensure BattleScene cleans up AnimationManager
let bs = fs.readFileSync('src/app/screens/main/BattleScene.ts', 'utf8');
if (!bs.includes('animationManager.dispose()')) {
  bs = bs.replace(/public destroy\(\) \{/, 'public destroy() {\n    if (this.animationManager) this.animationManager.dispose();');
  fs.writeFileSync('src/app/screens/main/BattleScene.ts', bs, 'utf8');
}
