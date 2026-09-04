import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { MainScreen } from "./app/screens/main/MainScreen";
import { LobbyUI } from "./app/ui/LobbyUI";
import { loadGameFonts } from "./app/ui/typography";
import { userSettings } from "./app/utils/userSettings";
import { CreationEngine } from "./engine/engine";

/**
 * Importing these modules will automatically register there plugins with the engine.
 */
import "@pixi/sound";
// import "@esotericsoftware/spine-pixi-v8";

// Create a new creation engine instance
const engine = new CreationEngine();
setEngine(engine);

(async () => {
  // Pixi rasterizes text to canvas, so wait for Vietnamese glyphs first.
  await loadGameFonts();

  // Initialize the creation engine instance
  await engine.init({
    background: "#120F0D",
    resizeOptions: { minWidth: 768, minHeight: 820, letterbox: false },
  });

  // Initialize the user settings
  userSettings.init();

  // Show the load screen
  await engine.navigation.showScreen(LoadScreen);

  const urlParams = new URLSearchParams(window.location.search);
  const inviteMatchID = urlParams.get("matchID");

  const launchMainScreen = () => engine.navigation.showScreen(MainScreen);

  const credentials = urlParams.get("credentials");

  if (inviteMatchID && !credentials) {
    // If the room has password, user might fail, but let's just let LobbyUI handle join flow
    LobbyUI.joinMatchProcess(
      inviteMatchID,
      null,
      (
        matchID: string,
        playerID: string,
        newCredentials?: string,
        serverUrl?: string,
      ) => {
        // Modify URL to pass state to MainScreen (in memory or query string)
        window.history.replaceState(
          {},
          "",
          `/?mode=remote&matchID=${matchID}&playerID=${playerID}&credentials=${newCredentials}&serverUrl=${serverUrl}`,
        );
        launchMainScreen();
      },
    );
  } else if (inviteMatchID && credentials) {
    launchMainScreen();
  } else {
    LobbyUI.show(
      (
        matchID: string,
        playerID: string,
        credentials?: string,
        serverUrl?: string,
      ) => {
        window.history.pushState(
          {},
          "",
          `/?mode=remote&matchID=${matchID}&playerID=${playerID}&credentials=${credentials}&serverUrl=${serverUrl}`,
        );
        launchMainScreen();
      },
      (numPlayers: number) => {
        window.history.pushState(
          {},
          "",
          `/?mode=local&numPlayers=${numPlayers}`,
        );
        launchMainScreen();
      },
    );
  }
})();
