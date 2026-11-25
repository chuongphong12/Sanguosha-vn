# Rules and source authority

The normative source for this port is **QSanguosha-QuocChien 2.3.43-beta2**, pinned at [`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/tree/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f). Its repository is [TamQuocSat-LangKhach/QSanguosha-QuocChien](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien). The originally supplied 2.3.41.1 distribution is background material, not the chosen rule baseline. A moving upstream branch, Standard 2013 manual or same-named legacy skill does not override this pin.

The initial web implementation baseline for this knowledge snapshot is game commit `4b19fddcb6547066de0db0ae078c0db7642877ba` in `chuongphong12/Sanguosha-vn`. This commit was inspected locally; a public permalink is deliberately not assumed. [Source baseline metadata](../source-baseline.json) records the machine-readable attribution. Source paths in code spans refer to the named repository at its baseline, not to files inside this knowledge repository. Historical checkpoints certify their own revisions only.

## Evidence hierarchy

1. Pinned native C++ definitions and callers establish the selected native semantics, including unusual edge behavior. Consult both sides of a callback and its caller; a native method name is not a complete contract.
2. Web TypeScript definitions establish the implemented normalized contracts. These are serializable adaptations with explicit package callbacks, not Qt wire/pointer replicas.
3. Public dispatch/resume fixtures establish the particular tested compositions. A fake draw, reveal or response child establishes delegation and ordering only.
4. Production registration, filtered player state and actual network/UI paths establish what players can use. A native feature or passing fixture does not create an available web control.

Where native undefined behavior or QVariant coercion has no safe JSON equivalent, the port states a deterministic normalized rule or rejects malformed input. Do not silently report that as native differential parity. See [engine scope](../engine/overview.md).

## Native navigation

| Area | Native paths and symbols at the pin |
| --- | --- |
| Paired setup and faction | `src/core/general.cpp` `compareKingdomsWith`; `src/server/serverplayer.cpp` pair HP, `showGeneral`, `hideGeneral`; `src/core/player.cpp` seeming kingdom, friendships and lords |
| Trigger lifecycle | `src/server/roomthread.cpp` trigger processing; `src/server/room.cpp` action order and freeChain |
| Physical movement | `src/server/room.cpp` `moveCardsAtomic`, `_separateMoves`, `_mergeMoves`, `cheakMoveData`, `changeMoveData`; `src/core/structs.h` movement reasons/packets |
| Card use | `src/core/card.cpp` `onUse`, `use`; `src/server/gamerule.cpp` CardUsed, CardEffected and CardFinished; `src/server/room.cpp` cardEffect and cancellation |
| Responses | `src/server/room.cpp` askForNullification and askForSinglePeach; `src/package/standard-basics.cpp` Slash; `src/package/standard-tricks.cpp` Nullification |
| HP and terminal flow | `src/server/room.cpp` damage, enterDying, recover, killPlayer, gameOver, doCareeristRule; `src/server/gamerule.cpp` corresponding rules; `src/server/serverplayer.cpp` bury |
| Reveal rewards and tokens | `src/server/gamerule.cpp` GeneralShown; `src/server/room.cpp` freeChain; `src/package/standard-package.cpp` CompanionCard, HalfMaxHpCard, FirstShowCard, CareermanCard |

This is an implementation knowledge base, not a claim that all native packages, card legality or modes have been translated. Before extending a subsystem, inspect its current source, its callers and the pinned native source; then refresh the corresponding contract and validation evidence together.
