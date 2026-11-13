## Problem Statement

Source documentation mixes obsolete Standard 2013 rules, current Hegemony contracts and revision-specific checkpoints. Developers and AI agents need current source-aligned knowledge with documentation available after ordinary clone and branch switching.

## Solution

Create a fresh public knowledge repository under the game owner's namespace, curate Hegemony-first knowledge, and consume exact reviewed snapshots through a subtree. Keep minimal operational bootstrap in the game. The user approved the complete design on 2026-10-15 (interview Q1-Q10).

## User Stories

1. As a developer, I can clone the game with ordinary Git and read its matching documentation immediately.
2. As an AI agent, I can reach current contracts through concise bootstrap pointers.
3. As a developer, I can switch between migrated branches and obtain each branch's documentation snapshot.
4. As a rules researcher, I can distinguish pinned native semantics from implemented normalized contracts.
5. As a reviewer, I can distinguish fixture validation from playable production integration.
6. As a contributor, I can update canonical knowledge and import a specific full commit without silently following a moving branch.
7. As a contributor, synchronization preserves my dirty local work and reports conflicts.
8. As a maintainer, I can verify imported bytes offline and verify their provenance against the canonical commit when fetching is available.
9. As a maintainer, I retain useful shared engineering and provenance knowledge while retiring obsolete Standard manuals.
10. As a reviewer, I retain original revision-scoped evidence without interpreting old passing test totals as present certification.
11. As a maintainer, builds consume the tracked snapshot without requiring another repository checkout.
12. As the repository owner, I can provision the selected public knowledge repository without sharing credentials.

## Implementation Decisions

- Public canonical knowledge repository: chuongphong12/Sanguosha-vn-knowledge; fresh initial history, no history filtering.
- Squashed subtree snapshot in the game; separate lock records canonical URL, full documentation commit and tree identity. Snapshot equality does not certify semantic correctness.
- Knowledge separates rules authority, engine contracts, current roadmap, reusable research, assets and revision-scoped evidence.
- Rules baseline remains QSanguosha-QuocChien 2.3.43-beta2 at ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f.
- Curate from Hegemony branch baseline 4b19fddcb6547066de0db0ae078c0db7642877ba. Production still registers the Standard runtime; paired setup ready does not establish a playable Hegemony game.
- Retain game README, agent bootstrap, lifecycle configuration and skills. Keep current specifications/tickets in the existing game GitHub Issues tracker.
- Publication of the canonical docs commit precedes game snapshot publication. Related code and snapshot changes belong in the same game review; import never happens implicitly during checkout/build.
- Owner-only repository provisioning is external to local preparation. Current collaborator cannot create under the owner's personal namespace.

## Testing Decisions

Accepted public seams: documentation navigation/source attribution; the CLI synchronization and verification command exercised with real temporary Git repositories; plain clone/branch switch at distinct snapshot revisions; existing game checks/build. Verify stale/missing locks, modified imported bytes, missing commits, local-edit preservation, reproducible snapshot identity and offline operation. Review Standards and Spec independently against the fixed migration base.

## Out of Scope

Game-engine behavior changes, production Hegemony cutover, automatic engine/main merge, unrelated cleanup PR merge, raw asset migration, published game-history rewriting, old-history import, automatic background documentation updates and guarantees for historical pre-migration branches.

## Further Notes

Four approved delivery slices: curated local knowledge; pinned subtree integration; bootstrap/checkout validation; final game/graph/review verification. Publish only after the owner provisions the selected repository. Preserve unrelated local files. Current requirements are this issue; local design and checkpoint records link here.
