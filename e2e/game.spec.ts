import { test, expect } from "@playwright/test";

test.describe("Gameplay Loop", () => {
  test("should start a 4-player game and play turns", async ({ browser }) => {
    // Set fixed viewport so we know exact coordinates
    const viewport = { width: 1280, height: 720 };
    const ctx1 = await browser.newContext({ viewport });
    const ctx2 = await browser.newContext({ viewport });
    const ctx3 = await browser.newContext({ viewport });
    const ctx4 = await browser.newContext({ viewport });

    const page1 = await ctx1.newPage();

    // 1. Host creates room
    await page1.goto(
      "/?backend=" + encodeURIComponent("http://localhost:8000"),
    );
    await page1.locator("#lobby-player-name").fill("Player0");
    await page1.locator("#btn-create-room").click();
    await page1.locator("#input-room-name").fill("Phòng Test Gameplay");
    await page1.locator("#create-num-players").selectOption("4");
    await page1.locator("#btn-confirm-create").click();

    await expect(page1.locator("#lobby-ui")).toBeHidden({ timeout: 15000 });

    const url = new URL(page1.url());
    const matchID = url.searchParams.get("matchID");
    expect(matchID).toBeTruthy();

    const backendParam = encodeURIComponent("http://localhost:8000");
    const joinUrl = `/?matchID=${matchID}&backend=${backendParam}`;

    await page1.waitForTimeout(1000);

    // Host clicks "Số Người Chơi" button to change from 10 to 4.
    await page1.locator("canvas").click({ position: { x: 890, y: 190 } });
    await page1.waitForTimeout(500);

    // Join other 3 players
    const pages = [
      await ctx2.newPage(),
      await ctx3.newPage(),
      await ctx4.newPage(),
    ];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await p.goto(joinUrl);
      // Ensure they enter the game
      await expect(p.locator("#lobby-ui")).toBeHidden({ timeout: 15000 });
      await p.waitForFunction(
        () => (window as any).__TQS_MATCH__ !== undefined,
        null,
        { timeout: 10000 },
      );
      const viewerID = await p.evaluate(
        () => (window as any).__TQS_MATCH__.currentViewerID,
      );
      console.log(`Page ${i + 1} successfully joined as Player ${viewerID}`);
      // Add a delay so they don't all hit the backend simultaneously and get 403 on the same empty seat
      await page1.waitForTimeout(1500);
    }

    // Since we are 4 players, host (page1) can now start the game!
    await page1.evaluate(() => {
      (window as any).__TQS_MATCH__.move("startGame", {
        autoSkipWuxie: true,
      });
    });

    // 1. Lord Selection Phase
    await page1.waitForFunction(
      () => {
        const match = (window as any).__TQS_MATCH__;
        return match?.state?.G?.status === "lord-selection";
      },
      null,
      { timeout: 10000 },
    );

    console.log("Lord selecting general...");
    const allPages = [page1, ...pages];
    for (let i = 0; i < allPages.length; i++) {
      const p = allPages[i];
      await p.evaluate(() => {
        const interval = setInterval(() => {
          const match = (window as any).__TQS_MATCH__;
          if (!match || !match.state || !match.state.G) return;
          if (match.state.G.status !== "lord-selection") {
            return;
          }
          if (match.state.G.lordID === match.currentViewerID) {
            if (!(window as any).__selectedLordGen) {
              const cands =
                match.state.G.players[match.currentViewerID].generalCandidates;
              console.log("I am Lord! My candidates are:", cands);
              if (cands && cands.length > 0) {
                match.move("selectGeneral", cands[0]);
                (window as any).__selectedLordGen = true;
              }
            } else {
              const now = Date.now();
              if (now - ((window as any).__lastLordSend || 0) > 2000) {
                const cands =
                  match.state.G.players[match.currentViewerID]
                    .generalCandidates;
                match.move("selectGeneral", cands[0]);
                (window as any).__lastLordSend = now;
              }
            }
          }
        }, 500);
      });
      p.on("console", (msg) => console.log(`Page ${i} says: ${msg.text()}`));
    }

    // 2. General Selection Phase (Others)
    await page1.waitForFunction(
      () => {
        const match = (window as any).__TQS_MATCH__;
        return match?.state?.G?.status === "general-selection";
      },
      null,
      { timeout: 15000 },
    );

    console.log("Others selecting generals...");
    for (let i = 0; i < allPages.length; i++) {
      const p = allPages[i];
      await p.evaluate(() => {
        const interval = setInterval(() => {
          const match = (window as any).__TQS_MATCH__;
          if (!match || !match.state || !match.state.G) return;
          if (match.state.G.status !== "general-selection") {
            return;
          }
          if (match.state.G.lordID !== match.currentViewerID) {
            // Check if we already have a generalID (some setups might set it immediately for self)
            // Or just rely on a flag to avoid spamming 100 requests, but spamming every 500ms is fine until phase ends
            if (!(window as any).__selectedGen) {
              const cands =
                match.state.G.players[match.currentViewerID].generalCandidates;
              console.log("I am other! My candidates are:", cands);
              if (cands && cands.length > 0) {
                match.move("selectGeneral", cands[0]);
                (window as any).__selectedGen = true;
              }
            } else {
              // We sent the move. If it was rejected due to stateID, we might need to resend.
              // For robustness in this test, we can resend every 2 seconds if still in this phase.
              const now = Date.now();
              if (now - ((window as any).__lastSend || 0) > 2000) {
                const cands =
                  match.state.G.players[match.currentViewerID]
                    .generalCandidates;
                match.move("selectGeneral", cands[0]);
                (window as any).__lastSend = now;
              }
            }
          }
        }, 500);
      });
    }

    // 3. Gameplay loop begins!
    console.log("Game started. Wait for someone's play phase...");

    // We don't know who goes first (the lord goes first, but lord might not be '0')
    const lordID = await page1.evaluate(() => {
      return (window as any).__TQS_MATCH__.state.G.lordID;
    });

    await page1.waitForFunction(
      (lID) => {
        const match = (window as any).__TQS_MATCH__;
        const state = match.state;
        const result =
          state.G?.status === "playing" &&
          state.G?.turn?.activePlayerID === lID &&
          state.G?.turn?.step === "play" &&
          !state.G?.prompt;
        if (!result) {
          console.log(
            `Waiting for play phase... status=${state.G?.status} active=${state.G?.turn?.activePlayerID} step=${state.G?.turn?.step} prompt=${state.G?.prompt?.type} effects=${state.G?.effectStack?.length > 0 ? state.G?.effectStack[0].kind : "none"}`,
          );
        }
        return result;
      },
      lordID,
      { timeout: 30000 },
    );

    console.log(`Player ${lordID} ending play phase...`);
    // Find the page for lordID
    const lordPage = allPages[parseInt(lordID)];
    await lordPage.evaluate(() => {
      (window as any).__TQS_MATCH__.move("endPlayPhase");
    });

    // 4. Discard Phase (may be skipped automatically if hand size <= hp)
    // We will just wait for either discard phase or the next player's turn
    await lordPage.waitForFunction(
      (lID) => {
        const match = (window as any).__TQS_MATCH__;
        const state = match.state;
        const seatOrder = state.G.seatOrder;
        const currentIdx = seatOrder.indexOf(lID);
        const nextID = seatOrder[(currentIdx + 1) % seatOrder.length];

        const isDiscard =
          state.G?.status === "playing" &&
          state.G?.turn?.activePlayerID === lID &&
          state.G?.turn?.step === "discard" &&
          !state.G?.prompt;
        const isNextTurn =
          state.G?.status === "playing" &&
          state.G?.turn?.activePlayerID === nextID;
        return isDiscard || isNextTurn;
      },
      lordID,
      { timeout: 15000 },
    );

    const isDiscardNow = await lordPage.evaluate((lID) => {
      const match = (window as any).__TQS_MATCH__;
      return (
        match.state.G?.turn?.activePlayerID === lID &&
        match.state.G?.turn?.step === "discard"
      );
    }, lordID);

    if (isDiscardNow) {
      console.log(`Player ${lordID} in discard phase. Discarding cards...`);
      await lordPage.evaluate(() => {
        const match = (window as any).__TQS_MATCH__;
        const player = match.state.G.players[match.currentViewerID];
        // At start of game, hand limit is hp
        const handLimit = player.hp;
        const toDiscard = Math.max(0, player.hand.length - handLimit);
        const cardsToDiscard = player.hand.slice(0, toDiscard);
        match.move("discardCards", cardsToDiscard);
      });
    } else {
      console.log(`Player ${lordID} automatically skipped discard phase.`);
    }

    const nextPlayerID = await lordPage.evaluate((lID) => {
      const match = (window as any).__TQS_MATCH__;
      const seatOrder = match.state.G.seatOrder;
      const currentIdx = seatOrder.indexOf(lID);
      return seatOrder[(currentIdx + 1) % seatOrder.length];
    }, lordID);

    // 5. Next player's turn starts
    await lordPage.waitForFunction(
      (nextID) => {
        const match = (window as any).__TQS_MATCH__;
        const state = match.state;
        return (
          state.G?.status === "playing" &&
          state.G?.turn?.activePlayerID === nextID
        );
      },
      nextPlayerID,
      { timeout: 15000 },
    );

    console.log(
      `Player ${nextPlayerID}'s turn reached successfully! Gameplay loop is functioning.`,
    );
  });
});
