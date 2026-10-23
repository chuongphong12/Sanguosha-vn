# THROWAWAY M0 local tracer and bot baseline

Question: can an application-owned session stage the installed boardgame.io Master, commit its state and receipt together, then expose only actor views? Can a small actor-only TypeScript policy use that same command boundary?

This branch is an investigative source artifact, not a production implementation or a full Quốc Chiến match. The user approved the session contract at Q31. Its [contract](../../../knowledge/research/2026-10-22-m0-session-contract.md) and existing rules authority remain in force. This first executable slice does not complete either M0.3 or M0.4.

## Run

- `npm run prototype:m0`: starts the loopback-only demo and prints its address and scratch-state path. Two private browser contexts represent different people; another tab of the same context can restore its stored seat. Restart with `npm run prototype:m0 -- /absolute/path/to/PROTOTYPE-wipe-me-…/rooms.json` to reuse that scratch state. The parent directory must exist. Delete that scratch directory when finished.
- `npm test -- tests/prototypes`: local kernel/session/privacy checks, including an actual killed server process.
- `npm run prototype:m0:browser`: installed Playwright Chromium, two isolated browser contexts plus a second tab, real HTTP/Socket.IO. This is separate from ordinary unit CI because it needs an installed browser.
- `npm run prototype:m0:benchmark`: emits raw local chooser and staged-Master draw measurements. Machine metrics are a baseline, not a latency/bot-strength acceptance threshold.

The demo needs its local server because real Socket.IO and disk recovery are the questions under test. It deliberately supersedes the prototype skill's default no-server/no-tests shape; the approved tickets explicitly require real transport/storage and privacy/fault checks. No production route imports this code. `server/server.ts`, existing engine modules and their registration are unchanged.

## Actual authorities and boundaries

| Concern               | Actual proof                                                                                                                                 | Limitation                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules execution       | Existing dispatch, drawCards/getNCards/drawCard and movement operations under installed Master 0.50.2                                        | Eight-card fixture, two seats, no skills/package registry/full turn. Drawing is a fixture command, not production Play/card-use admission.                                                                        |
| Master storage/output | All Master writes and subscriber/transport effects staged; only an accepted actor projection returned after disk commit                      | Raw packets are discarded. No production boardgame.io client compatibility, durable event outbox or complete history transport proof.                                                                             |
| Persistence           | Local file write→fsync→rename, one local writer lease, accepted game state/metadata/membership/controller generation/receipt in one document | Same-machine process crash only. No power-loss guarantee, external SQL transaction, distributed lease or provider durability claim. RNG and scheduler serialize but no pending-prompt or shuffle-resume case yet. |
| Admission             | Server-bound socket/secret, current revision, controller generation and actor-scoped intent receipt                                          | No accounts; invitation contains no credential. The first draw freezes this fixture's joins; actual paired-setup freeze is not integrated.                                                                        |
| Privacy               | Fresh own-hand/count/decision projection; another actor's IDs/order/tags are absent                                                          | Only fixture drawing offers are produced. Full battle/general/prompt projection remains pending.                                                                                                                  |
| Controller/lifetime   | Secondary read-only, explicit control claim fences prior tab/job generation; last-online explicit Leave deletes even with an offline member  | No prompt/disconnect grace clocks, automatic bot takeover, host management, full mid-match bot replacement or all-offline expiry yet. These approved requirements remain pending, not changed.                    |
| Bot                   | Pure serialized observation/offers/per-seat versioned memory/seed; native keep-value subset; actual four draw commands via same session API  | Other tactical cases are chooser-only fixtures, not executed Jink/rescue/Nullification/skill/reveal effects. No worker isolation, full AI port or competitive claim.                                              |

Lease recovery checks a stale local PID. That is a bounded single-machine experiment, not a portable distributed coordinator. The scratch file contains private fixture state; no secret/state/receipt is included in committed benchmark output. The UI stores one prototype seat in localStorage; it is not the final multi-room credential UX.

## Evidence and next slices

Tests cover real disk failure with no speculative publication, duplicate intent, stale revision/controller, separate private views, same-browser refresh, immediate deletion/rejected resurrection and SIGKILL after commit before ACK. The benchmark records its fixture/policy/native/seed/runtime identity. The reviewed native-strategy and hosting research are in canonical knowledge; free-tier documentation is not a remote measurement.

Next, connect actual pending request/admission families and durable service-time deadlines, exercise bot decisions against those operations, then prove an external store/provider path with separately authorized provisioning. Keep both prototype tickets open; keep five-by-ten capacity, full content, competitive strength and release acceptance unclaimed. Capture this branch as evidence; production needs its own reviewed implementation ticket.
