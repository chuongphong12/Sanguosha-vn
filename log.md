# Knowledge maintenance journal

Append entries for authorized ingest/lint work: date, operation, source IDs, affected pages, checks actually performed and unresolved findings. Read-only queries are not logged here. Earlier checkpoint reports remain in [reviews](reviews/README.md); this journal does not invent retrospective ingest history.

## [2026-10-24] ingest | Maintenance schema and GameStart source pilot

- Input knowledge snapshot: `c471bbe0e020be55750691365e54a3cf911b715a`. User approved schema, source registry, journal, scoped supersession and evidence-backed relations after the Karpathy/v2 assessments.
- Sources: `pattern.karpathy`, `pattern.rohit.v2`, `native.gamerule.game-start`, `web.game-start`, `web.game-start.tests`, `knowledge.game-start.research`, `knowledge.game-start.review`, `knowledge.rules-authority`.
- Changes: [maintenance schema](AGENTS.md), [registry conventions](sources/README.md), [source registry](sources/registry.json), [GameStart evidence navigation](engine/game-start.md) and the [README catalog](README.md). Existing contract prose and game/native baselines remain at their recorded revisions.
- Scope: direct reading of native/web GameStart guard/order, source citation mapping, and registration of the historical research/review as such. Existing reported tests were not re-executed. No full-page, full-match, production or whole-corpus correctness certification follows.
- Open coverage: other contracts retain their existing citations; no full claim catalog, business-owner assignment or demonstrated supersession is fabricated. Historical Windows Temp receipts are not newly published. Runtime MCP, ACL, scheduling, search and budget enforcement are outside this documentation change.
- Validation: JSON parsing, unique IDs, source/page references, relation vocabulary/endpoints/evidence and pilot game/native applicability passed (8 sources, 1 scoped page, 7 relations). All 8 pinned raw sources returned HTTP 200; registered source line ranges were within the retrieved files.
- Navigation: 87 Markdown pages / 382 inline relative path links checked; 0 missing file targets and 0 pages without inbound inline Markdown links (excluding root README). This check does not validate every heading anchor or every external URL. Changed/new Markdown and JSON passed whitespace checks.
- Graph limitation: GitNexus has no index for this documentation repository. Direct reference inspection and the scoped diff establish that no function/class, game source, executable configuration, lock or subtree changed; no graph safety or runtime test result is claimed.

## [2026-10-26] ingest/lint | Reconcile M0 and maintenance knowledge

- Inputs: current M0 knowledge `0204d2a3feb1cdebf549aa9400862018a10a060a`, schema `142c391e371430454114e61faebeb040e637429c`, game delivery `da4b78aa57d64d02008683e47c26ddbb943be7ed` and unchanged runtime code `bc3ceb996054cf6fc42f0204f553bf279e13899b`; native pin remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.
- Merged the schema additively, preserving M0 ADRs/research/plans/data/reviews. Added [local session knowledge](engine/prototype-session.md), current navigation/frontier corrections and the explicit game-lock query route. Added immutable `web.m0.*.bc3ceb9`, `web.production.*.bc3ceb9`, `knowledge.m0.pending-jink.0204d2a` and `knowledge.m0.release.0204d2a` source records; retained older GameStart identities and historical scopes.
- Checks and findings: [2026-10-26 maintenance checkpoint](reviews/2026-10-26-knowledge-refresh.md). The full Markdown inventory and its pointers are examined; registered applicability remains limited to GameStart and the bounded session contract. Historical gameplay test results are attributed, not newly executed. No game function/class, package/lock dependency, native source or production registration is changed.
- Official hosting documents were accessed again for the [dated refresh](research/2026-10-26-m0-hosting-refresh.md), keeping the earlier investigation's date intact. These mutable provider citations are outside the scoped registry and require another check before provisioning.
- Open: M0.1/M0.3/M0.4, durable service-time clocks, automatic bot execution/ownership, other requests, external store/provider, full manifest/media/strength/load and release gates. No paid resource or production deployment is introduced.
