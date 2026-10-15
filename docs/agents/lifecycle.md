# Engineering lifecycle

Use ask-matt as the route map. Use the applicable skills across the lifecycle; unrelated teaching, fiction and prototype workflows are not mandatory steps for an engine ticket.

## Idea to delivery

1. For unresolved design, grill-with-docs combines grilling and domain-modeling. Delegate environmental facts; ask the user for decisions. Preserve previously approved decisions and test seams. Use research for missing primary-source facts and prototype only when execution or a visual is needed to settle a decision.
2. For a large effort with unresolved decisions, wayfinder produces a decision map. Once its route is clear, synthesize through to-spec and to-tickets before implementation. For already-bounded work, implement can use the accepted ticket directly.
3. to-spec records the user-visible problem, scope, contracts, accepted seams, tests and explicit exclusions. to-tickets creates independently verifiable slices, each with acceptance criteria and blockers. Keep a slice small enough for one implementation context. Obtain decisions only for newly unresolved design or ticket scope; existing approval remains effective.
4. For each unblocked ticket, implement drives tdd: assert that the public operation actually dispatches; collect a real behavior failure; implement one vertical slice; run focused tests/typecheck while iterating. Query GitNexus/CodeGraph impact before edits and report HIGH/CRITICAL risk. Treat UNKNOWN, partial and truncated results as unresolved and investigate.
5. Before declaring the ticket complete, run its existing approved full validation/build and graph gates. Confirm current bytes/definition identities and inspect the affected flows. Revalidate affected behavior after fixes. Tests using fixture adapters establish only their stated scope.
6. code-review runs separate Standards and Spec reviewers against a fixed base and exact reviewed source. Record findings and verify corrections. Commit completed approved work. When a PR is requested or its skill-authorized publishing stage is reached, use pr to describe behavior, before/after evidence and merge risk.
7. At an appropriate phase boundary, use retro to propose environment improvements supported by evidence. Use handoff for a different directory/harness or agent; link the existing spec, ticket, decisions and commit rather than duplicate them.

## Conditional routes

- triage: incoming reports/requests, not tickets already produced by to-tickets.
- diagnosing-bugs: a hard failure; establish a tight reproducer before theorizing.
- improve-codebase-architecture and codebase-design: investigate a specific module/seam problem; keep unrelated refactors outside the ticket.
- implement-spec: optional orchestration of an approved spec/task graph, with independent worker worktrees and an integration PR. Serialize changes sharing mutable engine state or the same files. Retain ordered validation between dependent parts.
- wizard: steps only the human can perform, not agent-executable tasks.
- resolving-merge-conflicts: an actual in-progress conflict.

## Records and completion evidence

- GitHub specification/ticket: canonical current requirements, acceptance criteria and dependencies.
- Domain glossary/ADRs: accepted language and durable decisions.
- Knowledge: durable source-derived contracts, authority assumptions and limitations.
- One checkpoint record under the existing docs/reviews/ convention, named YYYY-MM-DD-<ticket>.md: source/reference identifiers, exact reviewed revision, adapter/dependency table, executed checks and exits, graph integrity/limits, separate Standards/Spec findings, evidence links and remaining scope. Other records link to this evidence; preserve existing historical records.
- Ledger: compact status/next-dependency index linking the ticket and checkpoint. Keep historical evidence intact.

Each slice identifies which authority/adapters are real, which are fixtures and which consumers remain unresolved. A passing test total is evidence for the named acceptance criteria, not proof of complete native parity or production readiness.

Existing Hegemony policy remains: pinned ce4e62b semantics, private projection, staged validation and reviews, and Standard retirement only at the accepted playable-replacement/cutover gate. Reuse accepted command/resume and projection seams.

Measure future phases before promising time savings. Standardized checkpoint automation and CI expansion are candidate tickets, not changes implied by installing this configuration.
