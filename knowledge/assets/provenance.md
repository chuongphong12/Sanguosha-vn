# Asset provenance and production readiness

Scope: source assets in the game baseline recorded by [source-baseline.json](../source-baseline.json). This knowledge repository contains documentation, not the game art/audio or generated asset bundles. Native executable behavior is a rules reference, not evidence of asset reuse rights.

## Verified pipeline

`raw-assets/` is the tracked build input. At the source baseline it contains 2,433 files totalling 182,828,266 bytes, under `main{m}{tps}/` and `preload{m}/`. Art, UI textures and sounds remain in the game repository.

`scripts/assetpack-vite-plugin.ts` processes these inputs with AssetPack through Vite. It writes generated outputs under `public/assets/` and a manifest at `src/manifest.json`; the game `.gitignore` excludes both. `scripts/cache-assets.mjs` saves/restores generated asset output through `node_modules/.cache/assetpack-outputs/`. `SKIP_LOW_RES=true` changes generated resolutions; it does not establish source completeness or asset permission.

`src/app/ui/assetAliases.ts` maps current card, general, equipment, faction and UI identifiers to assets. `tests/ui/asset-aliases.test.ts` checks paths and current legacy catalogue coverage. That test is not a Quốc Chiến catalogue audit or a license review. Existing Identity role images and aliases are historical implementation inputs, not Quốc Chiến game concepts.

## Rights evidence

The former provenance note described inherited community/open-source assets and non-commercial use, but did not identify their original authors, acquisition URLs or applicable licenses. No license/notice document was found among the tracked `raw-assets/` paths in this baseline. These observations do not prove that permission exists or that no external evidence can be recovered.

| Collection | Source evidence available here | Rights status | Quốc Chiến readiness |
| --- | --- | --- | --- |
| Existing art/audio under `raw-assets/` | Tracked game inputs and alias mappings | **Unverified per asset**; original author/source/license evidence remains to be established | Catalogue and hidden-identity usage need a separate audit |
| AssetPack outputs | Generated from those inputs | Inherit the input permission requirements | Rebuildable output, not an independent permission grant |
| Future native-reference art/audio | Not imported by this documentation migration | Not authorized by citing the native source | Do not enable until provenance and product mapping are recorded |

Do not carry forward the old blanket statements that all assets were approved or that an open-source/non-commercial project automatically has permission. Technical existence tests and prior use do not answer that question.

## Required record when adding or replacing an asset

Record the game path or collection identifier, original source URL, author/rightsholder, license or permission evidence, attribution requirements, modifications and intended usage. Use an explicit unresolved status where evidence is missing. Do not invent an author/license or silently treat a reference game's binary distribution as reusable source art.

For the Quốc Chiến cutover, reconcile assets against the enabled-content manifest. Verify each visible general/card/equipment mapping, fallback behavior and private/public identity state; avoid hidden-name leakage through resolved art. This registry is a provenance gap assessment, not a claim that those product gates have already passed.
