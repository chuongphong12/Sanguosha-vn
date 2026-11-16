# Opt-in fill-hand recovery

M1.3.5c.2d at game [f9046375c483881079b853935d988fd0bd056b5e](https://github.com/chuongphong12/Sanguosha-vn/blob/f9046375c483881079b853935d988fd0bd056b5e/src/game/hegemony/fill-hand.ts), fixed base 51c584cc12eb9afff72ddf4b4f90a21022755219, follows the [accepted C2](../specs/hegemony-match-v3-save.md). Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. See [live drawing](card-drawing.md), [actual draw recovery](player-draw-save.md), [movement recovery](movement-save.md) and the [checkpoint](../reviews/2026-11-16-hegemony-m135c2d-fill-hand-save.md).

## Saved shortfall and adapter contract

Legacy fill-hand stored only true while waiting for its draw child. That cannot retain the original deficit after nested effects change hands or life state. The factory accepts optional FillHandRules.validateDrawSave(input, operation). Its presence opts into a captured JSON snapshot {target,count,reason,shortfall}, publishes save/result hooks and captures the validator at factory construction. Without it, the legacy boolean cursor and absence of save hooks remain unchanged; the shared decoder refuses incomplete coverage. New profiles must version this opt-in and the adapter semantics. An old true cursor is not silently migrated into a snapshot profile.

A snapshot binds target/desired count/reason to the original request and requires a positive signed-int32 shortfall no greater than that count. The explicit trusted pure validator binds the queued/completed child to the captured shortfall and the adapter's actual command format. Existing adapters use draw-cards, draw and draw-bonus formats; the handler does not guess a universal mapping. The decoder never invokes rules.draw or recalculates the paid deficit from current hands. A null unstarted frame uses the ordinary input gate; resumed frames and results read only the immutable request syntax. Earlier alive/positive-deficit decisions are not repeated after child effects.

Direct prompt/answer/event-child/cleanup state rejects. Active snapshots require their operation child; genuinely abandoned unwind frames may have lost it. The retained return value must be null. The request parser is factored from the live gate; live alive checks, hand count and deficit calculation keep their prior behavior. Default profiles remain on the existing path, and no production registry is opted in by this change.

The validator is trusted versioned profile code, not an untrusted-code sandbox. Structural cursor/child agreement cannot authenticate historical state or bind the whole Room/catalogue/settings/root; those aggregate gates remain separate. All registered child handlers and fixture skills/events still need their own codecs.

## Executed evidence

[30 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/f9046375c483881079b853935d988fd0bd056b5e/tests/hegemony/fill-hand-save.test.ts) use actual fill-hand, acquisition, draw-cards, movement and game-over/scheduler/unwind code. Explicit fixtures supply an owner, Fetch skills/events and the single-recipient draw adapter validator. With a holding [11], filling to3 captures shortfall2 and ends at [11,0,1]. A nested gain of10 instead ends at [11,10,0,1], proving the deficit is not recomputed. The live mapper is called once across save/read/continue/prompt recovery; death during Fetch, dead reform, zero/negative/already-satisfied requests, terminal unwind, mismatched snapshot/child payloads, no-hook legacy coverage and old boolean rejection are covered.

This is an internal handler subset. Complete startup/battle/package codecs, aggregate Room/profile validation, public v3, native full-match parity and release gates remain open. PR33 stays draft.
