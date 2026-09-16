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

  const stateCredentials = window.history.state?.credentials;
  const credentials = urlParams.get("credentials") || stateCredentials; // Fallback to URL in case of old links, but prefer state

  const showLobby = () => {
    LobbyUI.show(
      (
        matchID: string,
        playerID: string,
        newCredentials?: string,
        serverUrl?: string,
      ) => {
        window.history.pushState(
          { mode: "remote", playerID, credentials: newCredentials, serverUrl },
          "",
          `/?matchID=${matchID}`,
        );
        launchMainScreen();
      },
      (numPlayers: number) => {
        window.history.pushState(
          { mode: "local", numPlayers },
          "",
          `/?mode=local&numPlayers=${numPlayers}`,
        );
        launchMainScreen();
      },
    );
  };

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
        // Pass sensitive info in state, keep only matchID in URL
        window.history.replaceState(
          { mode: "remote", playerID, credentials: newCredentials, serverUrl },
          "",
          `/?matchID=${matchID}`,
        );
        launchMainScreen();
      },
    ).then((success) => {
      if (!success) {
        // If joining failed (e.g. invalid password, room not found), reset URL and show normal lobby
        window.history.replaceState({}, "", "/");
        showLobby();
      }
    });
  } else if (inviteMatchID && credentials) {
    // Note: If credentials are in URL from old link, we keep them, or we could replace state here.
    // For now, if we have them, just launch.
    if (urlParams.has("credentials")) {
      window.history.replaceState(
        { 
          mode: "remote", 
          playerID: urlParams.get("playerID"), 
          credentials: urlParams.get("credentials"), 
          serverUrl: urlParams.get("serverUrl") 
        },
        "",
        `/?matchID=${inviteMatchID}`,
      );
    }
    launchMainScreen();
  } else {
    showLobby();
  }
})();
