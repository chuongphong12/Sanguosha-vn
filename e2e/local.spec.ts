import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  clickText,
  expectNoText,
  trackErrors,
  visibleTexts,
  waitForStatus,
  waitForText,
} from "./support/pixi";

const VIEWPORT = { width: 1280, height: 720 };

interface OfflineOptions {
  players: number;
  bots?: boolean;
  fastPick?: boolean;
}

async function startOffline(
  page: Page,
  { players, bots = false, fastPick = false }: OfflineOptions,
): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#lobby-ui")).toBeVisible({ timeout: 30000 });
  await page.locator("#btn-offline").click();
  await page.locator("#select-offline-players").selectOption(String(players));
  await page.locator("#chk-offline-bots").setChecked(bots);
  await page.locator("#chk-offline-fastpick").setChecked(fastPick);
  await page.locator("#btn-confirm-offline").click();
  await expect(page.locator("#lobby-ui")).toBeHidden({ timeout: 10000 });
}

interface LocalState {
  status: string;
  viewerID: string;
  lordID: string;
  activePlayerID: string;
  turnNumber: number;
  step: string;
  promptResponder: string | null;
  promptID: number | null;
  hand: number;
  hp: number;
}

async function localState(page: Page): Promise<LocalState> {
  return page.evaluate(() => {
    const match = (
      window as unknown as {
        __TQS_MATCH__: { currentViewerID: string; state: { G: any } };
      }
    ).__TQS_MATCH__;
    const G = match.state.G;
    const me = G.players[match.currentViewerID];
    return {
      status: G.status,
      viewerID: match.currentViewerID,
      lordID: G.lordID,
      activePlayerID: G.turn.activePlayerID,
      turnNumber: G.turn.number,
      step: G.turn.step,
      promptResponder: G.prompt?.responderID ?? null,
      promptID: G.prompt?.id ?? null,
      hand: me.hand.length,
      hp: me.hp,
    };
  });
}

async function hasText(page: Page, matcher: string | RegExp): Promise<boolean> {
  return (await visibleTexts(page)).some((t) =>
    typeof matcher === "string"
      ? t.text.includes(matcher)
      : matcher.test(t.text),
  );
}

/**
 * Drive hot-seat hand-offs, role reveals and general pickers until play starts.
 * Every step is a click a person would make.
 */
async function playThroughSelection(page: Page): Promise<void> {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if ((await localState(page)).status === "playing") return;
    if (await hasText(page, /^Tôi là P\d+/)) {
      await clickText(page, /^Tôi là P\d+/);
    } else if (await hasText(page, /^Thân phận của bạn là:/)) {
      await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    } else if (await hasText(page, /^CHỌN TƯỚNG NÀY$/)) {
      await clickText(page, "CHỌN TƯỚNG NÀY");
    }
    await page.waitForTimeout(250);
  }
  throw new Error("selection did not finish in time");
}

async function dismissRoleIfShown(page: Page): Promise<void> {
  if (await hasText(page, /^Thân phận của bạn là:/)) {
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await expectNoText(page, "Thân phận của bạn là:");
  }
}

/** Start a seeded 4-player hot-seat match and get the first player ready to act. */
async function startSeededHotSeat(page: Page, seed: string): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/?mode=local&numPlayers=4&fastpick=1&seed=${seed}`);
  await waitForStatus(page, "playing");
  await dismissRoleIfShown(page);
  await clickText(page, /^Tôi là P\d+/);
  await dismissRoleIfShown(page);
  await waitForText(page, /Giai Đoạn Xuất Bài/);
}

async function evalMatch<T>(page: Page, fn: (G: any) => T): Promise<T> {
  return page.evaluate(
    `(${fn.toString()})(window.__TQS_MATCH__.state.G)`,
  ) as Promise<T>;
}

/** Select a hand card by its printed name (the hand is the bottom strip). */
async function selectHandCard(page: Page, name: string): Promise<void> {
  const card = (await visibleTexts(page)).find(
    (t) => t.text === `【${name}】` && t.y > VIEWPORT.height - 260,
  );
  expect(card, `hand holds ${name}`).toBeDefined();
  await page.mouse.click(card!.x + card!.width / 2, card!.y + card!.height / 2);
}

/**
 * Keep the hot-seat device moving (hand-offs, role reveals) and press the
 * first visible button matching `answer` until `done` holds.
 */
async function driveUntil(
  page: Page,
  done: () => Promise<boolean>,
  answer: RegExp,
  timeout = 60000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await done()) return;
    if (await hasText(page, /^Thân phận của bạn là:/)) {
      await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    } else if (await hasText(page, /^Tôi là P\d+/)) {
      await clickText(page, /^Tôi là P\d+/);
    } else if (await hasText(page, answer)) {
      await clickText(page, answer);
    }
    await page.waitForTimeout(250);
  }
  const seen = JSON.stringify((await visibleTexts(page)).map((t) => t.text));
  throw new Error(
    `prompt flow did not finish (${String(answer)}); on screen: ${seen}`,
  );
}

async function discardIfRequired(page: Page): Promise<void> {
  const state = await localState(page);
  if (state.step !== "discard") return;
  const required = state.hand - Math.max(0, state.hp);
  await waitForText(page, /Cần bỏ:/);
  for (let i = 0; i < required; i += 1) {
    const cards = (await visibleTexts(page)).filter(
      (t) => /^【.+】/.test(t.text) && t.y > VIEWPORT.height - 260,
    );
    await page.mouse.click(
      cards[i].x + cards[i].width / 2,
      cards[i].y + cards[i].height / 2,
    );
    await expect
      .poll(() => hasText(page, new RegExp(`Đã chọn: ${i + 1} lá`)))
      .toBe(true);
  }
  await clickText(page, "Xác nhận bỏ bài");
}

test.describe("Local play", () => {
  test("hot-seat: hand-offs, general selection and the first turn hand-over", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(VIEWPORT);
    const errors = trackErrors(page);
    await startOffline(page, { players: 4 });
    await waitForStatus(page, "lord-selection");

    await playThroughSelection(page);

    // The lord opens; the device must be handed to them before they may act.
    const { lordID } = await localState(page);
    if ((await localState(page)).viewerID !== lordID)
      await clickText(page, /^Tôi là P\d+/);
    await expect
      .poll(async () => (await localState(page)).viewerID)
      .toBe(lordID);
    await waitForText(page, /Giai Đoạn Xuất Bài/);
    await dismissRoleIfShown(page);
    await clickText(page, "Kết thúc Xuất Bài");
    await expect
      .poll(async () => {
        const s = await localState(page);
        return s.step === "discard" || s.activePlayerID !== lordID;
      })
      .toBe(true);
    await discardIfRequired(page);

    // Next player: a hand-off screen hides the previous player's hand.
    await expect
      .poll(async () => (await localState(page)).activePlayerID)
      .not.toBe(lordID);
    await waitForText(page, /ĐƯA THIẾT BỊ CHO P\d+/);
    expect(errors).toEqual([]);
  });

  test("card flow: select a Sát, pick a target, the target answers and loses health", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize(VIEWPORT);
    const errors = trackErrors(page);
    // Fixed seed: the lord (P1) starts with two Sát and sits next to P2.
    await page.goto("/?mode=local&numPlayers=4&fastpick=1&seed=card-flow-1");
    await waitForStatus(page, "playing");
    // The role reveal covers the screen first; then hot-seat asks the acting
    // player to confirm before their hand is shown.
    await dismissRoleIfShown(page);
    await clickText(page, /^Tôi là P1/);
    await waitForText(page, /Giai Đoạn Xuất Bài/);

    const before = await page.evaluate(() => {
      const m = (window as any).__TQS_MATCH__;
      const G = m.state.G;
      return { hp: G.players["1"].hp, hand: G.players["0"].hand.length };
    });

    // 1. Pick the Sát from the hand. "Sử dụng" stays disabled until a target is chosen.
    const hand = (await visibleTexts(page)).filter(
      (t) => t.text === "【Sát】" && t.y > VIEWPORT.height - 260,
    );
    expect(hand.length, "the seeded lord holds Sát").toBeGreaterThan(0);
    await page.mouse.click(
      hand[0].x + hand[0].width / 2,
      hand[0].y + hand[0].height / 2,
    );
    await waitForText(page, /Chọn 1 mục tiêu/);

    // 2. Tap the left-most opponent (P2): its hand badge sits on its avatar.
    const badges = (await visibleTexts(page))
      .filter((t) => /^🂠 \d+$/.test(t.text))
      .sort((a, b) => a.x - b.x);
    expect(badges.length).toBe(3);
    await page.mouse.click(
      badges[0].x + badges[0].width / 2,
      badges[0].y + badges[0].height / 2,
    );
    await clickText(page, /^Sử dụng$/);

    // 3. The Sát leaves the hand and P2 has to answer: hand the device over.
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as any).__TQS_MATCH__.state.G.prompt?.responderID ?? null,
        ),
      )
      .toBe("1");
    await clickText(page, /^Tôi là P2/);
    await dismissRoleIfShown(page);
    await clickText(page, /^Không dùng 【Thiểm】$/);

    // 4. P2 took the hit; the log says so with real numbers, not template text.
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as any).__TQS_MATCH__.state.G.players["1"].hp,
        ),
      )
      .toBe(before.hp - 1);
    await waitForText(page, /chịu 1 điểm Sát Thương/);
    for (const t of await visibleTexts(page))
      expect(t.text).not.toContain("${");
    const after = await page.evaluate(
      () => (window as any).__TQS_MATCH__.state.G.players["0"].hand.length,
    );
    expect(after).toBe(before.hand - 1);
    expect(errors).toEqual([]);
  });

  test("result screen: shows the winner and returns to the lobby", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize(VIEWPORT);
    const errors = trackErrors(page);
    await page.goto("/?mode=local&numPlayers=4&fastpick=1&seed=card-flow-1");
    await waitForStatus(page, "playing");

    // Ending a real game takes many turns; feed the screen the state the
    // server would send once a side has won.
    await page.evaluate(() => {
      const app = (window as any).__TQS_APP__;
      const screen = app.navigation.currentScreen;
      const state = JSON.parse(JSON.stringify(screen.state));
      state.G.status = "ended";
      state.G.prompt = null;
      state.G.winner = {
        side: "lord",
        playerIDs: [state.G.lordID],
        reason: "Chủ Công và Trung Thần chiến thắng!",
      };
      screen.receiveState(state);
    });

    await waitForText(page, "Chủ Công và Trung Thần chiến thắng!");
    await waitForText(page, /Chồng Bài Rút: \d+ · Chồng Bài Bỏ: \d+/);
    await expectNoText(page, "Kết thúc Xuất Bài");
    await dismissRoleIfShown(page);
    await clickText(page, "Quay lại sảnh");
    // A plain reload would rejoin this local game; the lobby must come back.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#lobby-ui")).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test("prompt flow: Nam Man Nhập Xâm asks every other player and each pays with health", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = trackErrors(page);
    await startSeededHotSeat(page, "card-flow-2");

    await selectHandCard(page, "Nam Man Nhập Xâm");
    await clickText(page, /^Sử dụng$/);

    // Each of the three others answers on the shared device; none holds a Sát to spare
    // that the test would use, so they all decline.
    await driveUntil(
      page,
      () =>
        evalMatch(page, (G) => G.prompt === null && G.log.length > 0).then(
          async (idle) =>
            idle &&
            (await evalMatch(
              page,
              (G) =>
                G.log.filter((e: { message: string }) =>
                  /chịu 1 điểm Sát Thương/.test(e.message),
                ).length,
            )) >= 3,
        ),
      /^Bỏ qua$/,
    );

    const hpLost = await evalMatch(
      page,
      (G) => Object.values(G.players).filter((p: any) => p.hp < p.maxHP).length,
    );
    expect(hpLost).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test("prompt flow: Thuận Thủ Khiên Dương lets the caster pick a card from the target", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = trackErrors(page);
    await startSeededHotSeat(page, "card-flow-2");

    const before = await evalMatch(page, (G) => {
      const lord = G.players[G.lordID];
      const target = G.players[G.seatOrder[G.seatOrder.length - 1]];
      return { mine: lord.hand.length, theirs: target.hand.length };
    });

    await selectHandCard(page, "Thuận Thủ Khiên Dương");
    const badges = (await visibleTexts(page))
      .filter((t) => /^🂠 \d+$/.test(t.text))
      .sort((a, b) => a.x - b.x);
    // The right-most opponent: the left one is Lục Tốn, whose Khiêm Tốn makes
    // him immune to Thuận Thủ.
    const rightmost = badges[badges.length - 1];
    await page.mouse.click(
      rightmost.x + rightmost.width / 2,
      rightmost.y + rightmost.height / 2,
    );
    await clickText(page, /^Sử dụng$/);

    await waitForText(page, "Chọn bài");
    await clickText(page, /^Lá úp 1$/);
    await clickText(page, /^Xác nhận$/);

    await expect
      .poll(() =>
        evalMatch(page, (G) => {
          const lord = G.players[G.lordID];
          const target = G.players[G.seatOrder[G.seatOrder.length - 1]];
          return { mine: lord.hand.length, theirs: target.hand.length };
        }),
      )
      .toEqual({ mine: before.mine, theirs: before.theirs - 1 });
    expect(errors).toEqual([]);
  });

  test("prompt flow: Ngũ Cốc Phong Đăng lets every player take one card in turn", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = trackErrors(page);
    await startSeededHotSeat(page, "card-flow-8");

    await selectHandCard(page, "Ngũ Cốc Phong Đăng");
    await clickText(page, /^Sử dụng$/);

    // Pick the first revealed card for each of the four players.
    const pickFirst = async () => {
      const options = (await visibleTexts(page)).filter(
        (t) => /^【.+】/.test(t.text) && t.y > 200 && t.y < 470,
      );
      if (options.length === 0) return;
      await page.mouse.click(
        options[0].x + options[0].width / 2,
        options[0].y + options[0].height / 2,
      );
    };
    const deadline = Date.now() + 60000;
    let picks = 0;
    while (Date.now() < deadline && picks < 4) {
      if (await hasText(page, /^Thân phận của bạn là:/)) {
        await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
      } else if (await hasText(page, /^Tôi là P\d+/)) {
        await clickText(page, /^Tôi là P\d+/);
      } else if (await hasText(page, "Chọn một lá bài")) {
        await pickFirst();
        await clickText(page, "Nhận lá đã chọn");
        picks += 1;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(200);
    }
    expect(picks).toBe(4);
    await expect
      .poll(() => evalMatch(page, (G) => G.prompt === null))
      .toBe(true);
    expect(errors).toEqual([]);
  });

  test("bots: a solo human plays alongside AI until turns rotate", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(VIEWPORT);
    const errors = trackErrors(page);
    await startOffline(page, { players: 4, bots: true, fastPick: true });
    await waitForStatus(page, "playing");

    // The HUD is up (its second line is always present, prompt or not).
    await waitForText(page, /Chồng Bài Rút: \d+/);
    await dismissRoleIfShown(page);

    // Bots move by themselves; answer whatever they throw at us.
    const deadline = Date.now() + 90000;
    let seenTurnsOfOthers = 0;
    let lastActive = (await localState(page)).activePlayerID;
    while (Date.now() < deadline && seenTurnsOfOthers < 2) {
      const s = await localState(page);
      if (s.status !== "playing") break;
      if (s.activePlayerID !== lastActive) {
        if (s.activePlayerID !== s.viewerID) seenTurnsOfOthers += 1;
        lastActive = s.activePlayerID;
      }
      if (s.promptResponder === s.viewerID) {
        const passText = (await visibleTexts(page)).find((t) =>
          /^(Không|Bỏ qua|Giữ nguyên|Gây Sát)/.test(t.text),
        );
        if (passText) {
          await page.mouse.click(
            passText.x + passText.width / 2,
            passText.y + passText.height / 2,
          );
        } else {
          await page.evaluate((id) => {
            (
              window as unknown as {
                __TQS_MATCH__: { move: (...a: unknown[]) => void };
              }
            ).__TQS_MATCH__.move("answerPrompt", id, { kind: "pass" });
          }, s.promptID);
        }
      } else if (
        s.activePlayerID === s.viewerID &&
        s.step === "play" &&
        s.promptResponder === null
      ) {
        await clickText(page, "Kết thúc Xuất Bài");
      } else if (s.activePlayerID === s.viewerID && s.step === "discard") {
        await discardIfRequired(page);
      }
      await page.waitForTimeout(300);
    }
    expect(seenTurnsOfOthers, "bots take their turns").toBeGreaterThanOrEqual(
      2,
    );
    expect(errors).toEqual([]);
  });
});
