const fs = require('fs');
let code = fs.readFileSync('src/game/engine/presentation.ts', 'utf8');

code = code.replace(
  'Omit<PresentationEvent, "sequence" | "matchEpoch" | "turn">',
  'PresentationEventInput'
);

code = code.replace(
  'import { PresentationEvent } from "../types";',
  'import { PresentationEvent } from "../types";\n\ntype DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;\nexport type PresentationEventInput = DistributiveOmit<PresentationEvent, "sequence" | "matchEpoch" | "turn" | "correlationID"> & { correlationID?: string };'
);

fs.writeFileSync('src/game/engine/presentation.ts', code, 'utf8');
