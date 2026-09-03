# Framework Notes — boardgame.io 0.50.2 + PixiJS v8

Consolidated reference for the two frameworks this project runs on, distilled from a
full read of their documentation. Read this before writing non-trivial engine/UI code.

| Framework | Version (package.json) | Full docs mirrored at |
|---|---|---|
| boardgame.io | `0.50.2` (exact pin) | `.references/boardgame.io/documentation/*.md` |
| PixiJS | `^8.8.1` | `.references/pixijs/guides/**` + `node_modules/pixi.js/skills/**` (curated, LLM-oriented) |
| Reference C++ game | — | `.references/QSanguosha/` (the Sanguosha implementation being ported) |

The two starting URLs the docs were pulled from:
`https://boardgame.io/documentation/#/tutorial` and `https://pixijs.com/8.x/guides/getting-started/intro`.

---

## Part 1 — boardgame.io 0.50.2

### 1.1 Core model

Game state is split in two objects, passed everywhere:

- **`G`** — your game state. **Must be JSON-serializable** (no classes, functions, `Map`, `Set`,
  `undefined` round-trips). Sent between client and server.
- **`ctx`** — framework-managed metadata: `turn`, `currentPlayer`, `numPlayers`, `playOrder`,
  `playOrderPos`, `phase`, `activePlayers`, `gameover`. Change it via **events**, never directly.

**Moves** mutate `G`. They must be **pure** (no external state, no side effects except mutating `G`).
boardgame.io wraps them with [immer](https://github.com/immerjs/immer), so you mutate `G` directly
and **do not return** anything (returning while mutating is an error). Returning `INVALID_MOVE`
(from `boardgame.io/core`) rejects the move and discards the state change.

**Events** mutate `ctx`: `endTurn`, `endPhase`, `setPhase`, `endGame`, `setStage`, `endStage`,
`setActivePlayers`, `removePlayer`. Available in moves/hooks via the `events` arg, or on the client
via `client.events.*`. **Events are queued and fire _after_ the move completes**, even if you call
the event first in the move body.

### 1.2 Game object (the important fields)

```js
{
  name: 'my-game',
  minPlayers, maxPlayers,           // only enforced by the Lobby server component
  setup: ({ ctx, random, ...plugins }, setupData) => G,
  validateSetupData: (setupData, numPlayers) => 'error string' | undefined,

  moves: {
    // short form
    A: ({ G, ctx, playerID, events, random, log }, ...args) => { /* mutate G */ },
    // long form
    B: {
      move: (...) => {},
      client: false,          // don't run optimistically on client (needed for secret state)
      undoable: false,
      redact: true,           // hide move args from the log
      noLimit: true,          // doesn't count toward min/maxMoves
      ignoreStaleStateID: true,
    },
  },

  turn: {
    order: TurnOrder.DEFAULT,       // DEFAULT | RESET | CONTINUE | ONCE | CUSTOM(arr) | CUSTOM_FROM(field)
    minMoves, maxMoves,
    activePlayers: { ... },         // auto setActivePlayers at turn start
    onBegin, onEnd, onMove,         // hooks (server-only in multiplayer)
    endIf: ({ G, ctx }) => true | { next: playerID },
    stages: { stageName: { moves: {...}, next: 'other' } },
  },

  phases: {
    phaseName: {
      start: true,                  // exactly one phase may have this
      moves: {...},                 // OVERRIDES global moves entirely while active
      turn: {...},                  // override turn config for the phase
      onBegin, onEnd,
      endIf: ({ G, ctx }) => true,
      next: 'otherPhase' | ({ G, ctx }) => 'otherPhase',
    },
  },

  endIf: ({ G, ctx }) => value,     // truthy value → game over, exposed as ctx.gameover
  onEnd: ({ G, ctx }) => G,
  playerView: ({ G, ctx, playerID }) => filteredG,   // hide secret state per client
  seed: 'string-or-number',         // fixes the PRNG
  disableUndo: true,
  deltaState: true,                 // JSON-Patch deltas over the wire
  plugins: [PluginA, PluginB],
}
```

**`endIf` check order** after every step: `game.endIf → phase.endIf → turn.endIf` (broad → narrow;
first truthy wins and skips the rest). When a phase ends, the current turn ends first automatically.

### 1.3 Randomness

Never call `Math.random()` in game logic — it breaks purity and replayability, and the RNG must
stay server-side. Use the `random` arg: `random.D6()`, `random.Die(n, count)`, `random.Number()`
(0–1), `random.Shuffle(array)` (returns a new shuffled array). Set `seed` for deterministic tests.

### 1.4 Secret state / hidden information

`playerView: ({ G, ctx, playerID }) => G'` returns a filtered `G` per client. `playerID` can be
`null`/`undefined` for spectators. Built-in `PlayerView.STRIP_SECRETS` removes a `secret` key and
all `players[*]` entries except the viewer's.

**Moves that touch data the client can't see must set `client: false`** so they only run on the
master (otherwise the optimistic client update computes garbage).

### 1.5 Multiplayer transports

- `Local()` from `boardgame.io/multiplayer` — in-browser in-memory master, for hot-seat / tests.
  Options: `{ persist: true, storageKey: 'bgio' }` for localStorage.
- `SocketIO({ server: 'host:port' })` — remote master over WebSocket.
- Clients need a `playerID` to make moves; without one they're spectators. `matchID` groups clients
  into the same game instance (default `'default'`).

Client API: `Client({ game, numPlayers, multiplayer, matchID, playerID, debug })`. Instance has
`.moves`, `.events`, `.getState()` (returns `null` until first sync), `.subscribe(cb) → unsubscribe`,
`.start()`, `.stop()`, `.updatePlayerID()`, `.loadState()`, `.previewState()`.

### 1.6 Testing

Moves are plain functions → unit test them directly: `clickCell({ G, playerID: '1' }, 3)`.
Scenario tests: spin a `Client({ game: {...Game, setup: () => customG } })`, call `.moves.*`, read
`.getState()`. Fixed `seed` or `MockRandom` (from `boardgame.io/testing`) for deterministic RNG.
Multiplayer tests: two `Client({ ...spec, multiplayer: Local(), playerID })` instances stay in sync.

### 1.7 How THIS project uses boardgame.io

- **`src/game/TqsGame.ts`** — the `Game<TqsGameState>` definition. All 7 moves
  (`selectGeneral`, `endPlayPhase`, `resumePlayPhase`, `playCard`, `useSkill`, `answerPrompt`,
  `discardCards`) are wrapped by `authoritative()` → `{ client: false, undoable: false, redact }`.
  So **every move runs server-only**; there are no optimistic client updates. `disableUndo: true`,
  `deltaState: false`.
- `turn.activePlayers: { all: Stage.NULL }` — every player is always "active" (can submit moves) so
  the engine's own turn/prompt logic gates who may actually act, not boardgame.io's turn system.
  There are **no phases** and **no stages** — the game's status machine lives in `G.status` /
  `G.turn` inside `cardEngine.ts`, not in `ctx`.
- `random.Shuffle` is adapted to the engine's `Shuffle` type via `shuffleFrom(random)`.
- `endIf: ({ G }) => G.winner ?? undefined`.
- `playerView` → `createPlayerView(G, playerID)` in `src/game/player-view.ts` (hides opponent hands,
  deck, effect stack, unrevealed generals).
- **`src/client/LocalMatch.ts`** wraps N `Client` instances (one per seat) sharing one `matchID`,
  all on `Local()`. `switchViewer()` swaps which client's filtered state the UI subscribes to — this
  is the hot-seat "Góc nhìn" selector. `move(name, ...args)` proxies to the current viewer's client.
- **`patches/boardgame.io@0.50.2.patch`** — patches the `sync` handler in `filter-player-view` so
  `syncInfo.initialState` is also run through `applyPlayerView`. Without the patch the client
  receives the **unfiltered** initial state (a secret-state leak). Keep this patch.
- Integration test gotcha (see `HANDOFF.md`): `Local()` + `InMemory` storage is fully synchronous,
  so the move→master→broadcast pipeline completes in one call. The `sync` client handler has no
  `_stateID` staleness guard (unlike `update`) — latent, not currently triggered.

### 1.8 boardgame.io gotchas

- `G` must stay JSON-serializable — the engine's `Set<string>` selections live in the **UI layer**
  (`MainScreen`), never in `G`.
- Hooks (`onBegin`/`onEnd`/`onMove`) run **server-only** in multiplayer; moves run both sides
  (unless `client: false`).
- Phase `moves` **completely replace** global `moves` — a same-named move in a phase is unrelated
  to the global one.
- `INVALID_MOVE` and `Stage`, `TurnOrder`, `ActivePlayers`, `PlayerView`, `GameMethod` all import
  from `boardgame.io/core`. Types (`Game`, `Move`, `Ctx`) from `boardgame.io`.

---

## Part 2 — PixiJS v8

### 2.1 The v8 mental model

- **Single package.** Import everything from `pixi.js`. The `@pixi/*` sub-packages are v7.
  Sub-path side-effect imports exist for the extension system (`import 'pixi.js/app'`, `.../prepare`,
  `.../text-bitmap`, `.../unsafe-eval`, ...).
- **`Application` init is async.** `const app = new Application(); await app.init({...})`. The
  constructor takes **no args** (passing them warns). `app.renderer` / `app.canvas` / `app.screen`
  don't exist until `init()` resolves.
- **`DisplayObject` is gone.** Every node is a `Container` subclass. Type params as `Container`.
- **Leaves must not have children.** `Sprite`, `Graphics`, `Text`, `Mesh` set `allowChildren=false`;
  nesting children logs a deprecation warning (future hard error). Wrap in a `Container`.
- **Renderer is WebGL / WebGPU / Canvas**, chosen by `autoDetectRenderer`. `preference: 'webgl'`
  (or `['webgpu','webgl']`) is a *hint* — branch on `app.renderer.name` for backend-specific code.
- Renderer = **Systems** (textures, state, filters, masks) + **RenderPipes** (per-renderable
  instruction builders). Custom renderables = a `RenderPipe`.

### 2.2 Scene graph

- Tree rooted at `app.stage`. Children render in **array order** (index 0 = back, last = front).
- Transforms (`position`/`scale`/`rotation`/`pivot`/`skew`) are **LOCAL to the parent**. Use
  `toGlobal(p)` / `toLocal(p, from?)` / `getGlobalPosition()` for world space. `rotation` is radians,
  `angle` is degrees (aliased). `position`/`scale`/`pivot`/`skew` are `ObservablePoint` — `scale = 2`
  sets both axes.
- **`origin`** (v8) — rotation/scale center that does NOT move the object (unlike `pivot`, which
  displaces it). Pick one, not both.
- `visible = false` skips render + transform updates; `renderable = false` skips render but keeps
  transforms live (for bounds / hit-testing).
- `alpha` and `tint` multiply down the subtree. `blendMode` per container.
- **`getBounds()` returns a `Bounds`, not a `Rectangle`** — use `.rectangle` for `Rectangle`
  methods. `getLocalBounds()` is cheaper for self-contained layout math.
- `label` (was `name`). `getChildByLabel(label, deep?)`, `getChildrenByLabel(re, deep?)`.
- **z-ordering:** `container.sortableChildren = true` + child `zIndex` values (needs *distinct*
  values). Setting a child's `zIndex` auto-marks the parent for re-sort. `RenderLayer` for render
  order decoupled from hierarchy (`.attach()`/`.detach()`, never `addChild`).
- **Render groups:** `new Container({ isRenderGroup: true })` / `.enableRenderGroup()` — transform
  applied once on the GPU instead of per-child on the CPU. Use for large *stable* subtrees (world,
  HUD). Don't overuse; groups can't batch with each other. The root is auto a render group.
- **`onRender = (renderer) => {}`** — per-frame hook per container (replaces v7 `updateTransform`
  override). `= null` to detach.
- **Destroy:** `container.destroy({ children: true })` for a whole subtree; add
  `texture: true, textureSource: true` to free leaf GPU resources. Disable `cacheAsTexture(false)`
  first. Remove from parent *before* destroying if mid-frame (or defer via `ticker.addOnce`).

### 2.3 Graphics (most-changed v8 API) — shape THEN style

```ts
const g = new Graphics();
g.rect(x, y, w, h).fill({ color: 0xff0000, alpha: 0.8 }).stroke({ width: 2, color: 0xffffff });
g.circle(cx, cy, r).fill(0x00ff00);
g.roundRect(x, y, w, h, radius).fill(color);
g.moveTo(x, y).lineTo(x, y).bezierCurveTo(...).closePath().fill(color);
g.rect(...).fill(c).circle(...).cut();          // hole (must be fully inside; looks back ≤2 instrs)
g.clear();                                        // wipe to reuse
```

- **No `beginFill`/`endFill`/`lineStyle`/`drawRect`/`drawCircle`/`beginHole`.** Renamed:
  `drawRect→rect`, `drawCircle→circle`, `drawEllipse→ellipse`, `drawPolygon→poly`,
  `drawRoundedRect→roundRect`, `drawStar→star`. `lineStyle → stroke({...})`. Holes → `cut()`.
- `fill()` takes a color, `{ color, alpha, texture, matrix }`, `FillGradient`, `FillPattern`, or
  `Texture`. `stroke()` adds `width`, `cap`, `join`, `alignment` (1=inside, .5=center, 0=outside),
  `pixelLine`.
- `GraphicsContext` replaces `GraphicsGeometry`. Share tessellated geometry: `new Graphics(ctx)` or
  `new Graphics({ context })`. Don't `destroy({ context: true })` a shared context.
- **Graphics is meant to be stable.** `clear()` + redraw every frame re-tessellates on the GPU
  (opposite of Canvas2D). For dynamic visuals use a `Sprite` with a pre-rendered texture,
  `cacheAsTexture(true)`, `renderer.generateTexture(g)`, or a `Mesh`. Small graphics (<~100 pts)
  batch like sprites; complex ones don't.
- Draw-time transforms are separate from the container transform and renamed to avoid clashes:
  `rotateTransform` / `scaleTransform` / `translateTransform` / `setTransform`; `save()`/`restore()`.
- `g.containsPoint(g.toLocal(e.global))` for topology-aware hit testing.

### 2.4 Sprite / Texture / Assets

- **`Texture.from(url)` does NOT load** in v8 — it only reads the `Assets` cache. Always
  `const tex = await Assets.load('id')` first; the return value *is* the texture. `Sprite.from(id)`
  also only reads cache.
- `new Sprite({ texture, anchor: 0.5, tint })`. **`anchor`** is normalized [0,1] and shifts only
  the draw origin (no position change) — use `anchor.set(0.5)` to center, never `pivot`.
- `sprite.setSize(w, h)` adjusts scale to fit pixel size in one op (cheaper than setting
  `.width`/`.height` separately).
- Modifying a texture's `frame`/source after creation doesn't auto-notify sprites — set
  `texture.dynamic = true` or call `sprite['onViewUpdate']()`.
- Variants: `AnimatedSprite` (frame arrays / `sheet.animations['walk']`), `NineSliceSprite` (was
  `NineSlicePlane`; resizable UI panels), `TilingSprite` (scrolling/repeating; animate
  `tilePosition`). Particles → `ParticleContainer` + `Particle` (not sprites), needs a `boundsArea`.

**`Assets`** (singleton loader + resolver + cache):

```ts
await Assets.init({ manifest, basePath: 'assets', texturePreference });   // once only
await Assets.load('alias-or-url');            // or an array, or { alias, src, data, parser }
await Assets.loadBundle(['ui', 'level1']);
Assets.backgroundLoadBundle([...]);           // non-blocking prime
Assets.get('alias');                          // cache read (sync)
await Assets.unloadBundle('level1');          // free GPU memory (destroy referencing nodes first)
```

- `Assets.add({ alias, src })` — object form only (positional removed).
- Force a loader for extension-less URLs: `{ src, parser: 'texture' | 'json' | 'web-font' | ... }`
  (`loadParser` is the deprecated name).
- Format/resolution patterns in `src`: `hero@{0.5,1,2}x.{webp,png}`.
- Spritesheets: `const sheet = await Assets.load('atlas.json')` → `sheet.textures['frame.png']`,
  `sheet.animations['walk']`. Consolidates draw calls / enables batching. `meta.scale` must match
  the atlas's real resolution.

### 2.5 Text

- **Options-object constructor only:** `new Text({ text, style })`. `(string, style)` is removed.
- Classes: **`Text`** (canvas raster, high quality, expensive to update — re-rasterizes the whole
  string), **`BitmapText`** (glyph atlas, cheap per-frame updates, limited styling, no good CJK),
  **`HTMLText`** (HTML/CSS via SVG, 1-frame async delay), `SplitText`/`SplitBitmapText`
  (per-character).
- **Never update `Text.text` every frame** — use `BitmapText`, or guard `if (t.text !== next)`.
- `TextStyle`: `{ fontFamily, fontSize, fontWeight, fill, stroke: { color, width }, dropShadow: {
  color, blur, distance, angle, alpha }, align, letterSpacing, wordWrap, wordWrapWidth }`. In v8
  `stroke` and `dropShadow` are **objects** (v7 `strokeThickness` / flat dropShadow props are gone).
  A `TextStyle` instance can be shared across `Text` objects.
- Web fonts: `await Assets.load({ src: 'x.woff2', data: { family: 'MyFont', weights: ['400','700'] }})`
  then `style.fontFamily: 'MyFont'`. Load the font *before* creating `Text` or it caches at the
  fallback. Derived family name = filename title-cased (`open_sans.ttf` → `'Open Sans'`).

### 2.6 Events

- **Default `eventMode` is `'passive'` → the object receives NO events.** Set
  `node.eventMode = 'static'` (or `'dynamic'` for objects moving under a stationary cursor).
  `'none'` skips the node + subtree entirely.
- `node.cursor = 'pointer'` (replaces removed `buttonMode`). `interactive = true` is an alias for
  `eventMode = 'static'`.
- Prefer **pointer events**: `pointerdown`, `pointerup`, `pointerupoutside`, `pointertap`,
  `pointerover`, `pointerout`. Listen with `.on()` / `.once()` / `.off()`, `addEventListener()`, or
  `onpointerdown =`.
- **`pointermove` / `mousemove` / `touchmove` only fire while the pointer is over the object** in v8.
  For drag / global tracking use **`globalpointermove`**.
- `hitArea` (a `Rectangle`/`Circle`/`Polygon`/`{contains(x,y)}`) overrides bounds testing and speeds
  it up. `interactiveChildren = false` skips a container's children in hit testing.
- `event.global` (scene space), `event.client` (CSS px), `event.target` / `.currentTarget`,
  `.stopPropagation()`, capture phase via `'pointerdowncapture'`.
- `cursor` does **not** inherit — set it on each interactive child.
- Toggle categories for perf: `app.init({ eventFeatures: { move, globalMove, click, wheel } })`.

### 2.7 Ticker / render loop

- `app.ticker.add((ticker) => { ... })` — **the callback gets the `Ticker`, not a delta number**
  (v7 `(dt) => ...` gives you the whole object → `NaN`).
- `ticker.deltaTime` = dimensionless multiplier ≈1.0 at 60fps (2.0 at 30fps) — use as a
  frame-rate-independent scalar. `ticker.deltaMS` = real ms (use for px/sec). `ticker.elapsedMS` =
  raw, unscaled. **`deltaTime` is NOT milliseconds.**
- Priority: `INTERACTION(50) > HIGH(25) > NORMAL(0) > LOW(-25) > UTILITY(-50)`. `app.render()` is
  registered at `LOW`, so `NORMAL`/`HIGH` callbacks run before the draw. Pass context as 2nd arg:
  `ticker.add(this.update, this)` (and `remove(fn, this)` must match both).
- `app.init({ autoStart: false })` + your own `requestAnimationFrame` loop calling `app.ticker.update()`
  then `app.render()` for manual control. `app.start()` / `app.stop()`.
- `sprite.onRender = () => {}` — per-object per-frame alternative.
- FPS: `ticker.maxFPS` (skips frames), `ticker.minFPS` (caps large deltas, default 10), `ticker.speed`.

### 2.8 Performance essentials

- **Profile first** (DevTools Performance + GPU).
- **Batching breaks** on: object-type change (Sprite↔Graphics), texture-source change past the
  per-batch limit (~16), blend-mode change, topology change. → Group same-type children together;
  use spritesheets.
- **Object pooling** beats destroy/recreate (toggle `visible`, reset props).
- **`cacheAsTexture(true)`** for many static children / expensive filters; `updateCacheTexture()`
  after changes; disable before `destroy()`; don't toggle repeatedly; watch the ~4096px limit.
- **Culling is manual in v8** — `extensions.add(CullerPlugin)` before `app.init`, then
  `node.cullable = true` (+ optional `cullArea: Rectangle`). `cullableChildren = false` stops
  recursion for always-visible UI. Use only when GPU-bound (adds CPU bounds checks).
- `app.destroy({ releaseGlobalResources: true })` before recreating an `Application` in the same
  tab (else pooled batches/textures leak → flicker/corruption).
- `import 'pixi.js/prepare'` + `await app.renderer.prepare.upload(app.stage)` to avoid first-frame
  texture-upload hitches.
- GC via init opts (ms): `gcMaxUnusedTime` (default 60000), `gcFrequency` (default 30000). The
  `textureGC.*` props are deprecated since 8.15.
- `container.filterArea = new Rectangle(...)` when known; `container.filters = null` to free.
- Mask cost: axis-aligned `Rectangle` (scissor) < `Graphics` (stencil) < `Sprite`/alpha (filter).

### 2.9 v7 → v8 quick reference

| v7 | v8 |
|---|---|
| `new Application({ width, height })` | `new Application(); await app.init({ width, height })` |
| `app.view` | `app.canvas` |
| `import { Sprite } from '@pixi/sprite'` | `import { Sprite } from 'pixi.js'` |
| `g.beginFill(c).drawRect(...).endFill()` | `g.rect(...).fill(c)` |
| `g.lineStyle(2, c)` | `g.rect(...).stroke({ width: 2, color: c })` |
| `g.beginHole().drawCircle(...).endHole()` | `g.circle(...).cut()` |
| `g.geometry` / `GraphicsGeometry` | `GraphicsContext` |
| `BaseTexture` | `TextureSource` (`ImageSource`/`CanvasSource`/`VideoSource`/...) |
| `Texture.from(url)` (loads) | `await Assets.load(url)` |
| `Assets.add('k', 'url')` | `Assets.add({ alias: 'k', src: 'url' })` |
| `ticker.add((dt) => ...)` | `ticker.add((ticker) => ... ticker.deltaTime)` |
| `updateTransform()` override | `onRender` callback |
| `container.getBounds()` → `Rectangle` | → `Bounds` (use `.rectangle`) |
| `cacheAsBitmap = true` | `cacheAsTexture(true)` |
| `container.name` | `container.label` |
| `NineSlicePlane` | `NineSliceSprite` |
| `new Text('hi', style)` | `new Text({ text: 'hi', style })` |
| `sprite.interactive = true; sprite.buttonMode = true` | `sprite.eventMode = 'static'; sprite.cursor = 'pointer'` |
| `pointermove` for drag | `globalpointermove` |
| `SCALE_MODES.NEAREST` | `'nearest'` |
| `settings.RESOLUTION = 1` | `AbstractRenderer.defaultOptions.resolution = 1` |
| `utils.isMobile` | `import { isMobile } from 'pixi.js'` |
| default `eventMode` `'auto'` | default `'passive'` |

### 2.10 How THIS project uses PixiJS

- **`src/engine/engine.ts` — `CreationEngine extends Application`** (from the PixiJS "creation"
  template). Adds plugins via `extensions`: removes the stock `ResizePlugin`, adds
  `CreationResizePlugin` (letterbox/min-size logic), `CreationAudioPlugin`, `CreationNavigationPlugin`.
  On `init()`: appends `this.canvas` to `#pixi-container`, wires a `visibilitychange` listener that
  pauses `@pixi/sound` + navigation, then `Assets.init({ manifest, basePath: 'assets' })`,
  `Assets.loadBundle('preload')`, and `Assets.backgroundLoadBundle(allBundles)`.
- **`src/main.ts`** — `await loadGameFonts()` (browser `document.fonts.load` for the Vietnamese
  glyph set — Pixi rasterizes `Text` to canvas so the font must be ready first) → `engine.init({
  background: '#120F0D', resizeOptions: { minWidth: 768, minHeight: 820, letterbox: false } })` →
  `navigation.showScreen(LoadScreen)` → `navigation.showScreen(MainScreen)`.
- **Navigation** (`src/engine/navigation/navigation.ts`) — a screen/popup stack on
  `app.stage`. A screen is a `Container` with optional `prepare/show/hide/reset/update/resize/
  blur/focus` methods and a static `assetBundles: string[]` (loaded before the screen shows,
  progress → `screen.onLoad(pct)`). Screens are pooled via `BigPool.get(ctor)`. `update` is
  registered on `app.ticker` with the screen as context.
- **AssetPack** (`scripts/assetpack-vite-plugin.ts`, `.assetpack`) — Vite plugin, `entry: raw-assets`,
  `pixiPipes({ cacheBust: false, manifest: { output: './src/manifest.json' } })`. Watches in dev,
  runs once for build. Output → `public/assets/`.
  - Folder tags: `raw-assets/main{m}` and `raw-assets/preload{m}` — `{m}` marks a **bundle**
    (`main`, `preload`; plus an empty `default`). `{tps}` = TexturePacker spritesheet, `{tags}` etc.
  - **Alias scheme:** nested files get their full relative path as alias —
    `main/cards/card/archery_attack.png`, `main/generals/avatar/caocao.png`,
    `main/ui/kingdom/corner/qun.png`. Files also get shortened aliases in some cases
    (`preload/bg.jpg` → also `bg.jpg`; `main/kingdom/qun.png` is a separate flattened copy).
  - Each entry resolves `@0.5x` + `.webp`/`.png` variants automatically.
- **Rendering pattern in `MainScreen.ts`** — **immediate-mode redraw**: `render()` calls
  `clearContent()` (destroys all children) then rebuilds the entire scene from
  `LocalMatch` state every time state changes or the viewport resizes. This is why the UI helper
  components (`CardView`, `PlayerAvatar`, `Dashboard`) use **synchronous `Assets.get()`** (not
  `await Assets.load()`) — textures must already be in cache (background-loaded at boot) because the
  redraw is synchronous. Missing textures fall back to drawn placeholders.
  `content.scale` is set from `height / MIN_LAYOUT_HEIGHT` and `viewportWidth/Height` are the
  unscaled logical size.
- Other deps: `@pixi/sound` (audio, auto-registers on import), `@pixi/ui` (available, e.g. sliders),
  `motion` (the `animate()` tween function — used for screen fade in `LoadScreen.hide()`),
  `@esotericsoftware/spine-pixi-v8` (imported-but-commented in `main.ts`).

### 2.11 Project-integration gotchas (validated 2026-08-28 against `src/manifest.json` + `tsc`/`eslint`)

- **`Dashboard.ts` / `CardView.ts` / `PlayerAvatar.ts` are an isolated, non-compiling island.**
  Nothing live imports `Dashboard`; only `Dashboard` imports `CardView`/`PlayerAvatar`. `MainScreen`
  still renders hands via the button-based `drawHand()`.
  - `tsc --noEmit` → **8 errors, all in `Dashboard.ts`** (6 unused imports/locals + 1 real type
    error). `eslint .` → **12 errors** (7 in `Dashboard.ts`, 5 prettier in `PlayerAvatar.ts`).
    `vitest run` → 169/169 pass. So `pnpm run check` fails at the lint step.
  - **Type-design flaw** (`Dashboard.ts:69`): `PlayerAvatar`'s ctor takes `PlayerState`
    (authoritative), but the UI only ever holds `TqsPlayerViewState` where `player.role` is
    `Role | null` and `player.generalID` is `string | null`. The components must be re-typed
    against the *view* types before they can be wired in.
- **Asset names do not match catalog IDs — three separate schemes, almost nothing lines up:**

  | Thing | Catalog ID (code) | Asset alias (manifest) | Match rate |
  |---|---|---|---|
  | Basic/trick cards | `slash`, `dodge`, `borrowed-sword`, `harvest`, `ex-nihilo` | `main/cards/card/slash.png`, `.../jink.png`, `.../collateral.png`, `.../amazing_grace.png`, `.../ex_nihilo.png` (QSanguosha English) | ~7 of 20 coincide (`slash`, `peach`, `duel`, `snatch`, `nullification`, `indulgence`, `lightning`) |
  | Equipment cards | `crossbow`, `qinggang-sword`, `serpent-spear`, `bagua-formation`, `renwang-shield` | `main/equips/Crossbow.png`, `.../QinggangSword.png`, `.../Spear.png`, `.../EightDiagram.png`, `.../RenwangShield.png` (**PascalCase, different folder**) | 0 of 12 — and `CardView` only looks in `main/cards/card/` |
  | General avatars | `cao-cao`, `sima-yi`, `lu-meng`, `lu-bu`, `hua-xiong` | `main/generals/avatar/caocao.png`, `.../simayi.png`, `.../lvmeng.png`, `.../lvbu.png` (unseparated pinyin, `lu→lv`; **no `hua-xiong` asset**) | 0 of 27 |

  `CardView` builds `main/cards/card/${definitionID}.png`; `PlayerAvatar.resolvePortrait` builds
  `main/generals/avatar/${generalID}.jpg` first (**avatars are `.png`/`.webp`; `.jpg` lives at
  `main/generals/card/<name>.jpg`**). `PlayerAvatar.resolveFactionIcon` builds
  `main/ui/kingdom/${faction}.png` but the assets are `main/ui/kingdom/corner/<faction>.png`
  (or the flattened `main/kingdom/<faction>.png`). **Net: every general portrait, every faction
  icon, and ~25/32 card images currently resolve to `null` → drawn placeholder.**
  A real ID→alias mapping (3 tables: card, equipment, general) plus a `resolveFactionIcon` path
  fix is required before these components display any art.
- `LoadScreen` reads `Assets.get<Texture>('bg.jpg')` and `'preload/logo.png'` synchronously in its
  constructor — works only because they're in the `preload` bundle loaded during `engine.init()`.

---

## Part 3 — Full-doc index (read when this summary is not enough)

### boardgame.io (`.references/boardgame.io/documentation/`)
`tutorial.md`, `concepts.md`, `phases.md`, `stages.md`, `turn-order.md`, `events.md`,
`immutability.md`, `secret-state.md`, `random.md`, `plugins.md`, `multiplayer.md`, `storage.md`,
`testing.md`, `undo.md`, `typescript.md`, `debugging.md`, `deployment.md`,
`api/{Game,Client,Server,Lobby}.md`, `CHANGELOG.md`.

### PixiJS — curated skills (`node_modules/pixi.js/skills/`, LLM-oriented, prefer these)
Router: `pixijs/SKILL.md` + `pixijs/references/index.md`. Leaves: `pixijs-application`,
`pixijs-core-concepts`, `pixijs-scene-core-concepts`, `pixijs-scene-container`,
`pixijs-scene-sprite`, `pixijs-scene-graphics`, `pixijs-scene-text`, `pixijs-scene-mesh`,
`pixijs-scene-particle-container`, `pixijs-assets` (+ `references/{bundles,manifests,spritesheet,
fonts,caching,...}.md`), `pixijs-events`, `pixijs-ticker`, `pixijs-color`, `pixijs-math`,
`pixijs-filters`, `pixijs-blend-modes`, `pixijs-performance`, `pixijs-migration-v8`,
`pixijs-environments`, `pixijs-custom-rendering`, `pixijs-accessibility`.
**Fallback for anything uncovered:** `WebFetch https://pixijs.download/release/docs/llms.txt`
(always-current API index; each entry links to a `.html.md` page).

### PixiJS — guide prose (`.references/pixijs/guides/`)
`getting-started/{intro,quick-start,ecosystem}.mdx`, `concepts/{architecture,environments,
render-loop,render-groups,scene-graph,performance-tips,garbage-collection}.md`,
`components/**` (application plugins, assets, events, filters, scene-objects/**, textures, ticker),
`migrations/{v5,v6,v7,v8}.md`, `third-party/mixing-three-and-pixi.mdx`, `tutorials/`.
