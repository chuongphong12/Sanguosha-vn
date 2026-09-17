# Sanguosha VN (Tam Quốc Sát)

An open-source browser-based adaptation of the famous card board game **Sanguosha (Tam Quốc Sát)**. This project is built with modern web technologies (TypeScript, PixiJS, Boardgame.io), providing a smooth experience, real-time multiplayer synchronization, and a robust engine handling the complex rules and card interactions of the original game.

## 🌟 Key Features

- **Accurate Game Engine:** The ruleset is modeled precisely after the standard 2013 game standard, handling all complex phases, turn flow, and trigger skills perfectly.
- **High-Performance Graphics:** Powered by PixiJS (WebGL) and Spine Animation, ensuring smooth rendering, optimized asset management, and vivid visual effects.
- **Real-Time Synchronization:** Utilizes Boardgame.io for comprehensive client-server state management, allowing players to easily create lobbies, join battles, and maintain consistent network state.
- **Scalable Skill System (EventBus):** The EventBus architecture decouples character skills and equipment effects. This allows for easily adding or modifying complex interactions without bloating the core game engine.
- **Strict Testing Coverage:** Backed by over 170+ automated tests (via Vitest) to guarantee consistency across edge cases, complex skill chaining, and phase resolutions.

## 🛠️ Tech Stack

- **Core Language:** [TypeScript](https://www.typescriptlang.org/)
- **Frontend Rendering:** [PixiJS v8](https://pixijs.com/) & [Spine](http://esotericsoftware.com/)
- **UI Components:** `@pixi/ui` & [Motion](https://motion.dev/)
- **Game State & Networking:** [Boardgame.io](https://boardgame.io/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Testing:** [Vitest](https://vitest.dev/) (Logic) & [Playwright](https://playwright.dev/) (E2E)

## 🚀 Setup & Installation

### 1. Prerequisites

- Node.js (v18+ recommended)
- A package manager like `npm`, `yarn`, or `pnpm`

### 2. Install Dependencies

Clone the repository and install the dependencies in the root directory:

```bash
npm install
```

### 3. Running Locally (Development)

You will need to start both the Frontend Client and the Backend Server for multiplayer functionality:

```bash
# Start Frontend Client (Vite will auto-open a local port)
npm run dev

# Start Backend Server (Boardgame.io server handling game state)
npm run serve
```

_Note: Running `npm run dev` triggers a pre-script (`npm run clean`) to automatically clean up old assets and prepare the environment._

### 4. Production Build

```bash
npm run build
```

## 🧪 Testing

The project includes an extensive suite of unit and integration tests for the Game Engine and Skills.

```bash
# Run the test suite once
npm run test

# Run tests in watch mode for active development
npm run test:watch
```

## 📂 Project Structure

- `src/game/` - Contains the core Game Engine: rules, `cardEngine.ts`, `setup.ts`, and the card catalog.
- `src/game/engine/` - The heart of the Event & Skill resolution system (EventBus, SkillRegistry).
- `src/app/` - The frontend client, handling UI, graphics (PixiJS), and the Lobby view.
- `server/` - The Boardgame.io multiplayer server configuration.
- `tests/` - Vitest test suites categorized by rules, skills, UI, and security.

## 📝 License

This project is built for educational and open-source sharing purposes. Graphical assets and original character designs are subject to the copyright of their respective owners (Yoka Games).
