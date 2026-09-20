const fs = require('fs');

let content = fs.readFileSync('src/app/screens/main/MainScreen.ts', 'utf-8');

const handlers = `
  private handleSeatTap(playerID: string): void {
    const G = this.state?.G;
    if (!G) return;
    const isChoosingTarget =
      this.selectedCardIDs.size > 0 || this.selectedCandidateID !== null;
    const targetOrder = this.selectedTargetIDs.indexOf(playerID);
    const selected = targetOrder >= 0;
    const selectableTarget = selected || this.canSelectTarget(G, playerID);

    if (selectableTarget) {
      if (selected) {
        // Deselect logic
        const selectedCardID = [...this.selectedCardIDs][0];
        const selectedCardName = selectedCardID
          ? G.cards[selectedCardID]?.definitionID
          : null;
        if (selectedCardName === "borrowed-sword")
          this.selectedTargetIDs.splice(targetOrder);
        else this.selectedTargetIDs.splice(targetOrder, 1);
      } else {
        // Select logic
        const maximum = this.getEffectiveTargetCount(G).maximum;
        if (this.selectedTargetIDs.length < maximum)
          this.selectedTargetIDs.push(playerID);
      }
      this.render();
    }
  }

  private handleCardTap(cardID: string): void {
    const selected = this.selectedCardIDs.has(cardID);
    if (selected) {
      this.selectedCardIDs.delete(cardID);
    } else {
      this.selectedCardIDs.add(cardID);
    }
    // Automatically deselect targets if card changes and targets become invalid
    this.selectedTargetIDs = this.selectedTargetIDs.filter((id) => this.canSelectTarget(this.state!.G, id));
    this.render();
  }
`;

content = content.replace('private drawWaitingRoom(): void {', handlers + '\n  private drawWaitingRoom(): void {');
fs.writeFileSync('src/app/screens/main/MainScreen.ts', content, 'utf-8');
