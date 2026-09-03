# Architecture — Tam Quốc Sát (Standard 2013)

> Auto-generated from GitNexus knowledge graph (675 symbols, 2444 relationships, 55 execution flows).

## Overview

Tam Quốc Sát is a web-based card game implementing the **Standard 2013** ruleset of the Chinese card game "Sanguosha" (三国杀). It is built with **PixiJS v8** for rendering, **boardgame.io** for game state management, and **TypeScript** throughout.

The codebase follows a strict **authoritative-server** pattern: all game logic runs server-side via boardgame.io moves marked `client: false`. The client receives a filtered `playerView` that hides hidden information (opponent hands, deck, effect stacks).

### Key Numbers

| Metric | Value |
|--------|-------|
| Source files | 69 |
| Symbols indexed | 675 |
| Execution flows | 55 |
| Physical cards | 108 |
| Card types | 32 |
| Generals | 27 |
| Skills | 43 |
| Test suites | 25 |
| Tests | 169 (all passing) |

---

## Directory Structure

```
src/
├── main.ts                          # Entry point
├── engine/                          # Generic game engine framework
│   ├── engine.ts                    # PixiJS app bootstrap
│   ├── navigation/                  # Screen/popup navigation stack
│   │   ├── navigation.ts
│   │   └── NavigationPlugin.ts
│   ├── audio/                       # BGM + SFX management
│   ├── resize/                      # Viewport resize handling
│   └── utils/                       # Storage helpers (localStorage)
├── app/                             # Application layer
│   ├── getEngine.ts                 # Engine singleton
│   ├── screens/
│   │   ├── LoadScreen.ts            # Asset loading screen
│   │   └── main/
│   │       └── MainScreen.ts        # THE main game UI (2177 lines)
│   ├── popups/
│   │   └── SettingsPopup.ts         # Volume settings
│   ├── ui/                          # Reusable UI components
│   │   ├── Button.ts
│   │   ├── Label.ts
│   │   ├── RoundedBox.ts
│   │   ├── VolumeSlider.ts
│   │   ├── equipmentView.ts         # Equipment slot rendering
│   │   ├── layout.ts                # Layout utilities
│   │   ├── textLayout.ts
│   │   └── typography.ts
│   └── utils/
│       └── userSettings.ts          # Volume preferences
├── client/
│   └── LocalMatch.ts                # boardgame.io local match wrapper
└── game/                            # Core game logic (THE important part)
    ├── model.ts                     # All TypeScript types/interfaces
    ├── cardEngine.ts                # Game engine (~4092 lines, the heart)
    ├── rules.ts                     # Pure rule functions
    ├── setup.ts                     # Game initialization
    ├── player-view.ts               # Hidden information filtering
    ├── TqsGame.ts                   # boardgame.io game definition
    └── catalog/                     # Static data
        ├── cards.ts                 # 108 card definitions
        ├── generals.ts              # 27 generals + 43 skills
        └── roles.ts                 # Role distribution
```

---

## Functional Areas (GitNexus Clusters)

| Cluster | Symbols | Cohesion | Description |
|---------|---------|----------|-------------|
| **Game** | 109 | 63% | Core game engine: card effects, damage, skills, prompts |
| **Main** | 42 | 83% | Main game screen UI rendering |
| **Navigation** | 20 | 90% | Screen/popup stack management |
| **Popups** | 13 | 83% | Settings popup, volume controls |
| **Rules** | 9 | 61% | Pure rule functions (distance, hand limit, drawing) |
| **Client** | 8 | 95% | boardgame.io match wrapper |
| **Ui** | 7 | 75% | Reusable UI components |
| **Set** | 6 | 63% | localStorage read/write helpers |

### Cluster Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│                    engine/                           │
│  (navigation, audio, resize, storage)               │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│   app/ui/        │   │  app/screens/    │
│   (Button, etc.) │◄──│  MainScreen.ts   │
└──────────────────┘   └────────┬─────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ client/  │ │  game/   │ │ catalog/ │
             │LocalMatch│ │cardEngine│ │cards,gen │
             └────┬─────┘ └────┬─────┘ └──────────┘
                  │            │
                  ▼            ▼
             ┌──────────────────────┐
             │    boardgame.io      │
             │  (state management)  │
             └──────────────────────┘
```

---

## Core Game Architecture

### The Effect Stack Model

The game uses a **stack-based effect resolution** model. All game events (card plays, skills, damage) push `GameEffect` objects onto `G.effectStack`. The central `resolveCardGame()` function processes effects FIFO until the stack is empty or a prompt halts resolution.

```
Player Action → declareCardUse() / useSkill()
    → compileCardUse() pushes effects to stack
    → resolveCardGame() processes stack
        → Each effect type has a resolve*() handler
        → Handlers may push MORE effects (nested resolution)
        → Handlers may set G.prompt to halt for player input
        → answerCardPrompt() resumes resolution
```

### Effect Types (28 total)

| Category | Effects |
|----------|---------|
| **Card Play** | `slash`, `duel`, `target-card`, `borrowed-sword`, `harvest-pick`, `recover`, `draw`, `place-delayed`, `resolve-delayed`, `ally-summon` |
| **Damage** | `damage`, `dying` |
| **Skills (triggered)** | `fan-kui`, `gang-lie`, `tu-xi`, `lian-ying`, `xiao-ji`, `luo-yi`, `yi-ji`, `fan-jian`, `jian-xiong`, `yao-wu`, `wang-zun`, `guan-xing`, `luo-shen`, `optional-skill` |
| **Utility** | `nullification`, `finish-use` |

### Prompt System

When the engine needs player input, it sets `G.prompt` with a `GamePrompt` object. The UI renders appropriate controls. The player responds via `answerCardPrompt()`.

| Prompt Kind | Purpose |
|-------------|---------|
| `card-response` | Play a card in response (Slash, Dodge, Peach, Nullification) |
| `option` | Yes/No or choice selection (skill activation) |
| `select-cards` | Pick cards from zones (hand, equipment, judgement) |
| `choose-players` | Select target players |
| `harvest-choice` | Pick from revealed Harvest cards |

---

## Key Execution Flows

### 1. Card Play Flow

```
MainScreen.drawActions()
  → user clicks card + target
  → LocalMatch.move("playCard", input)
  → TqsGame.moves.playCard
  → declareCardUse(G, playerID, input, shuffle)
      → validateTargets()
      → compileCardUse(G, use) → returns GameEffect[]
      → push effects to G.effectStack
      → resolveCardGame(G, shuffle)
          → case "nullification": resolveNullification()
          → case "slash": resolveSlash()
          → case "duel": resolveDuel()
          → case "damage": resolveDamage()
          → ... (28 effect types)
```

### 2. Damage Resolution Flow

```
resolveDamage(G, effect)
  → Reduce HP: target.hp -= effect.amount
  → Write log entry
  → Check death: if hp <= 0 → push dying effect
  → Trigger skills (in order):
      1. Jian Xiong (Cao Cao) — obtain damage card
      2. Yao Wu (Xu Chu) — red Slash: recover or draw
      3. Fan Kui (Sima Yi) — take 1 card from source
      4. Gang Lie (Xiahou Dun) — judgement + counter-damage
      5. Yi Ji (Guo Jia) — draw 2, give to players
      6. Xiao Ji (Sun Shangxiang) — draw 2 on equipment loss
```

### 3. Turn Flow

```
resolveTurnFlow(G, shuffle)
  → G.turn.step = "prepare"
      → Luo Shen (Zhen Ji) — optional black card keep
      → Luo Yi (Xu Chu) — optional Slash buff
  → G.turn.step = "judge"
      → Resolve judgement cards (Indulgence, Supply Shortage, Lightning)
  → G.turn.step = "draw"
      → performRegularDraw() — 2 cards (3 with Ying Zi)
      → Wang Zun (Yuan Shu) — optional lord penalty
  → G.turn.step = "play"
      → Player plays cards via declareCardUse()
  → G.turn.step = "discard"
      → Ke Ji (Lu Meng) — optional discard skip
      → Player discards to hand limit
  → G.turn.step = "end"
      → Bi Yue (Diao Chan) — optional end-phase draw
      → finishTurn() → advance to next player
```

### 4. Skill Activation Flow

```
MainScreen.drawActions()
  → user clicks skill button
  → LocalMatch.move("useSkill", skillID, payload)
  → TqsGame.moves.useSkill
  → useSkill(G, playerID, skillID, payload, shuffle)
      → Validate: isIdleForPlay, hasSkill, not used this turn
      → Skill-specific logic:
          zhi-heng: discard N, draw N
          ku-rou: lose 1 HP, draw 2
          qing-nang: give 1 card, heal target 1
          ren-de: give 1 card to another player
          jie-yin: give 2 cards, heal male 1
          li-jian: force 2 males to duel
          fan-jian: look at target hand, deal damage
      → markSkillUsed()
      → resolveCardGame()
```

### 5. Ally Summon Flow (Hu Jia / Ji Jiang)

```
Player targeted by Slash/Duel
  → prompt: "summonFaction" shown
  → Player chooses "summon"
  → ally-summon effect pushed
  → Queue: all alive allies of that faction
  → Each ally prompted in turn order
  → Ally plays card → completeAllyResponse()
  → If all pass → return to original target
```

---

## State Model

### TqsGameState (authoritative)

```
TqsGameState
├── status: "lord-selection" | "general-selection" | "playing" | "ended"
├── seatOrder: PlayerID[]           # Circular turn order
├── lordID: PlayerID
├── players: Record<PlayerID, PlayerState>
│   ├── hand: string[]              # Card IDs
│   ├── equipment: Partial<Record<EquipmentSlot, string>>
│   ├── judgement: string[]         # Delayed trick cards
│   ├── hp / maxHP / alive
│   ├── generalID / activeSkillIDs
│   └── slashUses / skillsUsedThisTurn
├── deck: string[]                  # Draw pile (card IDs)
├── discard: string[]               # Discard pile
├── processing: string[]            # Cards in transit
├── cards: Record<string, PhysicalCard>  # Card definitions
├── effectStack: GameEffect[]       # Active effects (FIFO)
├── prompt: GamePrompt | null       # Current player prompt
├── turn: TurnState                 # Current turn metadata
├── winner: GameWinner | null
└── log: GameLogEntry[]             # Game log (last 80)
```

### TqsPlayerViewState (filtered for client)

Same structure but with hidden information removed:
- Opponent hands → `"hidden"` strings
- Deck → `"hidden"` strings
- Effect stack → `[]`
- General/skills → hidden until revealed
- Guan Xing cards → hidden from non-responder

---

## Data Catalog

### Cards (108 physical cards)

| Type | Count | Examples |
|------|-------|---------|
| Basic | ~34 | Slash, Dodge, Peach |
| Trick | ~40 | Snatch, Dismantle, Indulgence, Supply Shortage, Harvest, etc. |
| Equipment | ~34 | Weapons (range 2-5), Armor, Mounts |

### Generals (27)

| Faction | Generals |
|---------|----------|
| Wei (魏) | Cao Cao, Sima Yi, Xu Chu, Guo Jia, Zhen Ji, Li Yan, Xiahou Dun |
| Shu (蜀) | Liu Bei, Guan Yu, Zhang Fei, Zhuge Liang, Ma Chao, Huang Yueying, Hua Tuo |
| Wu (吴) | Sun Quan, Zhou Yu, Lu Xun, Lu Meng, Da Qiao, Xiao Qiao, Sun Shangxiang |
| Qun (群) | Lv Bu, Diao Chan, Hua Tuo, Yuan Shu, Yan Liang & Wen Chou |

### Skills (43)

All 43 skills are implemented with full rule conformance. Key categories:

| Type | Skills |
|------|--------|
| **Conversion** | Wu Sheng (red→Slash), Qi Xi (black→Snatch), Guo Se (diamond→Indulgence), Ji Jiu (red→Peach), Long Dan (Slash↔Dodge) |
| **Damage trigger** | Jian Xiong, Fan Kui, Gang Lie, Yi Ji, Yao Wu |
| **Draw trigger** | Ying Zi, Ji Zhi, Lian Ying, Xiao Ji |
| **Turn trigger** | Ke Ji, Bi Yue, Luo Shen, Luo Yi, Tu Xi |
| **Active** | Zhi Heng, Ku Rou, Qing Nang, Ren De, Jie Yin, Li Jian, Fan Jian, Guan Xing |
| **Passive** | Wang Zun, Tie Ji, Qing Guo, Liu Li |
| **Lord** | Ren De, Ji Jiang, Hu Jia, Wang Zun |

---

## Rendering Pipeline

```
MainScreen (PixiJS Container)
├── drawBackground()        # Table texture + decorative circles
├── drawTitle()             # "TAM QUỐC SÁT" header
├── drawViewerSelector()    # P1-P4 player toggle buttons
├── drawStatus()            # Turn/phase/status bar
├── drawSeats()             # Player panels (2-column grid)
│   ├── Player info (general, role, HP)
│   ├── Equipment slots (weapon, armor, mounts)
│   └── Judgement cards
├── drawLog()               # Last 4 game log entries
└── drawPrivateArea()       # Bottom panel
    ├── drawHand()          # Paginated hand cards (6/page)
    ├── drawActions()       # Context-sensitive action buttons
    │   ├── Play phase: card selection + skill bar
    │   ├── Discard phase: multi-select for discard
    │   └── Prompt response: play/pass buttons
    ├── drawZoneSelection() # Equipment/judgement selection
    ├── drawHarvestSelection() # Harvest card picker
    └── drawChoosePlayers() # Player target picker
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Rendering | PixiJS v8 (Canvas/WebGL) |
| Game State | boardgame.io 0.50.2 (authoritative server) |
| Build | Vite + TypeScript |
| Testing | Vitest |
| Assets | AssetPack (texture atlas) |
| Language | TypeScript (strict) |

---

## Testing Architecture

| Suite | Tests | Coverage |
|-------|-------|----------|
| `skill-conformance.test.ts` | 10 | Official rule wording compliance |
| `skill-batch1-9.test.ts` | 97 | All 43 skills by category |
| `cards.test.ts` | 13 | Card play mechanics |
| `core-rules.test.ts` | 8 | Distance, hand limit, discard |
| `equipment-effects.test.ts` | 10 | Equipment interactions |
| `trick-effects.test.ts` | 8 | Trick card effects |
| `card-input.test.ts` | 6 | Input validation/security |
| `player-view.test.ts` | 3 | Hidden information filtering |
| `equipment-view.test.ts` | 1 | UI equipment rendering |
| `ui/` | 5 | Button, layout, typography |

---

## Current State (August 2026)

- All 169 tests passing
- TypeScript clean (`tsc --noEmit` passes)
- Production build passes
- 43/43 skills implemented
- Local hot-seat multiplayer functional
- Online multiplayer: scaffold only (localhost, in-memory)
- **Completed**: Equipment-zone skill expansion (Wu Sheng, Qi Xi, Guo Se, Ji Jiu, Liu Li now usable from hand OR equipment; see `HANDOFF.md`)
- **Still pending**: full rule-conformance matrix for all 43 skills
