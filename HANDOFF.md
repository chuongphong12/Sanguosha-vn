# Context Handoff — Tam Quốc Sát Engine

## What Was Done (This Session)

### Damage Provenance Refactor (completed)
- `DamageEffect` now carries `cardIDs: string[]`, `cardColor: CardColor` instead of single `cardID`
- `YiJiEffect` now has `remainingOpportunities`, `stage: "offer"|"card"|"recipient"`, `poolCardIDs`, `selectedCardID` (old batch pool replaced)
- `JianXiongEffect.cardIDs: string[]` (was `cardID: string`)
- `resolveDamage()` pushes Jian Xiong + Yao Wu triggers before Fan Kui/empty-hand check
- Yao Wu now uses `effect.cardColor === "red"` instead of per-card lookup

### Duel/Wu Shuang Fix (completed)
- `resolveDuel` no longer resets `slashesPlayed` — preserves progress across Ji Jiang summons
- `completeAllyResponse` now resets `slashesPlayed=0` and recalculates `slashesRequired` when initiative swaps
- Both swap paths (`answerDuelPrompt` + `completeAllyResponse`) reset correctly

### Yi Ji Per-Point Flow (completed)
- Each damage point is now a separate opportunity (confirm → reveal 2 → give 1 or skip → next)
- Tests updated in `skill-conformance.test.ts` and `skill-batch6.test.ts`

### Optional Skills Protocol (completed)
- `Ke Ji`, `Bi Yue`, `Luo Shen`, `Ji Zhi` now prompt before activating
- Tests updated: `skill-batch1.test.ts`, `skill-batch5.test.ts`, `skill-batch7.test.ts`

### Type Check & Tests
- `pnpm exec tsc --noEmit` passes clean
- `pnpm exec vitest run` — **163/163 tests pass**

## Current Status: 0 failures (169/169 tests, tsc clean)

## What's Next

### Equipment-Zone Skill Expansion (completed this session)
All 5 skills — `wu-sheng`, `qi-xi`, `guo-se`, `ji-jiu`, `liu-li` — now work with hand OR equipment cards, per official rules.

**What changed:**

1. Added `hasCardInEquipment()` / `hasCardInZone()` helpers (`cardEngine.ts`) and `zoneToProcessing()` / `zoneToDiscard()` wrappers around `removeZoneCard()`.
2. `matchesResponse()` now allows Wu Sheng (red→Slash) and Ji Jiu (red→Peach) conversions from either hand or equipment. Direct card matches, Long Dan, and Qing Guo stay hand-only by design (Qing Guo explicitly means *unequipped* cards in hand; basic cards like Dodge/Slash can never be equipped anyway).
3. `declareVirtualUse()` now checks `hasCardInZone()` for the source material and routes the spent card through `zoneToProcessing()` (works for both zones).
4. `discardResponseMaterials()`, `answerRescue()`, and `answerAllySummon()` (Hu Jia/Ji Jiang) now call `zoneToDiscard()` instead of `handToDiscard()`, so Ji Jiu/Wu Sheng conversions from equipment discard correctly in every response path.
5. Liu Li's `select-cards` prompt now offers `zones: ["hand", "equipment"]`, and `answerLiuLiPlayers()` validates/discards via `hasCardInZone()` / `zoneToDiscard()`.
6. **Bug fix**: Guo Se checked `card.suit === "heart"` in both `getVirtualConversions()` and `declareVirtualUse()`; official rule is `diamond`. Fixed in both places, and the pre-existing test in `skill-batch5.test.ts` was updated from a heart card to a diamond card.
7. `MainScreen.ts` gained `drawEquipmentConversions()`, called from `drawHand()`. It shows the viewer's equipped cards as selectable buttons whenever they're eligible — either as a virtual-play conversion (`getVirtualConversions()`, own "play" step) or as a live response (`canRespondWithCard()`, an active `card-response` prompt). Selecting one populates the same `selectedCardIDs` set the hand-card buttons use, so the rest of `drawActions()` / `drawCardResponsePrompt()` needed no further changes.
8. `getVirtualConversions()` and `canRespondWithCard()` needed no zone-check changes themselves — they were already zone-agnostic; callers just needed to start passing equipment card IDs, which the UI change above now does.

**Tests added:** `tests/rules/equipment-zone-skills.test.ts` (6 tests) — Wu Sheng (red equip as Slash), Qi Xi (black equip as Snatch), Guo Se (diamond equip as Indulgence), Ji Jiu (red equip as Peach outside turn), Liu Li (equip discard to redirect Slash), and a regression rejecting conversions for cards in neither zone.

**Full suite: 169/169 passing, `tsc --noEmit` clean.**

### Flaky Integration Test — Root-Caused and Fixed (completed)
`tests/integration/local-match.test.ts` failed intermittently (~1-in-8 runs) with `expected 'prepare' to be 'play'` right after the general-selection → playing transition.

**Investigation:** Initially suspected a boardgame.io `Local()` transport race (traced the full client/master pipeline — `LocalMaster.onSync`/`onUpdate`, the client `receiveTransportData` reducer, `p-queue`, the applied `patches/boardgame.io@0.50.2.patch`). Ruled all of that out: with `InMemory` storage (synchronous) and no `auth`, the entire move → master → broadcast pipeline runs to completion in one synchronous call, so no cross-field inconsistency is possible there. (Noted in passing: the client's `case 'sync'` handler has no `_stateID` staleness guard, unlike `case 'update'`, which is a latent footgun for reconnection scenarios — not triggered here since each `LocalMatch` client syncs exactly once, before any moves occur.)

**Actual root cause:** game logic working as intended, test incomplete. This integration test uses *real* RNG (not `identityShuffle`), so general assignment is genuinely random per run. `wang-zun` (Yuan Shu's Wang Zun) is **not** flagged `lordSkill: true` in `generals.ts`, so — correctly, per official rules — *any* seat that draws Yuan Shu gets the skill active, not just the lord. `resolveTurnFlow()`'s `prepare` branch checks all non-active players for `wang-zun` during the lord's very first turn and, if found, pushes an `optional-skill` effect that sets an `option` (`activate`/`decline`) prompt — correctly halting `G.turn.step` at `"prepare"` until that player answers. Confirmed with a throwaway 60-iteration diagnostic test (deleted after use): every failure had `prompt: {kind:"option", reason:"wang-zun", ...}` and `"yuan-shu"` in a non-lord seat's `generalIDs`.

**Fix:** `tests/integration/local-match.test.ts` now drains any pending prompt (declining, matching the existing pattern used later in the same test) right after the general-selection → playing transition and before asserting `turn.step === "play"`. Verified stable across 25 isolated runs + 5 full-suite runs (0 failures) after the fix, versus a reliable ~1-in-8 to 1-in-10 failure rate before it.

### Rule-Conformance Matrix (completed)
Documented all 43 skills against official wording status in `SKILL_CONFORMANCE.md`.

## Key Files

| File | Status | Notes |
|------|--------|-------|
| `src/game/cardEngine.ts` | Modified this session | All skill logic, damage, prompts |
| `src/game/model.ts` | Modified this session | New effect fields |
| `src/game/setup.ts` | Unchanged | `biYueResolved`, `wangZunResolved` init |
| `src/game/rules.ts` | Unchanged | `handLimit`, `distanceBetween` |
| `src/game/player-view.ts` | Unchanged | `createPlayerView` hides info |
| `src/app/screens/main/MainScreen.ts` | Modified this session | `drawEquipmentConversions()` added |
| `src/app/ui/equipmentView.ts` | Unchanged | `getEquipmentSlotViews` |
| `tests/skills/skill-conformance.test.ts` | 10/10 pass | Official rule tests |
| `tests/skills/skill-batch1.test.ts` | 11/11 pass | Ke Ji, Bi Yue, etc. |
| `tests/skills/skill-batch5.test.ts` | 7/7 pass | Luo Shen, Luo Yi |
| `tests/skills/skill-batch6.test.ts` | 5/5 pass | Yi Ji per-point |
| `tests/skills/skill-batch7.test.ts` | 5/5 pass | Ji Zhi, etc. |
| `tests/skills/skill-batch8.test.ts` | Pass | Ally summons, Guan Xing |
| `tests/skills/skill-batch9.test.ts` | Pass | Diệu Võ, Vọng Tôn, Đồng Tật |
| `tests/rules/equipment-effects.test.ts` | Unchanged | Existing equip tests |
| `tests/rules/equipment-zone-skills.test.ts` | New, 6/6 pass | Equipment-as-material conversions |
| `tests/helpers/game.ts` | Unchanged | Test utilities |

## QSanguosha References (authoritative)

- Luo Shen (Zhen Ji): optional; each check is independent; decline any to stop
- Guan Xing (Zhuge Liang): optional; count = min(5, alive); arrange both top and bottom
- Ji Zhi (Huang Yueying): optional; draw after each non-delayed trick
- Bi Yue (Diao Chan): optional; draw at start of end phase
- Ke Ji (Lu Meng): optional; skip discard if no Slash used this turn
- Yi Ji (Guo Jia): optional; per damage point; reveal 2; give 0-1 per point to any player
- Jian Xiong (Cao Cao): obtain ALL physical subcards of damage card
- Yao Wu (Xu Chu): red Slash only; choose recover OR draw; once per damage event
- Wang Zun (Yuan Shu): optional in Lord Prep; draw 1; lord hand limit -1 this turn
- Wu Sheng (Guan Yu): red cards as Slash
- Qi Xi (Lv Meng): black cards as Snatch
- Guo Se (Xiao Qiao): diamond cards as Indulgence
- Ji Jiu (Hua Tuo): red cards as Peach outside your turn
- Liu Li (Da Qiao): discard any hand/equip card to redirect Slash target
