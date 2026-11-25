# Room judgment

Part 4ac implements the owner and three priority-zero GameRule stages from
[specification #22](https://github.com/chuongphong12/Sanguosha-vn/issues/22).
See [native source research](../research/2026-10-21-room-judge.md),
[draw pile](draw-pile.md) and [retrial](retrial.md).

The private judgment ledger now accepts pending null-card states. The existing
`readJudge` remains ready-only; `readPendingJudge` validates fields without inventing
a card/result. Result predicates require only cached result/negative fields. A
stable judgment ID identifies a mutable object across event children and JSON
restoration. Invalid who, card resource or cache rejects safely.

`judge` captures the original ID independently from the shared event packet ID.
Increment latest room tag `judge`, emit StartJudge, snapshot native getAllPlayers
order after it completes, then emit AskForRetrial for each captured actor until
consumed. There is no new alive check during that iteration. Emit FinishRetrial at
the original object's current who, decrement the latest tag, emit FinishJudge at
the original object's current who, then its optional final result log. That log uses the original cached result even if a FinishJudge listener cleared its card after disposal; it does not require ready-card state. Consumption
of start/finish events does not stop the owner. Packet replacement propagates to
later events while the original ID remains unchanged.

StartJudge runs actual `draw-card` before resolving the current packet ID, assigns
the canonical physical card, delivers initial log, moves the captured judgment's
then-current card into its then-current who judge zone through actual movement,
then invokes actual result recomputation. JUDGE uses actor who, empty skill and
eventName reason, forceVisible true. Draw reservation is consumed by that movement.

FinishRetrial captures its current packet ID, logs the effective ID from the event
player, then scans a copied pattern list. Match candidates with that event player
and current card; assign the first matching pattern without refreshing the result
cache. If animation was enabled, deliver result then long-delay via named children.
FinishJudge checks the current card's global physical place. Only a card still in
a judge zone is disposed; good Luoshen remains regardless of negative. JUDGEDONE
uses actor who, empty skill and eventName reason, forceVisible true.

All three rules observe the existing SkipGameRule behavior before the null-target
guard. Catalogue, ExpPattern grammar, eligibility/codec/reveal and notification or
delay transport remain explicit adapters. This layer uses the actual existing
getAllPlayers helper without modifying its damage/dying/death behavior.

Validation covers pending-to-ready, actual movement/result/disposal,
event and reason packets, Luoshen, cached patterns, captured actor order, rewritten
packet identity, SkipGameRule and repeated JSON suspension. Real Guicai/Guidao composition starts from pending judgment, executes acquisition,
payment, generic reveal, replacement and recomputation, and restores JSON prompts.
See the [revision checkpoint](../reviews/2026-10-21-hegemony-part4ac.md) for final
source identifiers, executed checks and independent reviews.
