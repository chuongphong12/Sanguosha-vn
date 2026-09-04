# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lobby.spec.ts >> Tam Quoc Sat - Lobby & Game >> should create a room and join it
- Location: e2e\lobby.spec.ts:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#lobby-ui')
Expected: visible
Received: undefined

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#lobby-ui')
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Tam Quoc Sat - Lobby & Game', () => {
  4  |   test('should create a room and join it', async ({ page }) => {
  5  |     // Log console messages and errors for debugging
  6  |     page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  7  |     page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  8  |     page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  9  | 
  10 |     // 1. Navigate to the frontend, forcing it to use the local test backend (which proxies to 8000)
  11 |     await page.goto('/?backend=' + encodeURIComponent('http://localhost:8081'));
  12 | 
  13 |     // 2. Verify Lobby is visible
  14 |     const lobbyUI = page.locator('#lobby-ui');
> 15 |     await expect(lobbyUI).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
  16 | 
  17 |     // 3. Change Player Name
  18 |     const nameInput = page.locator('#lobby-player-name');
  19 |     await nameInput.fill('TestPlayer1');
  20 | 
  21 |     // 4. Click Create Room
  22 |     await page.locator('#btn-create-room').click();
  23 | 
  24 |     // 5. Fill out Create Room Modal
  25 |     const createModal = page.locator('#modal-create');
  26 |     await expect(createModal).toBeVisible();
  27 |     await page.locator('#input-room-name').fill('Phòng Test E2E');
  28 |     // Click confirm
  29 |     await page.locator('#btn-confirm-create').click();
  30 | 
  31 |     // Wait for the room to be created and modal to close
  32 |     await expect(createModal).toBeHidden();
  33 | 
  34 |     // Auto-join happens automatically upon creation
  35 |     // 6. The Lobby UI should hide, and the canvas should appear (the game started)
  36 |     await expect(lobbyUI).toBeHidden();
  37 |     
  38 |     // Verify PixiJS canvas is present
  39 |     const canvas = page.locator('canvas');
  40 |     await expect(canvas).toBeVisible();
  41 | 
  42 |     // Wait for a second to ensure no immediate crash on game start
  43 |     await page.waitForTimeout(2000);
  44 |   });
  45 | });
  46 | 
```