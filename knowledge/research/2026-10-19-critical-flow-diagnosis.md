# Diagnosis of the 28 Part 4aa affected flows

Historical investigation on 2026-10-19 at game revision `18957a5b592dabf4e27e6d2e886134b69bd1148d`, with source/test implementation at `0ac2aabf98645d48208d8609696d0be4e2c9ff62`. The findings and 28-path ledger below describe that pre-fix snapshot. The subsequently approved repair is committed locally at `2267afb2d01d4ae9252bed7694c0dbf1534a8625`; see the [repair checkpoint](../reviews/2026-10-19-offer-equality-fix.md) for executed regression evidence and the updated 29-path cumulative graph. No production release is asserted.

## Findings

1. **The report has one aggregate CRITICAL change-impact classification.** It does not diagnose 28 individual critical defects. The installed GitNexus 1.6.12 classifier uses the number of affected indexed processes: zero low, 1–5 medium, 6–15 high, at least 16 critical; degraded query results are unknown. See the [independent primary-source investigation and nine boundary checks](2026-10-19-gitnexus-risk-classification.md). The separate `impact` tool uses a different calculation.
2. **The classification persists with a current index.** A forced local index refresh at the exact game HEAD still reports the same 28 process IDs/names. All four source files occurring in their 112 indexed steps match current indexed SHA256 values. The old commit label therefore does not explain this aggregate warning. Refresh updates generated local index data, not game source.
3. **Four selected static paths are infeasible through this particular public gateway.** They traverse the generic scheduler's order-prompt branch, but this gateway requires a step prompt. Keep those generic scheduler paths for their other callers and possible child-trigger processing; do not delete them or mark their helpers globally unused.
4. **One independent P2 engine defect is reproducible:** `currentOffer` treats JSON object key insertion order as part of offer equality. A semantically unchanged supported offer can be rejected after a harmless state change causes a pure private provider to construct its keys in a different order. A canonical-key provider prototype accepts the same public reply. This defect is distinct from the count-based CRITICAL classification; repairing it need not change that classification.

## Feedback loops and controls

The initial unattended loop was:

```powershell
node C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-repro.mjs
```

It reproduced the original report in about seven seconds, deliberately returning exit 1 on `summary.risk_level === "critical"`. Its initial captured result was 474 indexed symbols / 21 files / 28 affected processes, with no response partial/truncated flags. This is a red-capable alarm reproducer, not proof that the game's runtime is broken.

The hypotheses, stated before probing, were: scope/count-based classification; semantic sensitivity to authentication/scheduler paths; stale or incorrect graph relationships; independently observable runtime defects. The classifier experiment confirms affected-process count, not symbol count or authentication keywords, as the input to this particular result. The current-index control rules out an old commit label as its cause. The behavioral experiment below confirms one separate runtime defect.

After refreshing ignored local index data with `node .gitnexus/run.cjs analyze --index-only --force`, the index commit equals HEAD. Results from the same current source and index:

| Comparison | Changed indexed symbols | Changed files | Affected processes | Raw classification |
| --- | ---: | ---: | ---: | --- |
| Part 4aa base `21d693e` → HEAD | 510 | 21 | 28 | CRITICAL |
| Source commit `0ac2aab` → HEAD, documentation/lock only | 55 | 16 | 0 | LOW |
| Current working diff | 0 | 0 | 0 | NONE, no changes detected |

The increase from 474 to 510 reflects newly indexed documentation nodes; the affected process IDs, paths and classification did not change. None of the three responses reported partial/truncated output. These controls distinguish comparison scope from runtime correctness; changing the base to obtain LOW does not repair an engine defect.

Fresh graph: 288 files / 8,743 nodes / 22,564 edges / 220 clusters / 530 processes. Extraction still omits 347 entry candidates and 1,210 callees, cuts 19 walks and leaves 13 cross-language property sites unlinked. Response completeness is not whole-graph completeness. The four byte-verified path files are `src/game/hegemony/card-command.ts`, `scheduler.ts`, `card-resources.ts`, and `card-on-use.ts`.

Receipts are under the local Temp directory: `tqs4aa-critical-repro.json`, `tqs4aa-critical-process-map.json`, `tqs4aa-critical-current-index.json`, and `tqs4aa-risk-calculator.json`. The complete process membership is retained, not inferred from shortened labels.

## Coverage/disposition groups

| Group | Paths | Assessed contract and evidence | Disposition |
| --- | ---: | --- | --- |
| Offer/material/skill/pattern checks | 8 | Current offered intent, version, eligibility, one physical material location, private package permissions; existing negative cases and new metadata-order reproducer | P2 in shared `currentOffer` equality; other supplied policies remain authorities |
| Ordered targets | 6 | Prefix filter/prohibition, target-fixed empty manual targets, final feasibility, current recheck and post-ChoiceMade recheck | Existing focused scenarios pass; no additional defect demonstrated here |
| Actor/phase/request context | 4 | Bound actor, living active Play actor, epoch validation, response-use outside responder Play | Existing focused scenarios pass; production authentication/phase orchestration remain excluded |
| Resource/descriptor normalization | 6 | Trusted reference lookup, shape/material/flag validation; forged public descriptors rejected | Existing focused scenarios pass; not certification of every package or malformed private adapter |
| Direct generic scheduler order branch | 4 | Public gateway requires step; generic order-only branch requires order | Infeasible selected paths for this gateway; preserve generic scheduler behavior |

The following ledger lists all 28 selected paths. Function names alone can be ambiguous; the saved membership receipt also records full symbol IDs, file paths and start lines. In this snapshot all entries start in the new `card-command.ts`; scheduler-only terminal paths are explicitly classified by their caller guard.

| # | Process ID | Exact selected symbol chain | Disposition group |
| ---: | --- | --- | --- |
| 1 | `proc_25_run` | `run` → `currentOffer` → `offers` → `eligible` → `check` | Offer/material binding |
| 2 | `proc_26_run` | `run` → `currentOffer` → `offers` → `eligible` → `materialAllowed` | Offer/material binding |
| 3 | `proc_27_submit` | `submit` → `resumeTriggerPrompt` → `reconcileCandidates` → `collectCandidates` → `occurrenceKey` | Order branch: infeasible for step gateway |
| 4 | `proc_28_submit` | `submit` → `resumeTriggerPrompt` → `reconcileCandidates` → `collectCandidates` → `orderGroupKey` | Order branch: infeasible for step gateway |
| 5 | `proc_55_run` | `run` → `currentOffer` → `offers` → `offers` | Offer/material binding |
| 6 | `proc_56_submit` | `submit` → `resumeTriggerPrompt` → `actorChoices` → `isForced` | Order branch: infeasible for step gateway |
| 7 | `proc_94_prompt` | `prompt` → `targetsValid` → `feasible` | Ordered targets |
| 8 | `proc_95_prompt` | `prompt` → `targetsValid` → `prohibited` | Ordered targets |
| 9 | `proc_96_prompt` | `prompt` → `targetsValid` → `targetFilter` | Ordered targets |
| 10 | `proc_97_run` | `run` → `contextValid` → `contextValid` | Actor/phase/context |
| 11 | `proc_98_run` | `run` → `contextValid` → `inPlay` | Actor/phase/context |
| 12 | `proc_99_submit` | `submit` → `resumeTriggerPrompt` → `advanceActor` | Order branch: infeasible for step gateway |
| 13 | `proc_184_prompt` | `prompt` → `offers` → `eligible` → `check` | Offer/material binding |
| 14 | `proc_185_submit` | `submit` → `currentOffer` → `offers` → `eligible` → `materialAllowed` | Offer/material binding |
| 15 | `proc_205_submit` | `submit` → `currentOffer` → `offers` → `offers` | Offer/material binding |
| 16 | `proc_219_run` | `run` → `targetsValid` → `feasible` | Ordered targets |
| 17 | `proc_220_run` | `run` → `targetsValid` → `prohibited` | Ordered targets |
| 18 | `proc_221_run` | `run` → `targetsValid` → `targetFilter` | Ordered targets |
| 19 | `proc_222_submit` | `submit` → `contextValid` → `contextValid` | Actor/phase/context |
| 20 | `proc_223_submit` | `submit` → `contextValid` → `inPlay` | Actor/phase/context |
| 21 | `proc_257_prompt` | `prompt` → `offers` → `eligible` → `materialAllowed` | Offer/material binding |
| 22 | `proc_274_prompt` | `prompt` → `offers` → `offers` | Offer/material binding |
| 23 | `proc_285_run` | `run` → `currentOffer` → `offers` → `eligible` → `readCardReference` → `isRecord` | Descriptor/resource guards |
| 24 | `proc_320_submit` | `submit` → `currentOffer` → `offers` → `eligible` → `readCardReference` → `isRecord` | Descriptor/resource guards |
| 25 | `proc_354_run` | `run` → `currentOffer` → `offers` → `eligible` → `readExecutionCardUse` | Descriptor/resource guards |
| 26 | `proc_379_submit` | `submit` → `currentOffer` → `offers` → `eligible` → `readExecutionCardUse` | Descriptor/resource guards |
| 27 | `proc_463_prompt` | `prompt` → `offers` → `eligible` → `readCardReference` → `isRecord` | Descriptor/resource guards |
| 28 | `proc_467_prompt` | `prompt` → `offers` → `eligible` → `readExecutionCardUse` | Descriptor/resource guards |

## Four order-branch paths: caller guard proof

`card-command.ts:116–120` makes `privatePrompt` return null unless `prompt.kind === "step"`. `submit` returns false without a state. On a successful call into `resumeTriggerPrompt`, the same synchronous scheduler therefore still has a step prompt.

Inside `scheduler.ts:790–809`, direct calls to `reconcileCandidates`, `actorChoices` and `advanceActor` require the order-prompt branch. `occurrenceKey` and `orderGroupKey` occur downstream of `reconcileCandidates → collectCandidates`; `isForced` occurs downstream of `actorChoices`. Those four selected direct chains cannot follow this gateway's accepted step entry. This is a path-specific proof, not a claim that these helpers never execute elsewhere or that a later nested event cannot run the generic order mechanism.

A throwaway public-seam probe used the unchanged admission factory and scheduler, enabled Node precise V8 coverage only around an isolated card-selection submission, and then attempted a forged order prompt:

```powershell
node node_modules/tsx/dist/cli.mjs C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-diagnostics/probes.ts
```

Observed: real `resumeTriggerPrompt` was recorded, while the seven inspected order helpers had zero recorded calls in that isolated step. A forged order prompt was rejected without changing scheduler state. Coverage of one isolated step corroborates the guard proof; it does not establish global unreachability. No source instrumentation was added.

## P2: unchanged offer rejected because object key order changed

Owning code: `src/game/hegemony/card-command.ts:197–207`, `createCardCommandAdmission.currentOffer`:

```ts
return offers(game, cursor.request).some(
  (current) => JSON.stringify(current) === JSON.stringify(offer),
);
```

The probe issues an actual `card-use-request`, retrieves its actor-only view, and submits the actual offered opaque token through `admission.submit`. Its private provider is a pure function of the provided game snapshot. A harmless player flag changes only the insertion order of the provider's object keys. Offer ID/version, descriptor, material IDs, targets, resource reference, actor, request epoch, permissions and field values remain identical. Node `assert.deepStrictEqual` verifies equality; the serialized strings differ.

Observed results:

| Experiment | Public submit | State on rejection |
| --- | --- | --- |
| Unchanged engine, provider varies key insertion order | false, reproduces false rejection | Game/scheduler unchanged |
| Unchanged engine, throwaway provider canonicalizes object keys | true | Advances to confirm prompt |

This does not demonstrate a bypass or double payment. It is a valid-input rejection that can impede selecting/confirming an otherwise valid offer. Back/cancel recovery remains available according to its existing contract. The probe does not execute a card and does not certify an enabled native package.

[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-4) defines JSON objects without member ordering, while arrays retain element ordering. The engine's authoritative JSON-data contract supplies no requirement that private providers preserve object insertion order. Serialization order is therefore an unsuitable condition for semantic offer identity. The prototype changes only the provider's representation, corroborating the equality hypothesis without modifying the game.

The diagnostic command deliberately exits 1 while the baseline rejection remains; its output also contains the successful prototype control. It is stored in an explicitly temporary diagnostic directory and is not a permanent regression test or production adapter. Source and installed-tool code are unchanged; no debug logs or instrumentation were inserted into them.

## Repair options and recommended next slice

**A — Canonicalize in every offer provider.** The prototype shows this can avoid the rejection. It spreads a representation requirement across future package adapters and can be omitted by one provider. It is a workaround, not the preferred final seam.

**B — Compare JSON values semantically inside the existing private `currentOffer` boundary, recommended.** Compare object key sets and corresponding values without insertion-order dependence; compare arrays in their existing order and scalar types/values exactly. Alternatively canonicalize both operands using deterministic code-unit key ordering, preserving arrays. Keep every value in the binding: ID, version, resource reference, materials, descriptor, flags, metadata and label. Do not replace this with an ID/version-only comparison.

Proposed implementation acceptance:

1. Promote the actual public-submission reproducer into a permanent failing test at the existing agreed seam. Add equivalent JSON-reload and post-ChoiceMade cases where only object member order changes.
2. Run impact for `createCardCommandAdmission/currentOffer` before a surgical comparison change. Avoid editing the high-fan-out shared descriptor reader or generic scheduler.
3. Add negative controls: changed ID/version/resource/material/card values still reject; array reordering remains distinguishable; permission/phase/epoch/prohibition changes still reject without charging history/cost. Add back/cancel and JSON-resume regression checks.
4. Implement the smallest local comparison fix, rerun the original reproducer and focused suites, then normal check/build, both graph checks and the two review axes. These future cases are proposed, not reported as already passing.
5. Update canonical knowledge and its source pin with the eventual source commit. Keep raw CRITICAL reporting and the 28-path disposition separate from confirmed defect severity. Even excluding the four caller-infeasible traces leaves 24, still above the installed classifier's threshold.

**Tool reporting improvement, separate scope:** show the raw change-impact score alongside confirmed bugs and evidence/dispositions. If improving GitNexus itself, use a minimized guarded-call fixture to propose call-path feasibility refinement upstream. Do not lower thresholds, remove legitimate generic scheduler helpers, disable command checks or split comparisons merely to obtain a smaller score. No installed tool patch/upgrade is warranted by the intended threshold calculation alone.

## Validation and delivery boundary

Fresh execution of the three existing Part 4aa suites passed: 49 cases across card-command, card-command-token and room-use-card. The new diagnostic rejection is a missing edge case in those suites. Nine exact installed-expression classifier boundary checks passed. The V8 guard probe and canonical-provider control passed their assertions; the unchanged-engine metadata-order repro remained red intentionally.

The previous full 1,753-test/build checkpoint was historical validation at the identical game source, not a new full run in this research task. The diagnosis itself changed only generated local graph data and the research drafts. It did not change game source, permanent tests, installed packages or deployment. Source implementation and its permanent regressions were completed in the subsequent [repair checkpoint](../reviews/2026-10-19-offer-equality-fix.md). The count-based warning remains; no 100% correctness or production readiness is asserted.
