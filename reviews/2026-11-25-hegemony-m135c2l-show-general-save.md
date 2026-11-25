# M1.3.5c.2l — actual general reveal owner recovery

Date:2026-11-25. Source 4b9a78541c82f36a1348a962fb1567800a708db5; fixed base 9f376b752d95a5e4c4d7fba12747a153d601cdf5; reviewed tree e4168748a98afa34ee846038b8afb2dabf33b1bc; input knowledge de2a8655cc3df481acd54b3c08ed6167946db4ac; native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/show-general-save.md), [approved C2](../specs/hegemony-match-v3-save.md).

## Scope and validation

Actual show-general adds opt-in saveShow hooks and a pure mapped-child contract, preserving its eight-field cursor and existing interpreter. Preshow/change/skills/notify/filter package/presentation children and event observer remain fixtures. Real identity/display/faction/role/scenario mutations, scheduler events and composed Proceeding/RoundStart/question/both reveal owners are exercised. Hide-general/actual mapped children/profile/Room/publicv3/full-game acceptance is separate.

Initial RED: public decoder rejected missing operation codec coverage. Baseline204/3, focused260/4 including56 new tests; finalfull3224/117, typecheck/build passed; lint0 errors/42 pre-existing warnings. Source reviews Standards0/Spec0 at e4168748a98afa34ee846038b8afb2dabf33b1bc; independent reviewers ran56/1 and260/4 respectively. Test-iteration errors were confined to fixture policy replacement and calling trusted unwind without its expected-interruption argument; corrected to explicit mutable game policy and one unwind followed by trusted continuation. No scheduler behavior was changed or assertions weakened.

Preservation receipts:

- general.ts: runShow/runHide/input/displayed/hide factory and existing run/validate callback AST; SHA-256 a325737bc71447dabb5232deeb9786f72dc8c5457179dcd1549cac3c42ec9d40
- scheduler.ts: complete emitted scheduler; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph evidence

Fresh pre-index GitNexus14,442nodes/36,476edges/308clusters/488flows. Factory impact UNKNOWN0 remains unresolved; context resolves8existing registrations and CodeGraph pre-impact21nodes/31edges. GeneralRules LOW6 includes show/hide helpers/factories. Direct source search confirmed registrations before edits. Final force/no-parse-cache index 14,523 / 36,721 / 310 / 488 nodes/edges/clusters/flows; changes {"changed_count":80,"affected_count":0,"changed_files":2,"risk_level":"low"}. CodeGraph depth3 23nodes/35edges. detect_changes extracted zero affected processes/steps; that does not establish absence of execution paths. Changed symbol IDs are nonempty. Matching actual/GitNexus/CodeGraph hashes:

- src/game/hegemony/general.ts: a333221fbedcb40633c3f52a3b7fc687bccf4985eebd2ec7bfd8d9b61d787894
- tests/hegemony/show-general-save.test.ts: ce0937c4720dc279b0ff9caa4c00610fe23c535919f26908464c3aa097d734d6

Global extraction omits607 entry candidates/1207 callees, cuts17 walks and retains callable/cross-language and large-file limits. Missing edges are not proof of absent consumers. Complete runShow/runHide behavior is unchanged; helper/scheduler preservation and regression tests supplement unresolved factory reachability. The local graph receipt retains the zero-process result explicitly; direct registrations, unchanged lifecycle AST and real scheduler regressions supplement that unresolved extraction boundary.

## Delivery status

Knowledge link/blob/registry checks, exact-tree reviews, canonical publication/import/pin and actual source/integration CI are separate gates recorded below when executed. No production enablement or main merge; Group1 remains open.

## Reviewed delivery receipts

Source CI [45534713885](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/45534713885) succeeded for source head4b9a78541c82f36a1348a962fb1567800a708db5, executing synthetic PR merge d01c5946a307bc102b02feb34e151597d125b855 into base3cb751449afcd98748a4cebcc54fd5414e5fbce9. Exact source-tree checks are the separate local receipts. Actual logs confirm3224tests/117files, lint0errors/42oldwarnings and typecheck; preceding knowledge de2a8655cc3df481acd54b3c08ed6167946db4ac was verified offline/upstream. Local build passed separately; CI build execution is not claimed.

Canonical mechanical checks:163Markdownfiles,1033relativefilelinks,3headinganchors,630pinnedcitations/524linelocators,198localGitobjects,0errors. All171sources/27pages/179relations remain byte-equivalent as records; totals173/28/181. These checks validate local paths, Git blobs, line bounds and registry scope, not every semantic claim/external endpoint/full game. Draft tree bb6887e2d560e04f408573a9682d0a7edc4de633 passed separate Standards0/Spec0 reviews. This receipt-only delta is reviewed again before publication. Canonical publication/import/next-head CI remain later gates; imported-head CI is recorded in the PR to avoid recursively reimporting receipts.
