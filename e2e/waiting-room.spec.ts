import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  clickText,
  createRoom,
  expectNoText,
  joinRoom,
  matchStatus,
  trackErrors,
  visibleTexts,
  waitForStatus,
  waitForText,
} from "./support/pixi";

const VIEWPORT = { width: 1280, height: 720 };

async function seatCount(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __TQS_MATCH__?: { state?: { G?: { seatOrder?: string[] } } };
        }
      ).__TQS_MATCH__?.state?.G?.seatOrder?.length ?? null,
  );
}

test.describe("Waiting room", () => {
  test("reload reconnects to the same seat without duplicating the player", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const matchID = await createRoom(page, "Reconnect");
    await waitForText(page, /NGƯỜI CHƠI \(1\/8\)/);
    const before = await page.evaluate(
      () => (window as any).__TQS_MATCH__.currentViewerID,
    );
    await page.reload();
    await waitForStatus(page, "waiting-room", 45000);
    await waitForText(page, /NGƯỜI CHƠI \(1\/8\)/);
    expect(new URL(page.url()).searchParams.get("matchID")).toBe(matchID);
    expect(
      await page.evaluate(() => (window as any).__TQS_MATCH__.currentViewerID),
    ).toBe(before);
    expect(errors).toEqual([]);
  });
  test("shows the waiting room after creating a room (regression: black screen)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    const errors = trackErrors(page);

    await createRoom(page, "Chủ Phòng");

    // Before the fix the Button asset alias crashed MainScreen and left an empty canvas.
    await waitForText(page, "SẢNH CHỜ");
    await waitForText(page, /NGƯỜI CHƠI \(1\/8\)/);
    await waitForText(page, /Chủ Phòng.*\(Chủ phòng\)/);
    await waitForText(page, "Bắt Đầu Ngay");
    await waitForStatus(page, "waiting-room");

    // The "connecting" placeholder must go away once state arrives.
    await expectNoText(page, "Đang kết nối");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("keeps every waiting-room control inside the visible canvas", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    await createRoom(page, "Bố Cục");
    await waitForText(page, "Bắt Đầu Ngay");

    const texts = await visibleTexts(page);
    expect(texts.length).toBeGreaterThan(5);
    for (const t of texts) {
      expect(t.x, `${t.text} left edge`).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width, `${t.text} right edge`).toBeLessThanOrEqual(
        VIEWPORT.width,
      );
      expect(t.y + t.height, `${t.text} bottom edge`).toBeLessThanOrEqual(
        VIEWPORT.height,
      );
    }
    await context.close();
  });

  test("host cannot start with fewer than 4 players; guests never see settings", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({ viewport: VIEWPORT });
    const host = await hostContext.newPage();
    const matchID = await createRoom(host, "Host");
    await waitForText(host, "Bắt Đầu Ngay");

    // Clicking the (disabled) button must not start a game.
    await clickText(host, "Bắt Đầu Ngay");
    await host.waitForTimeout(800);
    expect(await matchStatus(host)).toBe("waiting-room");

    const guestContext = await browser.newContext({ viewport: VIEWPORT });
    const guest = await guestContext.newPage();
    await joinRoom(guest, matchID);
    await waitForText(guest, "Chủ phòng đang thiết lập");
    await expectNoText(guest, "Bắt Đầu Ngay");

    // The lobby poll refreshes the host's list with the new member.
    await waitForText(host, /NGƯỜI CHƠI \(2\/8\)/, 10000);
    await hostContext.close();
    await guestContext.close();
  });

  test("host starts a game from the waiting room with exactly the joined players", async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const hostContext = await browser.newContext({ viewport: VIEWPORT });
    const host = await hostContext.newPage();
    const errors = trackErrors(host);
    const matchID = await createRoom(host, "Host");
    await waitForText(host, "Bắt Đầu Ngay");

    const guests: Page[] = [];
    const guestErrors: string[][] = [];
    for (let i = 1; i <= 4; i += 1) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      guestErrors.push(trackErrors(page));
      await joinRoom(page, matchID);
      guests.push(page);
      // Sequential joins avoid two clients racing for the same empty seat.
      await host.waitForTimeout(800);
    }
    await waitForText(host, /NGƯỜI CHƠI \(5\/8\)/, 10000);

    // Cap the room at 4 seats: 8 -> 10 -> 4.
    await clickText(host, /Số Người Chơi: 8/);
    await clickText(host, /Số Người Chơi: 10/);
    await waitForText(host, /Số Người Chơi: 4/);
    await waitForText(host, /NGƯỜI CHƠI \(5\/4\)/);

    await clickText(host, "Bắt Đầu Ngay");
    await waitForStatus(host, "lord-selection");
    expect(await seatCount(host)).toBe(4);
    const excluded = guests[guests.length - 1];
    await waitForText(
      excluded,
      "Bạn không nằm trong danh sách người chơi của trận này.",
    );
    await expectNoText(excluded, "CHỌN TƯỚNG NÀY");
    expect(guestErrors.flat()).toEqual([]);
    expect(errors).toEqual([]);

    await hostContext.close();
    for (const page of guests) await page.context().close();
  });
});
