# SinglePeach and Room rescue composition

Part 4ab.4 follows approved option A in [specification #21](https://github.com/chuongphong12/Sanguosha-vn/issues/21). The owner is `src/game/hegemony/peach-response.ts`, composed with `room-use-card.ts` and the existing dying/rescue rules. See [native investigation](../research/2026-10-21-single-peach-room.md), [Room wrapper](room-use-and-admission.md), [dying/recovery](damage-and-rescue.md) and [revision checkpoint](../reviews/2026-10-21-hegemony-part4ab4.md).

## Acquisition is a distinct owner

`ask-single-peach` takes trusted saver/who IDs. Before every request, including response-validation-null retry, set response-use reason and compute signed `1-currentHP`. The request adapter owns human/AI parse, input, focus and transport. SinglePeach does not set current-card pattern, emit CardAsked, consume the generic provided slot or use continuing. It must not be replaced with generic ask-card-use or targetful command admission.

Input null or MethodUse limitation emits nil ChoiceMade with the current needed count, then returns null. A nonnull parsed reference passes private limitation and its response-validation child. Validation-null retries original saver/who without ChoiceMade or after-hook for that attempt. Accepted validation emits ChoiceMade with current needed count and card string. Consumption/rewriting cannot redirect captured identities. No extra saver/target alive/HP guard is inserted after acceptance; the enclosing rescue loop owns its native guards.

Existing `readSlashCard` already delegates to the shared rich execution decoder and accepts SkillCards. This slice preserves that decoder and the outer rescue consumer. Regression composition covers both raw SkillCard conversion and a validated SkillCard through the actual SkillCard onUse/shared GameRule/effect/recovery path. Earlier research's decoder-exclusion hypothesis was disproved by those tests and corrected before delivery.

## Fixed Room child and three identities

`SinglePeachRules.use` is removed. The owner sets UsedBySecondWay in accepted resource storage, resolves current metadata, then dispatches actual registered `room-use-card` with the accepted reference and explicit outer `addHistory=false`. The registry must supply that Room operation and its private policies. A descriptor-only use callback or guessed reference cannot replace this composition.

The new `resolve` policy supplies current descriptor/material metadata on copied game/card inputs and must retain registered reference identity. Shared `resolveResponse` validates its output and reads flags from current resource storage. It is used for parsed/accepted responses, post-ChoiceMade Room entry, original response after-hook arguments and final return. Material changes before payment and flags changed by CardFinished or either after-hook remain visible without replacing identity.

The local Room use has saver, captured dying target and current accepted descriptor, with defined constructor defaults: owner-use true, constructor addHistory true and empty nullified/disresponsive lists. Uninitialized native fields are omitted. Room initializes its own hand provenance and history marker; explicit outer false suppresses its outer increment even if the saver is in Play.

Response conversion, ordinary Room validation and response after-hook are distinct. Room may reparse or convert to another reference and execute its own onUse/ordinary validateAfter. SinglePeach then calls its original parsed reference's validateInResponseAfter through the existing policy named `validateAfter`; that property is not Room's ordinary after-hook. Final return preserves the accepted reference, with current metadata after this original-card hook. Parsed, accepted and Room-converted references need not be equal.

Room false from limitation/null validation does not become response refusal: SinglePeach still runs the original response after-hook and returns the nonnull accepted card. No payment/recovery is invented for the rejected Room use. Ordinary Room conversion recursively invokes Room with default history=true, so a converted child in Play may increment its own key even though outer history=false. The bridge preserves that native distinction.

## Enclosing rescue and persistence

AskForPeaches does not use the returned card again. It examines current HP and its prohibition/lock/alive guards, asking again after a nonnull ineffective response and ending the saver on null. Enter-dying retains original target and saver currentdying/CurrentDying save/restore semantics. Existing Wansha/CannotHelp and death/burial owners retain their separate responsibilities.

Tests use actual Room, normal/SkillCard onUse, shared GameRule/resources, movement and recovery, with the existing successful-rescue test retaining the actual registered death pipeline and demonstrating its bypass. Request/response conversion, Room ordinary validation, both after-hooks, shared events and table/discard movement can suspend and restore JSON. Prompt freshness/actor/registry rejection cannot repeat payment or recovery. Interruption retains eager table state and freezes frames; native unwind is not added.

## Authorities and production boundary

Catalogue/ownership/skill/pattern admission, human/AI parsing, current descriptor authority, Room parse/metadata/conversion/hooks, concrete Peach/Analeptic/ViewAs effects and notification delivery remain explicit adapters. The shared test helper supplies fixture policies around the real Room operation; it does not simulate the Room wrapper itself. No concrete package or new player command is enabled by these fixtures.

Outer judge/phase orchestration, native exception cleanup, full dealing/catalogue, production authentication/network/projection/UI/bots and complete-match/native differential certification remain separate. Production still registers Standard2013. These are private normalized engine capabilities, not proof of a playable Quốc Chiến match.
