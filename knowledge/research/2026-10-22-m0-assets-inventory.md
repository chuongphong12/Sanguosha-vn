# M0.1 asset inventory — existing inputs versus release readiness

Observed 2026-10-22. Game input `1fc4ff20bf261c3b7cf85c9d5c6c3a4b90e4cbae`; native source `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This is a tracked-file/alias investigation supporting [M0.1 — Chốt manifest nội dung và tài nguyên](https://github.com/chuongphong12/Sanguosha-vn/issues/27), not a rendering test or a complete native-content mapping.

## Reproducible tracked inventory

[The data artifact](data/2026-10-22-m0-assets-inventory.json) contains every tracked raw input path, byte size and SHA256, plus alias values, group counts, source identifiers and limitations. Scope comes from `git ls-files -z -- raw-assets` at the game input; generated output, untracked additions and the original distribution are not mixed into that count.

There are **2,433 tracked files / 182,828,266 bytes**, including one empty `.gitkeep`. Notable groups are 615 general files, 404 audio files, 63 files in the cards group, 29 in equips, 37 animations, six fonts and 1,219 UI files. These categories are filesystem groups rather than a count of supported gameplay items.

The general group contains 289 avatar files, 301 card files and 25 files directly under the group root. Audio contains 62 card, 72 death, 15 equip, 233 skill and 22 system files. A raw filename does not establish that it matches a current native variant, provides all required cues or carries reuse permission.

## Current application mapping

TypeScript AST extraction of `src/app/ui/assetAliases.ts` at the game input yields:

| Mapping              | Declared entries | Exact-case tracked target path |
| -------------------- | ---------------- | ------------------------------ |
| General portrait     | 27               | All 27 exist                   |
| General card face    | 27               | All 27 exist                   |
| Card art             | 15               | All 15 exist                   |
| Equipment art / icon | 17 / 17          | All exist                      |
| Faction icon         | 4                | All 4 exist                    |

Role art, backs, HP markers, background and button aliases also resolve to exact tracked paths. SHA256 of the alias source is `f8097dbece63bc57955760e520afcfab8e702fce4a11a5a12a6961b5ca9020e4`, matching the exact-worktree GitNexus file hash.

This is coverage of declared **legacy** aliases, not all target Quốc Chiến content. `tests/ui/asset-aliases.test.ts` imports the legacy card/general catalogues and compares those keys; it checks file existence, not target-manifest coverage, image meaning, permission or hidden-identity behavior. No gameplay or browser test was run in this investigation.

Source references at the game input: `assetAliases.ts:1–168` defines the legacy typed aliases; `tests/ui/asset-aliases.test.ts:19–95` binds the checks to legacy catalogues and filesystem existence. `scripts/assetpack-vite-plugin.ts:11–67` consumes `raw-assets`, creates the generated manifest and outputs assets via Vite; `.gitignore` excludes `public/assets` and `src/manifest.json`. Generated output is not a new rights source.

## Native resources and provenance boundary

The pinned native **source checkout** has no top-level `image`, `audio` or `skin` directory in this workspace. This observation does not say the original game had no resources; it means source checkout presence cannot supply a complete art/audio collection here.

The originally attached 2.3.41.1 distribution remains a separate background resource. It was not counted or audited for per-ID coverage in this slice and cannot override the 2.3.43-beta2 rule authority. Any future import needs explicit source/version, mapping and permission evidence.

No tracked raw path matches the scanned conventional permission filenames (`LICENSE`/`LICENCE`, `COPYING`, `NOTICE`, `ATTRIBUTION`, `AUTHORS`, `CREDITS`, including suffix forms). That is a bounded filename observation, not a claim that no external permission evidence exists. The previously recorded [provenance gap](../assets/provenance.md) therefore remains unresolved; no new blanket license claim is made.

## Release gap and next consumer

The user selected full art/audio **before** the first small-group release. M0.1 must join the final package/general/card/skill manifest to this file inventory and any approved resource sources, recording exact variant/alias mappings and required sounds. Matching a transliteration or reusing an existing portrait does not by itself prove equivalent gameplay identity or complete cue coverage.

For each in-scope item, record art and sound expectations, source and rights evidence, aliases/load results, required attribution and private/public usage. Missing or unresolved entries remain explicit M5 work; fallback art cannot satisfy the agreed release gate. Texture/audio decoding, actual UI use, private-view leakage and packaged browser delivery still need tests on the real release client.

## Graph and execution evidence

Graph-first exploration used the absolute engine worktree, its context, an asset/general/card/loading concept query and alias definitions. Selected flows reached `PlayerAvatar.resolvePortrait` and dashboard/card components. The index was one lock-only commit behind; the alias file's indexed/current hash matched. These sampled graph results are not a complete dependency or privacy audit.

Machine-local evidence: Windows Temp `tqs-m0-assets-graph.json`, `tqs-m0-assets-inventory.mjs` and `tqs-m0-assets-inventory.json`. The latter's stable data is copied into this knowledge artifact. The script uses TypeScript AST literals, the Git tracked path set and filesystem sizes/hashes; it does not execute asset modules, import binary assets or alter the game source.
