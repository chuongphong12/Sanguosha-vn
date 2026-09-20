const fs = require('fs');

let content = fs.readFileSync('src/app/ui/Dashboard.ts', 'utf-8');

const oldMath = `    const maxSpan = Math.PI / 4;
    const anglePerCard = Math.min(0.08, maxSpan / Math.max(1, hand.length));
    const totalAngle = anglePerCard * (hand.length - 1);
    const startAngle = -totalAngle / 2;`;

const newMath = `    // Horizontal layout
    const maxSpacing = 80;
    const totalAvailable = handAreaWidth - cardW;
    const requiredSpacing = hand.length > 1 ? totalAvailable / (hand.length - 1) : maxSpacing;
    const spacing = Math.min(maxSpacing, requiredSpacing);
    const startX = handLeft + (handAreaWidth - (cardW + (hand.length - 1) * spacing)) / 2;`;

content = content.replace(oldMath, newMath);

const oldPositions = `        const selected = options.selectedCardIDs.has(cardID);
        const angle = startAngle + index * anglePerCard;

        const baseX = centerX + radius * Math.sin(angle);
        const baseY = centerY - radius * Math.cos(angle);
        const baseRotation = angle;`;

const newPositions = `        const selected = options.selectedCardIDs.has(cardID);
        
        const baseX = startX + index * spacing;
        const baseY = this.panelHeight - cardH - 10;
        const baseRotation = 0;`;

content = content.replace(oldPositions, newPositions);

// Also remove centerX and centerY and radius
content = content.replace(/const radius = 1200;\n\s*const centerX = \(handLeft \+ roleLeft\) \/ 2;\n\s*const centerY = this\.panelHeight \+ radius - 90;/g, '');

fs.writeFileSync('src/app/ui/Dashboard.ts', content, 'utf-8');
