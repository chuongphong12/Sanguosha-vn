# Reveal rewards and reward-token methods

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Web owners: `src/game/hegemony/general-rule.ts`, `general-rewards.ts`, `reward-tokens.ts`, `fill-hand.ts`. Public suites: `tests/hegemony/general-rule.test.ts` and `reward-tokens.test.ts`. Native source at the [selected pin](../rules/source-authority.md): `gamerule.cpp` 115–160/268–286/995–1022, `room.cpp` freeChain (3174–3229), `standard-package.cpp` 418–740, `skill.cpp` 350–366, `player.cpp` 2111–2114, `serverplayer.cpp` fillHandCards (219–223).

## Immediate GeneralShown versus deferred GeneralShowed

Priority-zero GeneralShown uses the shared SkipGameRule-before-null-target entry guard. Unless current GlobalCareeristShow is true, invoke winner **before** reading slot/config/reward state. Any nonnull winner string, including empty, invokes terminal. A normally returning over adapter consumes; actual terminal interrupts. Null winner resumes with captured original recipient/slot and current configuration.

Queue head/deputy marks, then claim first-show only when enabled, no scenario and TheFirstToShowRewarded is absent/null. Existing false/zero/string/object is nonnull and already claimed. Claim room tag before adding pending mark; later overflow preserves the claim/earlier slot mark. Null/missing slot means deputy; malformed nonnull slot rejects only when consumed. No late alive skip is added.

DFDebut is subscribed and passes the shared entry guard but its branch is empty: no winner/reward reads follow. GeneralHidden is not subscribed by pinned GameRule. **GeneralShown** is the immediate boolean-slot event; **GeneralShowed** is the later coalesced string-list event. Do not merge their names or handlers.

## free-chain drain and mark grants

Each pass checks current living surrender and delegates kill first. Scan raw registration including dead; clear positive head/deputy queue counts eagerly and coalesce to one head/deputy list. Dead queued seats lose queue without event or reward. First living queued recipient gets GeneralShowed. Consumption/rewrites do not change captured recipient/list; after normal return award using current state, then restart at registration beginning with fresh surrender check. Requeues and nested drains obey that order.

The all-shown grant rechecks alive. Shown head plus absent-or-shown deputy and exactly-zero Global_hasShownAllGenerals sets that mark **before** reading pair metadata. Present nonsujiang pair checks head→deputy companionship, then independently deputy→nonempty Bianhua choice; both may grant companion. Adjusted intrinsic head/deputy HP sum, not current player maxHp, grants halfmaxhp only for positive remainder modulo two. Metadata callbacks get copies and validated boolean/integer results. A late malformed Bianhua table retains prior grants.

Captured head/deputy entries consume one positive HaventShowGeneral/HaventShowGeneral2. Current displayed head kingdom controls careerist token. Pending first-show consumes one and grants firstshow. These tail conversions continue after a GeneralShowed child killed recipient; pair grants skip dead. Coalesced counts do not multiply rewards, and remaining pending marks need another reveal queue to drain. Token creation is not automatic draw/recover or an enabled UI button.

## Four separate package boundaries

`reward-tokens.ts` exposes the following operations through the private scheduler. None alone authorizes a player command.

| Operation | Contract |
| --- | --- |
| `reward-token-enabled` | Package predicate only. Play requires positive mark; firstshow additionally needs hand<4 or a living sibling not fully shown. Response/response-use allows companion/careerman only, case-sensitive `peach` substring, no Global_PreventPeach and positive mark. Unknown reason returns false. Generic skill possession, phase/request and card limitations stay external. |
| `firstshow-targets` | Native filter and feasibility are independent. Filter requires no selected target, another player and not-all-shown. Feasibility requires exactly one target if any living sibling is not fully shown, otherwise zero. Generic alive/prohibition remains external. Fully shown means head shown and absent-or-shown deputy, not scenario identity. |
| `reward-token-cost` | extraCost only: remove one corresponding mark, clamped at zero; careerman spends `@careerist`. Missing/zero does not create a mark. Signed subtraction must be representable. No use event/effect follows automatically. |
| `reward-token-use` | Overridden SkillCard::use body only. Does not recheck permission or spending. Callers must implement the distinct native PreCardUsed → extraCost → showSkill → CardUsed boundaries and surrounding SkillCard handling before production exposure. |

## Effects and requester-only inspection

halfmaxhp delegates draw-one, reason halfmaxhp. companion/careerman construct virtual NoSuit/0 Peach with no materials and skill `_companion`/`_careerman`. Read the last normalized CurrentDying ID against native living-list authority. If found, Global_Dying, unlocked and not prohibited, use Peach immediately without play-availability check. Otherwise companion asks peach/draw only when Peach available, defaulting directly to draw-two when unavailable. Accepted self-Peach choice is not rechecked after its child.

careerman offers draw1card/draw2cards, optional Peach and optional firstshow in native order, retaining full display choices separately. firstshow is available for short hand or any not-all-shown living player, **including self**. After choosing it, recollect current all-living hidden targets including self, capture roster for choose-player validation, indicate chosen player and execute FirstShowCard body without spending firstshow mark. Empty roster executes fill-only body. This differs deliberately from ordinary FirstShowCard's other-player filter.

FirstShowCard fills user's hand to four before reading current target visibility. Only first captured target matters. Stop when no hidden slots remain; offer head then present deputy. Set XianquTarget during slot-choice child and clear on normal return. Send a **name-free** public notice to other current-first registered seats, including deceased; then read current actual room-tag names for requester-only delivery. Slot selection stays captured across callbacks. Inspection does not reveal the general publicly or change identity. Return null, never actual name.

Requester-only notification payloads and actual-name authority must stay private. Raw scheduler/child payloads cannot be sent as public state. An interruption retains paid marks, completed fill and temporary flags; no exception restoration is fabricated.

## Adapter and validation limits

Predicates use isolated snapshots and must return booleans; descriptors remain pure and outside JSON. Draw, Peach use, normalized choice/choose-player, indication and separate public/private notification delivery are registered adapters. Selected choices/players must belong to captured offers. Timeout/randomness/AI parsing, percent-prefix normalization and ChoiceMade remain input-adapter duties. CurrentDying accepts normalized IDs, not native general aliases or `+` lookup expressions.

The fixed-pile draw fixture uses actual movement but does not implement draw replacement/recycling/deck policy. The token Peach fixture composes actual recovery with card=null, not the complete Peach/card-material pipeline. freeChain companionship/HP catalog callbacks remain fixtures. Tests establish these exact normalized bodies and continuation/privacy behavior; complete SkillCard integration, legality, concrete packages/UI/network, general transformations, exception unwind, native differential and production E2E remain gates.
