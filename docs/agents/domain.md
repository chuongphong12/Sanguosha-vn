# Domain docs

This repo uses one domain context. Root [CONTEXT.md](../../CONTEXT.md) and
[docs/adr/](../adr/README.md) are navigation entry points to the canonical glossary
and decisions in the tracked knowledge snapshot. Read those targets before domain work.

Verify the snapshot with `npm run docs:verify`. Create or update domain terms and
meaningful decisions in the canonical knowledge repository, then import its reviewed
commit with the related source change; see [the update workflow](../../knowledge/README.md#updating-knowledge-with-the-game).

CONTEXT.md is a domain glossary only. Use its canonical terms in specs, tickets, tests and explanations. Keep implementation plans, progress, test counts and command output in their appropriate artifacts.

Create an ADR only for a real trade-off whose reversal is costly and whose rationale would otherwise surprise a future reader. Link existing source/specification evidence rather than repeat it.

Surface a conflict with an existing decision explicitly; do not silently replace the accepted model.
