import { test, expect } from "@playwright/test";

test.describe("Tam Quoc Sat - Lobby & Game", () => {
  test("should create a room and join it", async ({ page }) => {
    // Log console messages and errors for debugging
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log(
        "REQUEST FAILED:",
        request.url(),
        request.failure()?.errorText,
      ),
    );

    // 1. Navigate to the frontend, forcing it to use the local test backend (which proxies to 8000)
    await page.goto("/?backend=" + encodeURIComponent("http://localhost:8081"));

    // 2. Verify Lobby is visible
    const lobbyUI = page.locator("#lobby-ui");
    await expect(lobbyUI).toBeVisible({ timeout: 30000 });

    // 3. Change Player Name
    const nameInput = page.locator("#lobby-player-name");
    await nameInput.fill("TestPlayer1");

    // 4. Click Create Room
    await page.locator("#btn-create-room").click();

    // 5. Fill out Create Room Modal
    const createModal = page.locator("#modal-create");
    await expect(createModal).toBeVisible();
    await page.locator("#input-room-name").fill("Phòng Test E2E");
    // Click confirm
    await page.locator("#btn-confirm-create").click();

    // Wait for the room to be created and modal to close
    await expect(createModal).toBeHidden();

    // Auto-join happens automatically upon creation
    // 6. The Lobby UI should hide, and the canvas should appear (the game started)
    await expect(lobbyUI).toBeHidden();

    // Verify PixiJS canvas is present
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Wait for a second to ensure no immediate crash on game start
    await page.waitForTimeout(2000);
  });
});
