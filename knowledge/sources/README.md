# Source registry

[registry.json](registry.json) records source versions, reviewed page scopes and evidence-backed relations. [AGENTS.md](../AGENTS.md) defines ingest/query/lint. [The journal](../log.md) records maintenance, while the [migration manifest](../research/migration-manifest.json) retains its separate historical document-disposition role.

## Coverage

Version 1 covers the global GameStart guard/order, maintenance-pattern references and the later bounded [local session/Slash/Jink contract](../engine/prototype-session.md). Other contracts keep their existing source citations. Registration does not mean every page or every claim has been revalidated, nor does it establish production or native runtime parity. The initial `coverage.knowledge_base_commit` remains the GameStart pilot input; later inputs and checks are recorded in [the journal](../log.md).

The [GameStart contract](../engine/game-start.md) is the example. Read its scoped page record together with the primary native/web sources and the older research/checkpoint. Those records have different roles; they are not five independent confirmations of every statement.

## Version 1 fields

The JSON contains:

- `version`: format version, currently 1.
- `coverage`: pilot scope and the prior knowledge commit inspected to initialize it. This is not the publication commit of the registry itself.
- `sources`: immutable source identities and access metadata.
- `pages`: metadata for the explicitly reviewed scope of a repository page.
- `relations`: typed connections with source evidence and scope.

Each source has a unique `id`, `kind`, `repository`, full `revision`, `path`, immutable `url`, `locator`, `checked_on`, `author` and `business_owner`. Dates use YYYY-MM-DD. Null ownership means unknown, not ownerless. A locator identifies the relevant lines, symbols or sections; it does not claim to cover every function in a file.

Source kinds:

| Kind | What it can establish |
| --- | --- |
| `primary_code` | Definitions/callers at the recorded revision |
| `test_code` | Assertions/scenarios present in source; execution requires a separate receipt |
| `analysis` | A derived investigation or recorded decision; follow its original evidence |
| `review` | Reported checks and findings for its named revision; not a new execution |
| `pattern` | Design guidance, not game rules, business authority or product validation |

GitHub sources use `blob/FULL_COMMIT/path`; gist sources use a full gist revision. Add a new source ID when its repository/revision/path identity changes. For a non-Git export, extend the record with an immutable artifact URL, originating URL, export version/date and SHA-256; review that extension before ingesting it. No mutable URL alone establishes an immutable source.

A page record has `path`, `status`, `reviewed_on`, `review_scope`, `applies_to` (the relevant game/native commits) and `source_ids`. A status applies only to that recorded scope:

| Status | Meaning |
| --- | --- |
| `supported` | The stated scope has cited support; not whole-page or runtime certification |
| `needs_review` | Support/applicability has not been re-established after a relevant change |
| `contradicted` | Conflicting evidence remains unresolved; preserve both sources |
| `superseded` | A supported replacement is identified for the stated scope |

Update applicability only after inspecting the new inputs; a global baseline edit does not advance every page's review. Keep older source identities and page history available.

## Relations and supersession

Each relation contains `subject`, `predicate`, `object`, nonempty `evidence` (source IDs) and `scope`. Endpoints use `page:repo-relative/path`, `source:ID`, or an immutable evidence/identity URL. Local page endpoints must exist; source endpoints and evidence must resolve to registered IDs.

| Predicate | Meaning and required support |
| --- | --- |
| `derived_from` | A page/synthesis uses this source; preserves the source's role and limits |
| `implements` | Pinned code realizes a specified contract within the stated scope; not automatic semantic parity |
| `decided_by` | The named decision governs this choice; not proof of an undocumented business rationale |
| `supersedes` | A supported replacement for an identified older claim/version within an explicit scope |
| `owned_by` | A documented responsibility assignment; not inferred from repository ownership or Git blame |

For supersession, record the old source ID or immutable old-page URL (including a section when needed), the replacement, scope, reason and source evidence. This also works when the page path stays the same: cite its old commit, not a self-link to the current path. Mark a registered older page scope superseded only when it has a resolvable replacement. Preserve the older text at its revision and link readers to the replacement where relevant. A different release is not automatically a contradiction; timestamps alone do not decide which claim wins.

The pilot has no established replacement or business-owner assignment, so it contains no invented `supersedes` or `owned_by` edges. Add those only from actual evidence. Owner identity URLs can be used for `owned_by`; they need not be immutable, but the assignment's evidence must be pinned.

## Extending coverage

Choose one source/topic, use the ingest workflow, and update its affected pages and journal together. Keep the JSON small and readable. This is a source/relationship catalog, not a claim database, code graph, search index or access-control implementation. CodeGraph/GitNexus remain the tools for matching-revision code dependencies; typed knowledge links connect contracts to decisions and business material.
