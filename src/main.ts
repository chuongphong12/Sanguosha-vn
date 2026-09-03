import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { MainScreen } from "./app/screens/main/MainScreen";
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
  // Show the main screen once the load screen is dismissed
  await engine.navigation.showScreen(MainScreen);
})();
