# Context Handoff — Visual UI Layer (PixiJS)

> Companion to `HANDOFF.md` (which covers the **game engine** workstream — `src/game/**`).
> This file covers the **PixiJS visual UI** workstream: replacing `MainScreen`'s button-based
> rendering with real card/portrait art. Last updated **2026-09-29** (branch `claude/project-thread-gibd1d`, cut from `ui-upgrade`).

An agent should be able to read this file + `.references/FRAMEWORK-NOTES.md` and continue without
re-deriving context. Read `.references/FRAMEWORK-NOTES.md` first — it is the distilled reference for
boardgame.io 0.50.2 + PixiJS v8 and how this repo wires them.

---

## TL;DR — current status

> **Read this first.** §2–§5 below were written on 2026-09-03 and are kept as history. Since then
> the `ui-upgrade` branch ran milestones M0–M5 of
> `docs/plans/2026-09-20-gitnexus-plan-ui-upgrade-handoff.md` (the canonical plan now). This table
> and §0 are the current truth.

| | |
|---|---|
| Branch | Work lives on `ui-upgrade` (not `main`). This session's fixes are on `claude/project-thread-gibd1d`, cut from `ui-upgrade`. |
| `tsc --noEmit` / `vitest` | ✅ green — 28 files, 174 passed, 4 skipped (2026-09-29) |
| `eslint .` | ❌ red, **pre-existing on `ui-upgrade`** (~99 errors, mostly prettier in `MainScreen.ts`, engine and scene files). The UI component files touched here lint clean. |
| `CardView` / `PlayerAvatar` / `Dashboard` / `SeatView` | Live: `BattleScene` (child of `MainScreen`) renders seats + `Dashboard` with `sync()`. Art, text, HP magatamas, role card and hover lift now display correctly (see §0). |
| Asset aliases (old Blocker 1) | ✅ Done — `src/app/ui/assetAliases.ts`, every alias verified against the generated spritesheet frames. |
| **Battle controls** | ✅ Re-wired (Task 5 in §0): card/seat taps, action row, prompts, hot-seat handoff, log drawer, status bar, general picker, viewer switch. Hot-seat verified in the browser through selection → play Slash with a target → Dodge prompt. |
| Bot matches | ❌ **Bots never act** (pre-existing, engine/AI side; fix in PR #4 "Drive offline bots with the heuristic AI"): boardgame.io's `RandomBot` gets an empty move list from `getHeuristicMoves` for an active bot with nothing to do and crashes (`reading 'payload'`), so a bot lord never picks a general. See §0. |
| Next task | Fix bot enumeration (engine/AI), then M3 visuals (card flight, target marker) — see §0. |

## 0. Session 2026-09-29 — what changed and what's next

Browser-verified at 1366×768 with a 4-player hot-seat match (Playwright + `pnpm exec vite`).

**Fixed**
1. **Escaped template placeholders** (`\${...}` inside template strings renders literally) in `CardView`, `PlayerAvatar`,
   `Dashboard`, `SeatView` and the damage log line in `src/game/engine/core/index.ts`. Cards showed
   the raw text `${SUIT_SYMBOLS[card.suit]} ${card.rank}`, HP art and the role face never loaded.
2. **`MainScreen` crashed on construction**: `Button` used texture `"button"`; the real frame is
   `ui/button.png` (now `UI_BUTTON_ALIAS`).
3. **Alias paths**: added `ROLE_CARD_ALIAS`, `ROLE_CARD_BACK_ALIAS`, `MAGATAMA_ALIAS`,
   `TABLE_BACKGROUND_ALIAS` (`BattleScene` asked for a non-existent `main/ui/system/background/table.jpg`),
   `UI_BUTTON_ALIAS`; all covered by `tests/ui/asset-aliases.test.ts`.
   **Alias rule:** the whole `main` bundle is one TexturePacker sheet (`{tps}` tag,
   `nameStyle: "relative"`), so aliases are paths **relative to `raw-assets/main{m}{tps}/` with no
   `main/` prefix**.
4. **Hand cards drawn below the panel** (pivot had been dropped): hand `CardView`s are pivoted
   bottom-centre again, so hover scale grows upward.
5. **Hover lift used stale positions** (closures captured the layout at creation). Layout now lives
   in `Dashboard.handCardLayouts`; hover respects reduced motion; animations stop on destroy.
6. **Role card flip re-synced with stale state** (closure captured the first `G`). Uses the last
   synced state now.
7. **Child scenes weren't scaled** while laid out in the 860px logical viewport, so the dashboard
   was cut off below 860px windows. `MainScreen.resize` scales the scenes like `content`.
8. `PlayerAvatar` leaked HP/placeholder children on every sync (now destroyed); "Đang kết nối..."
   stayed on screen after connecting; the viewer's own `SeatView` overlapped the dashboard (hidden,
   the dashboard avatar shows it).

**Known issues, not fixed**
- **Audio never loads**: `raw-assets/main{m}{tps}/sounds|audio` are inside the TexturePacker folder,
  so AssetPack emits no audio. `Button` plays `main/sounds/sfx-*.wav`, which doesn't exist. Needs the
  audio moved to a non-`{tps}` folder (e.g. `raw-assets/audio{m}/`) and the aliases updated.
- `AnimationManager` is text-only placeholders (no card flight / target marker); `response-window-*`
  events are declared but not emitted. That's the M3 slice of the canonical plan.
- `BattleScene` seat ring is a placeholder ellipse; `Dashboard.handScrollX` is still unused (cards
  compress instead of scrolling).
- `MainScreen.effectiveWidth` reserves 280px for a log that isn't drawn.

**Task 5 — re-wire battle controls (DONE 2026-09-29)**
- `MainScreen.render()` is now: scene sync → per-status overlay drawn into `content`
  (exit button, viewer selector + `drawSelectionArea` during selection; `drawStatus`, `drawLog`,
  then `drawHandoff` **or** `drawActions` during play).
- `handleDashboardCardTap` / `handleSeatTap` are stable arrow methods that read `this.state`, so
  components never hold stale closures. `targetSelectionState()` feeds `BattleScene` which seats
  are tappable / highlighted.
- Hot-seat privacy: while a handoff is pending the dashboard is hidden (`showDashboard: false`),
  and `BattleScene` rebuilds the `Dashboard` when the viewer changes. The viewer selector only
  shows during general selection.
- Seats are placed on a ring starting with the viewer (hidden, bottom), clear of the status bar,
  log drawer and action row.
- Log is a drawer (`LOG_DRAWER_WIDTH`), with a close button and a "Diễn biến" button to reopen.

**Next**
1. **Bots never act** (engine/AI, pre-existing on `ui-upgrade` and `main`; being fixed in PR #4,
   "Drive offline bots with the heuristic AI"): boardgame.io `Local`
   picks the first active bot (`GetBotPlayer`); if `getHeuristicMoves` returns `[]` for it,
   `RandomBot.play` returns no action and the master throws `reading 'payload'`, forever. Seen with
   a bot lord in lord selection. Make `getHeuristicMoves` never return `[]` for an active player,
   or only mark bots active when they have a move.
2. **Player naming is inconsistent**: status/FormationScene use `getPlayerName(id)` → "Player 3"
   (raw id); handoff/selector use `P${seat + 1}`. Pick one (seat-based) in
   `src/app/utils/playerNames.ts`.
3. FormationScene's long title overlaps the "Thoát" button at 1366px.
4. M3 visuals (card flight, target marker, response-window events), see "Known issues" above.

## 1. What this workstream is

Port the visual presentation of QSanguosha (`.references/QSanguosha/`) onto the PixiJS v8 layer.
The game engine (`src/game/**`) is feature-complete (43/43 skills, 169 tests). The UI
(`src/app/screens/main/MainScreen.ts`, ~2250 lines) currently draws everything with primitive
`Graphics` + text `Button`s. Goal: real card images, general portraits, faction framing, a proper
player dashboard.

Three helper components were written toward this (previous session) but never finished/wired:

- `src/app/ui/CardView.ts` — a card as a `Container`: bg + illustration `Sprite` + suit/rank/name overlay + hover/tap.
- `src/app/ui/PlayerAvatar.ts` — general portrait + faction border + magatama HP bar + name.
- `src/app/ui/Dashboard.ts` — bottom panel composing one `PlayerAvatar` + a row of `CardView`s + equipment summary + pager.

---

## 2. Work done in the session ending 2026-09-03

1. **Read the full framework docs** (boardgame.io + PixiJS v8), mirrored at
   `.references/boardgame.io/documentation/**`, `.references/pixijs/**`, and
   `node_modules/pixi.js/skills/**`. Distilled into **`.references/FRAMEWORK-NOTES.md`** (API
   surface, v7→v8 gotchas, and this repo's integration specifics). **Start there.**
2. **Validated the baseline.** Found it was RED: `tsc` + `eslint` failed (all errors in the 3 new
   UI files). `vitest` was green (169/169).
3. **Fixed the 3 components to compile & lint clean** (minimal changes only):
   - `Dashboard.ts` — removed unused imports/locals (`Texture`, `Sprite`, `Assets`,
     `GENERALS_BY_ID`, `PlayerState`, `SUIT_LABELS`, dead `general` local).
   - `PlayerAvatar.ts` — ctor param `player: PlayerState` → **`player: PlayerViewPlayer`** (real
     type bug: the UI only ever holds `TqsPlayerViewState`, where `role: Role | null`); +
     `eslint --fix` reflowed 5 pre-existing prettier violations.
   - `CardView.ts` — untouched (was already clean; `CardView(card: PhysicalCard)` is compatible
     with `TqsPlayerViewState["cards"]` values).
4. **Confirmed** `pnpm run check` green end-to-end, tests unchanged 169/169.

No engine code, no `MainScreen`, no `G` shape touched.

---

## 3. Current state of the code

### The island (compiles, unused)
`grep` for `Dashboard` / `CardView` / `PlayerAvatar` across `src/`: **only these 3 files reference
each other**, nothing else. `MainScreen`, `main.ts`, `navigation.ts` don't import any of them.
(GitNexus index is stale — predates these files, `impact()` returns "not found"; `grep` is
authoritative here.)

### MainScreen render model — READ THIS BEFORE EDITING
`MainScreen.render()` is **immediate-mode**: it calls `clearContent()` (which `destroy()`s every
child) then rebuilds the entire scene from `LocalMatch` state on **every** state change and every
resize. Consequences:
- UI components must use **synchronous `Assets.get(alias)`** — NOT `await Assets.load(...)`. Textures
  must already be in the cache. They are: `engine.init()` calls
  `Assets.backgroundLoadBundle(allBundles)` at boot, and `MainScreen.assetBundles = ["main"]` so
  `navigation.showScreen(MainScreen)` awaits the `main` bundle before first render.
- Creating fresh `CardView`/`PlayerAvatar` instances every redraw is the accepted pattern here (it's
  what `drawHand` already does with `Button`s). No diffing. If perf bites later, that's a separate
  concern — see `FRAMEWORK-NOTES.md` §2.8 (pooling, `cacheAsTexture`).
- `MainScreen` selection state (`selectedCardIDs: Set<string>`, `selectedTargetIDs`, `handPage`,
  `pendingSkill`, …) lives on the **class**, never in `G` (`G` must stay JSON-serializable).

### `Dashboard`'s scope gap
`Dashboard` only renders avatar + hand + equipment summary + pager. It does **not** render: the
action buttons (`Sử dụng` / `Kết thúc Xuất Bài` / discard confirm), the skill bar (`【Chế Hành】`
etc.), the response prompts (`drawPromptActions`, `drawCardResponsePrompt`, `drawZoneSelection`,
`drawChoosePlayers`, `drawHarvestSelection`), or the equipment-as-virtual-card row
(`drawEquipmentConversions`). Those are ~1500 lines of `MainScreen.drawActions` /
`drawPrivateArea`. So `Dashboard` is **not** a drop-in replacement for `drawPrivateArea` — it can
only replace the hand-rendering + add an avatar. See Task 3 for options.

---

## 4. Blockers — must resolve before the visual UI shows anything

### Blocker 1 (BIG): asset aliases don't match catalog IDs — 3 unrelated naming schemes

Validated against `src/manifest.json` (generated by AssetPack from `raw-assets/`). AssetPack bundle
tags: `raw-assets/main{m}` → bundle `main`, `raw-assets/preload{m}` → bundle `preload`. Nested files
get their full relative path as the alias.

| Art type | Catalog ID (code) | Actual asset alias | Match rate |
|---|---|---|---|
| Basic/trick cards | `slash`, `dodge`, `borrowed-sword`, `harvest`, `ex-nihilo`, `dismantle`, `arrow-barrage`, `barbarian-invasion`, `peach-garden` | `main/cards/card/slash.png`, `.../jink.png`, `.../collateral.png`, `.../amazing_grace.png`, `.../ex_nihilo.png`, `.../dismantlement.png`, `.../archery_attack.png`, `.../savage_assault.png`, `.../god_salvation.png` (QSanguosha English class names) | ~7 / 20 coincide: `slash`, `peach`, `duel`, `snatch`, `nullification`, `indulgence`, `lightning` |
| Equipment cards | `crossbow`, `qinggang-sword`, `serpent-spear`, `halberd`, `qilin-bow`, `bagua-formation`, `renwang-shield`, `jueying`, `zhaohuang-feidian`, `dilu`, `dayuan`, `red-hare`, `zixing` | `main/equips/Crossbow.png`, `.../QinggangSword.png`, `.../Spear.png`, `.../Halberd.png`, `.../KylinBow.png`, `.../EightDiagram.png`, `.../RenwangShield.png`, `.../JueYing.png`, `.../ZhuaHuangFeiDian.png`, `.../DiLu.png`, `.../DaYuan.png`, `.../ChiTu.png`, `.../ZiXing.png` (**PascalCase, different folder**) | 0 / 13 — and `CardView` only searches `main/cards/card/` |
| General portraits | `cao-cao`, `sima-yi`, `lu-meng`, `lu-bu`, `zhang-liao`, `sun-shangxiang`, `huang-yueying`, `hua-xiong` | `main/generals/avatar/caocao.png`, `.../simayi.png`, `.../lvmeng.png`, `.../lvbu.png`, `.../zhangliao.png`, `.../sunshangxiang.png`, `.../huangyueying.png`, **(no `hua-xiong` asset)** | 0 / 27 — hyphens stripped, and `lu→lv` for 吕 |
| Faction icon | `wei` / `shu` / `wu` / `qun` | `main/kingdom/wei.png` (flat) OR `main/ui/kingdom/{icon,corner,frame}/wei.png` | `PlayerAvatar.resolveFactionIcon` builds `main/ui/kingdom/${faction}.png` — **wrong**, needs `main/kingdom/${faction}.png` or `main/ui/kingdom/icon/${faction}.png` |

Also: `PlayerAvatar.resolvePortrait` tries `main/generals/avatar/${id}.jpg` **first** — avatars are
`.png`/`.webp` only; the `.jpg` variants live at `main/generals/card/<name>.jpg` (full card art, not
avatar crop).

**Net effect right now: every general portrait, every faction icon, and ~25/32 card images resolve
to `null` → hand-drawn placeholder.**

**Fix = 3 explicit mapping tables** (`Record<CardName, string>` for cards, another for equipment,
`Record<string /*generalID*/, string>` for portraits) + fix the faction-icon path. Build them by
cross-referencing `src/manifest.json` (asset list) against `src/game/catalog/cards.ts` /
`generals.ts` — both catalogs carry `chineseName` (杀, 曹操, …) which is the reliable join key if
you also read the QSanguosha source. Put the maps in a new `src/app/ui/assetAliases.ts` and have
`CardView` / `PlayerAvatar` consult them. **Note `hua-xiong` (华雄) has no portrait asset** — keep
the placeholder path working.

To list assets: `grep -oE '"main/cards/card/[^"]+\.png"' src/manifest.json` (and `main/equips/`,
`main/generals/avatar/`).

### Blocker 2 (DONE): component types — resolved this session
`PlayerAvatar` now takes `PlayerViewPlayer`. If you add more components, type their ctors against
the **view** types (`TqsPlayerViewState`, `PlayerViewPlayer`) from `src/game/model.ts`, never the
authoritative `PlayerState` / `TqsGameState`.

---

## 5. Next tasks (ordered, with acceptance criteria)

### Task 1 — Asset alias mapping
- **Do:** create `src/app/ui/assetAliases.ts` with `CARD_ART_ALIAS`, `EQUIP_ART_ALIAS`,
  `GENERAL_PORTRAIT_ALIAS` maps. Update `CardView.resolveTexture` and `PlayerAvatar.resolvePortrait`
  / `resolveFactionIcon` to use them.
- **Verify:** a throwaway script or test that asserts, for every `CARD_DEFINITIONS` key and every
  `GENERALS` id, that the mapped alias exists in `manifest.json` (or is a documented no-asset case
  like `hua-xiong`). `pnpm run check` stays green.

### Task 2 — Prove the components render (visual smoke test)
- **Do:** temporarily mount a `CardView` and a `PlayerAvatar` somewhere visible (e.g. a debug branch
  in `MainScreen.render` or a scratch screen). `pnpm dev` (Vite, opens `localhost:8080`).
- **Verify:** real card illustration + real portrait + faction icon appear (not placeholders), in
  the browser. Screenshot. Then revert the scratch mount.

### Task 3 — Decide the `Dashboard` ↔ `MainScreen` integration (needs a human/brainstorm call)
`Dashboard` cannot replace `drawPrivateArea` wholesale (Blocker in §3). Options:
- **3a (smallest):** in `MainScreen.drawHand`, swap the per-card `addButton(...)` for a `CardView`,
  and add one `PlayerAvatar` in the private area. Leave `drawActions` / prompts / skill bar as-is.
  No `Dashboard` class used.
- **3b:** use `Dashboard` for the hand+avatar+equipment strip, keep calling `drawActions` +
  prompt/skill/conversion renderers below it. `Dashboard` needs to expose the tap callbacks
  `MainScreen` already wires (`onCardTap` → toggles `selectedCardIDs`, `onPageChange` → `handPage`).
- **3c:** grow `Dashboard` to own the whole private area (port `drawActions` etc. into it). Large.
- **Recommend 3a or 3b.** Get the user to pick before writing it.
- **Verify:** hot-seat game still fully playable (play card, respond to slash, use skill, discard,
  switch viewer). `pnpm run check` green.

### Task 4 (later) — polish: hover/lift animation via `motion`, card fan layout, equipment slot art
(`raw-assets/main{m}/equips` has the art), magatama HP art (`main/ui/...` — check manifest), table
background is already used by `MainScreen.drawBackground` (`addTextureSprite("table", ...)`).

---

## 6. Key files & where to read

| Path | What |
|---|---|
| `.references/FRAMEWORK-NOTES.md` | **Read first.** boardgame.io + PixiJS v8 distilled + repo integration specifics |
| `src/app/ui/CardView.ts` / `PlayerAvatar.ts` / `Dashboard.ts` | The 3 components (compile clean, unused) |
| `src/app/screens/main/MainScreen.ts` | The live UI. `render()` / `drawPrivateArea()` / `drawHand()` / `drawActions()` |
| `src/app/screens/LoadScreen.ts` | Example of sync `Assets.get()` + `Container` screen + `resize()` |
| `src/engine/navigation/navigation.ts` | Screen lifecycle (`assetBundles`, `prepare/show/hide/resize/update`, `BigPool`) |
| `src/engine/engine.ts` / `src/main.ts` | `CreationEngine extends Application`, `Assets.init` + bundle loading, font preload |
| `src/game/model.ts` | All types. **View types**: `TqsPlayerViewState`, `PlayerViewPlayer` (line ~594) |
| `src/game/catalog/cards.ts` / `generals.ts` | `CARD_DEFINITIONS` (32), `GENERALS` (27) — the IDs + `chineseName` |
| `src/manifest.json` | Generated asset list (aliases). `raw-assets/` is the source; `scripts/assetpack-vite-plugin.ts` the config |
| `src/client/LocalMatch.ts` | Hot-seat wrapper: N boardgame.io clients, `switchViewer`, `move()` |
| `HANDOFF.md` / `ARCHITECTURE.md` / `SKILL_CONFORMANCE.md` | Engine-side context (different workstream) |
| `.references/QSanguosha/` | The C++ game being ported (rules + art source of truth) |

---

## 7. Constraints / gotchas that will trip you up

- **PixiJS is v8.** `Graphics`: shape-then-fill (`.rect(...).fill(c)`, no `beginFill`). `Text`:
  `new Text({ text, style })`. `Assets.load` to fetch, `Assets.get` for cache. Events need
  `eventMode = 'static'`. `container.label` not `.name`. Full list: `FRAMEWORK-NOTES.md` §2.9.
- **`Assets.get()` only — never `await` inside the render path** (immediate-mode redraw is sync).
- **Never put UI state in `G`** — `G` must be JSON-serializable and is server-authoritative. All
  moves are `client: false` (see `src/game/TqsGame.ts`), so the UI only ever sees
  `createPlayerView` output.
- **`patches/boardgame.io@0.50.2.patch`** must stay (player-view `initialState` leak fix). Applied
  via `patchedDependencies:` in `pnpm-workspace.yaml`.
- **GitNexus index is stale** for `src/app/ui/**`. Re-run `node .gitnexus/run.cjs analyze` if you
  want it current, or just use `grep`/`Grep` for these files.
- Package manager is **pnpm** (there's a `pnpm-lock.yaml` + `pnpm-workspace.yaml`). `package.json`
  scripts say `npm` but `pnpm run <script>` works. Some older docs (`HANDOFF.md`) say `pnpm exec`.
- Fonts: `GAME_FONT_FAMILY = "Noto Serif"`, preloaded via `document.fonts.load` in
  `src/app/ui/typography.ts` before `engine.init()` (Pixi rasterizes `Text` to canvas, so the
  Vietnamese glyphs must be ready first).
- `motion` (`import { animate } from "motion"`) is the tween lib — see `LoadScreen.hide()`.

---

## 8. How to verify / run

```bash
pnpm run check      # eslint + tsc --noEmit + vitest run  → must exit 0
pnpm test           # just the 169 tests
pnpm dev            # Vite dev server, opens http://localhost:8080  (visual check)
pnpm build          # check + vite build
```

Baseline as of 2026-09-03: `pnpm run check` exit 0, `Test Files 25 passed`, `Tests 169 passed`.
