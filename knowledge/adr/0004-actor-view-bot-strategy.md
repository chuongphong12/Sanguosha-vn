---
status: accepted
date: 2026-10-22
---

# Competitive bots operate from the seat's permitted information

Bot strength must come from strategy using the actor view and permitted history, not access to another seat's hidden state. Selectively port native strategy into TypeScript behind that boundary; embedding the native raw Room/SmartAI access model would carry visibility and shared-memory assumptions that conflict with the chosen fair-bot contract.

This makes some apparently convenient native helpers unsuitable for direct reuse and requires per-seat memory and noninterference tests. The pinned [native relation helper](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/ai.cpp#L54-L75) reads hidden general names, while [known-card helpers](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/lua/ai/smart-ai.lua#L4686-L4708) do apply visibility checks. The decision is not a claim that every native AI routine cheats. Actual competitive strength still requires measurement under the [spec](https://github.com/chuongphong12/Sanguosha-vn/issues/25).
