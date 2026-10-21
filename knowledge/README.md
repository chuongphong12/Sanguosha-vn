# Sanguosha VN — Quốc Chiến knowledge

Current source-derived knowledge for developers and AI agents porting Quốc Chiến to the [TypeScript web game](https://github.com/chuongphong12/Sanguosha-vn). The selected native authority is **QSanguosha-QuocChien 2.3.43-beta2**, commit `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

The [source baseline](source-baseline.json) identifies the game revision inspected for this snapshot. Production still registers the legacy Standard 2013 game; paired setup `ready` and normalized operation fixtures do not establish a playable Quốc Chiến match. This repository records the migration target and actual implementation boundaries.

## Find the relevant contract

| Need                                     | Start here                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain terms and durable decisions       | [Glossary](CONTEXT.md), [subtree decision](adr/0001-canonical-knowledge-with-subtree.md), [rules authority decision](adr/0002-hegemony-knowledge-authority.md)  |
| Which source defines the rules           | [Source authority](rules/source-authority.md)                                                                                                                   |
| What the web engine implements           | [Engine overview](engine/overview.md), [architecture and production boundary](engine/architecture.md)                                                           |
| Setup, hidden information and faction    | [Setup and privacy](engine/setup-and-privacy.md), [general lifecycle and relations](engine/generals-and-relations.md)                                           |
| Trigger order and persistence            | [Scheduler](engine/scheduler.md)                                                                                                                                |
| Movement and card resolution             | [Movement](engine/movement.md), [card use/effects](engine/card-use-and-effects.md), [Nullification/Slash](engine/nullification-and-slash.md)                    |
| SkillCard envelope and shared execution  | [SkillCard onUse](engine/skill-card-on-use.md), [shared execution](engine/skill-card-execution.md), [native boundaries](research/skillcard-shared-execution.md) |
| Room wrapper and authoritative requests  | [Room use and admission](engine/room-use-and-admission.md)                                                                                                      |
| Direct MethodUse/MethodResponse requests | [CardAsked, provide, retry and distinct use/response lifecycles](engine/direct-card-use.md)                                                                     |
| Selection and judgment replacement       | [MethodNone/Discard, retrial and Guicai/Guidao](engine/retrial.md)                                                                                              |
| HP, rescue and terminal flow             | [Damage/rescue](engine/damage-and-rescue.md), [SinglePeach/Room](engine/single-peach.md), [death/careerist](engine/death-and-careerist.md)                      |
| Reveal rewards                           | [Rewards and token methods](engine/reveal-rewards-and-tokens.md)                                                                                                |
| What remains before production           | [Roadmap](roadmap/README.md), [port plan](plans/hegemony-port.md), [initial design baseline](specs/hegemony-engine-baseline.md)                                 |
| Assets and reuse evidence                | [Provenance](assets/provenance.md)                                                                                                                              |
| Why old documents changed                | [Curation assessment](research/architecture-and-provenance-assessment.md), [complete migration manifest](research/migration-manifest.json)                      |
| Historical verification                  | [Evidence index](reviews/README.md)                                                                                                                             |

Code paths in code spans refer to the named game/native repository at the stated baseline. They are not relative links to files in this repository. Historical reports retain their original scope and source identities; their test totals do not certify a later revision.

## Updating knowledge with the game

This repository is canonical. The game contains an ordinary tracked subtree at `knowledge/` plus a separate `knowledge.lock.json` recording repository URL, full documentation commit and Git tree. A plain clone, ordinary branch switch or worktree checkout includes the matching snapshot on migrated branches. Older branches retain their historical tree. No post-checkout hook, submodule initialization or implicit remote update is involved.

1. Update the relevant contract from the pinned native source and inspected game code. Keep current facts, pending adapters and historical evidence distinct; use the existing game GitHub Issues for requirements/tickets.
2. Validate internal links and source references. Update `source-baseline.json` when the inspected input changes; it is evidence attribution, not an automatic certification of later code.
3. Review and publish the knowledge commit first. In a clean game checkout, run `npm run docs:sync -- FULL_DOCUMENTATION_COMMIT_SHA`. To prepare against a local knowledge checkout, append `--from /absolute/path/to/knowledge-repository`.
4. The sync command fetches only the specified full SHA and creates a squashed subtree commit. Review and commit the changed `knowledge.lock.json` before publishing the related game PR. Keep related source changes and the imported snapshot together in that review.
5. Run `npm run docs:verify` for an offline Git-tree/local-change check and `npm run docs:verify:upstream` to verify that the canonical commit actually exports the recorded tree. A local upstream check can use `npm run docs:verify -- --from /absolute/path/to/knowledge-repository`.

Offline verification checks the lock against the committed snapshot and rejects local subtree edits/untracked additions. It cannot independently prove that a claimed upstream SHA belongs to the canonical repository; the upstream check supplies that evidence. Content equality also does not establish semantic compatibility with later game code. CI performs both checks before publication.

Sync stops on dirty tracked files, local subtree additions, malformed locks, missing commits or mismatched trees. It preserves local work and leaves conflicts for deliberate resolution; it never force-resets files. Ordinary game build/test consumes tracked files and does not fetch this repository. To contribute, edit this repository and reimport a reviewed commit rather than editing the game subtree in isolation.

The selected public repository must be provisioned by its owner before publication. Local preparation and fixture validation are possible before that step; they do not establish remote availability or successful remote CI.
