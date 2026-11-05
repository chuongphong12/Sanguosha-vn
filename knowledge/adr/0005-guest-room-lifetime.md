---
status: accepted
date: 2026-10-22
---

# Persist recovery state without retaining abandoned guest rooms

Rooms support same-browser refresh and server-restart recovery, while an explicit Leave by the **last online human** deletes immediately, overriding even another participant's unexpired return rights (Q26). A passive last-human transient disconnection permits only a sixty-second return window. Bots do not keep rooms alive, and server downtime is not explicit Leave or time charged against that window; the user replaced the proposed seven-day retention policy with prompt deletion and later rejected preserving an offline seat's grace after the last online person explicitly leaves.

Durable storage therefore supports recovery rather than indefinite match retention. Deletion revokes pending access and work, and recovery must not resurrect a deleted room or retain its private gameplay as a hidden archive. [The room contract investigation](https://github.com/chuongphong12/Sanguosha-vn/issues/28) makes membership/connection/race details explicit before prototype implementation.
