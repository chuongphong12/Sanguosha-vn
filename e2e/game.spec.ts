import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  clickText,
  createRoom,
  expectNoText,
  joinRoom,
  trackErrors,
  visibleTexts,
  waitForStatus,
  waitForText,
} from "./support/pixi";

const VIEWPORT = { width: 1280, height: 720 };

interface Snapshot {
  status: string;
  lordID: string;
  viewerID: string;
  activePlayerID: string;
  step: string;
  prompt: boolean;
  hand: number;
  hp: number;
  seatOrder: string[];
  generalID: string | null;
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const match = (
      window as unknown as {
        __TQS_MATCH__: {
          currentViewerID: string;
          state: { G: any };
        };
      }
    ).__TQS_MATCH__;
    const G = match.state.G;
    const me = G.players[match.currentViewerID];
    return {
      status: G.status,
      lordID: G.lordID,
      viewerID: match.currentViewerID,
      activePlayerID: G.turn.activePlayerID,
      step: G.turn.step,
      prompt: Boolean(G.prompt),
      hand: me.hand.length,
      hp: me.hp,
      seatOrder: G.seatOrder,
      generalID: me.generalID,
    };
  });
}

/**
 * Some randomly dealt generals open the turn with an optional-skill prompt
 * (e.g. Wang Zun). Decline it so the scenario does not depend on the deal.
 */
async function declineStartOfTurnPrompt(page: Page): Promise<void> {
  const needsResponse = await page.evaluate(() => {
    const match = (window as any).__TQS_MATCH__;
    return match.state.G.prompt?.responderID === match.currentViewerID;
  });
  if (needsResponse) await clickText(page, /^(Không dùng|Bỏ qua)/);
}

async function pickFirstGeneral(page: Page): Promise<void> {
  await waitForText(page, "CHỌN TƯỚNG NÀY");
  await clickText(page, "CHỌN TƯỚNG NÀY");
  await expect
    .poll(async () => (await snapshot(page)).generalID, {
      message: "general selection should be accepted",
    })
    .not.toBeNull();
}

test.describe("Full remote game flow", () => {
  test("4 players go from waiting room to the second turn using only the UI", async ({
    browser,
  }) => {
    test.setTimeout(180000);
    const hostContext = await browser.newContext({ viewport: VIEWPORT });
    const host = await hostContext.newPage();
    const errors = [trackErrors(host)];

    // Waiting room -> start
    const matchID = await createRoom(host, "Host");
    const pages: Page[] = [host];
    for (let i = 1; i <= 3; i += 1) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      errors.push(trackErrors(page));
      await joinRoom(page, matchID);
      pages.push(page);
      await host.waitForTimeout(800);
    }
    await waitForText(host, /NGƯỜI CHƠI \(4\/8\)/, 10000);
    await clickText(host, "Bắt Đầu Ngay");

    // Lord selection: only the lord gets the picker.
    for (const page of pages) await waitForStatus(page, "lord-selection");
    const { lordID } = await snapshot(host);
    const lordPage = pages[Number(lordID)];
    for (const page of pages) {
      if (page !== lordPage) {
        await waitForText(page, /chọn Võ Tướng/);
        await expectNoText(page, "CHỌN TƯỚNG NÀY", 1500);
      }
    }
    await pickFirstGeneral(lordPage);

    // General selection: everyone else picks in parallel.
    for (const page of pages) await waitForStatus(page, "general-selection");
    for (const page of pages) {
      if (page !== lordPage) await pickFirstGeneral(page);
    }

    // Battle
    for (const page of pages) await waitForStatus(page, "playing");
    for (const page of pages) {
      const privacy = await page.evaluate(() => {
        const match = (window as any).__TQS_MATCH__;
        const G = match.state.G;
        const opponents = Object.values(G.players).filter(
          (player: any) => player.id !== match.currentViewerID,
        ) as any[];
        return {
          hiddenHands: opponents.every((player) =>
            player.hand.every((card: string) => card === "hidden"),
          ),
          hiddenRoles: opponents.every(
            (player) => player.roleRevealed || player.role === null,
          ),
          hasDeck: Object.hasOwn(G, "deck"),
          effectStack: G.effectStack,
        };
      });
      expect(privacy).toEqual({
        hiddenHands: true,
        hiddenRoles: true,
        hasDeck: false,
        effectStack: [],
      });
    }
    await expect
      .poll(
        async () => {
          for (const page of pages) await declineStartOfTurnPrompt(page);
          const s = await snapshot(lordPage);
          return s.activePlayerID === lordID && s.step === "play" && !s.prompt;
        },
        { timeout: 30000 },
      )
      .toBe(true);

    const beforeReload = await snapshot(lordPage);
    const handBeforeReload = await lordPage.evaluate(() => {
      const match = (window as any).__TQS_MATCH__;
      return match.state.G.players[match.currentViewerID].hand;
    });
    await lordPage.reload();
    // Reload rebuilds the Pixi renderer and reloads assets for this client.
    await waitForStatus(lordPage, "playing", 45000);
    const afterReload = await snapshot(lordPage);
    expect(afterReload.viewerID).toBe(beforeReload.viewerID);
    expect(afterReload.hand).toBe(beforeReload.hand);
    expect(
      await lordPage.evaluate(() => {
        const match = (window as any).__TQS_MATCH__;
        return match.state.G.players[match.currentViewerID].hand;
      }),
    ).toEqual(handBeforeReload);
    expect(afterReload.seatOrder).toEqual(beforeReload.seatOrder);

    // HUD, hand and log drawer are drawn
    await waitForText(lordPage, /Lượt 1 · Giai Đoạn Xuất Bài/);
    await waitForText(lordPage, "DIỄN BIẾN");
    const cards = (await visibleTexts(lordPage)).filter((t) =>
      /^【.+】/.test(t.text),
    );
    expect(cards.length, "hand cards render with their names").toBeGreaterThan(
      0,
    );
    // Escaped-template regression: raw placeholders must never reach the screen.
    for (const t of await visibleTexts(lordPage)) {
      expect(t.text).not.toContain("${");
    }

    // The log drawer collapses and re-opens.
    await clickText(lordPage, "✕");
    await expectNoText(lordPage, "DIỄN BIẾN");
    await clickText(lordPage, "Diễn biến");
    await waitForText(lordPage, "DIỄN BIẾN");

    // Finish the play phase from the button, then discard if the rules require it.
    await clickText(lordPage, "Kết thúc Xuất Bài");
    await expect
      .poll(
        async () => {
          const s = await snapshot(lordPage);
          return s.step === "discard" || s.activePlayerID !== lordID;
        },
        { timeout: 15000 },
      )
      .toBe(true);

    const state = await snapshot(lordPage);
    if (state.activePlayerID === lordID && state.step === "discard") {
      const discardLabel = await waitForText(lordPage, /Cần bỏ:/);
      const required = Number(discardLabel.text.match(/Cần bỏ:\s*(\d+)/)![1]);
      for (let i = 0; i < required; i += 1) {
        const hand = (await visibleTexts(lordPage)).filter(
          (t) => /^【.+】/.test(t.text) && t.y > VIEWPORT.height - 260,
        );
        await lordPage.mouse.click(
          hand[i].x + hand[i].width / 2,
          hand[i].y + hand[i].height / 2,
        );
        await expect
          .poll(async () =>
            (await visibleTexts(lordPage)).some((t) =>
              t.text.includes(`Đã chọn: ${i + 1} lá`),
            ),
          )
          .toBe(true);
      }
      await clickText(lordPage, "Xác nhận bỏ bài");
    }

    // The next living player takes their turn.
    await expect
      .poll(async () => (await snapshot(lordPage)).activePlayerID, {
        timeout: 20000,
      })
      .not.toBe(lordID);
    // The status line may show a skill prompt instead; the deck line is always there.
    await waitForText(lordPage, /Chồng Bài Rút: \d+/);
    expect(errors.flat()).toEqual([]);

    await Promise.all(pages.map((page) => page.context().close()));
  });
});
