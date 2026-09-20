const fs = require('fs');

let mainScreen = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');

mainScreen = mainScreen.replace(
  'private selectedPromptPlayerIDs: string[] = [];',
  'private selectedPromptPlayerIDs: string[] = [];\n  private isLogOpen: boolean = true;'
);

mainScreen = mainScreen.replace(
  'private get isShowingRolePopup(): boolean {',
  'private get effectiveWidth(): number {\n    return this.isLogOpen ? this.viewportWidth - 280 : this.viewportWidth;\n  }\n\n  private get isShowingRolePopup(): boolean {'
);

mainScreen = mainScreen.replace(
  /viewportWidth: this\.viewportWidth,/g,
  'viewportWidth: this.effectiveWidth,'
);

mainScreen = mainScreen.replace(
  /const selectorLeft = this\.viewportWidth - 280 - 16 - selectorWidth;/g,
  'const selectorLeft = this.effectiveWidth - 16 - selectorWidth;'
);

const drawLogOriginal = `  private drawLog(G: TqsPlayerViewState): void {
    const width = 280;
    const height = this.viewportHeight;
    const x = this.viewportWidth - width;
    const y = 0;

    this.addPanel(x, y, width, height, 0x181411, THEME.colors.gold, 0.85);`;

const drawLogNew = `  private drawLog(G: TqsPlayerViewState): void {
    // Toggle button
    const toggleW = 60;
    const toggleH = 40;
    const toggleX = this.effectiveWidth - toggleW - 16;
    const toggleY = 16;
    this.addButton(
      this.isLogOpen ? ">>>" : "<<<",
      toggleX + toggleW / 2,
      toggleY + toggleH / 2,
      toggleW,
      toggleH,
      () => {
        this.isLogOpen = !this.isLogOpen;
        this.render();
      }
    );

    if (!this.isLogOpen) return;

    const width = 280;
    const height = this.viewportHeight;
    const x = this.viewportWidth - width;
    const y = 0;

    this.addPanel(x, y, width, height, 0x181411, THEME.colors.gold, 0.85);`;

mainScreen = mainScreen.replace(drawLogOriginal, drawLogNew);

mainScreen = mainScreen.replace(/layoutActionRow\(\s*this\.viewportWidth,/g, 'layoutActionRow(this.effectiveWidth,');

fs.writeFileSync('src/app/screens/main/MainScreen.ts', mainScreen, 'utf-8');
