import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export interface SceneText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Matcher = string | RegExp;

const BACKEND = encodeURIComponent("http://localhost:8000");

/** Page errors and console errors seen since `trackErrors` was called. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) =>
    errors.push(
      `pageerror: ${(error.stack ?? error.message).replace(/\n/g, " | ").slice(0, 900)}`,
    ),
  );
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Chromium reports blocked autoplay as an error-level message.
    if (/AudioContext|autoplay/i.test(text)) return;
    errors.push(`console: ${text.slice(0, 300)}`);
  });
  return errors;
}

/** Every visible Text on the Pixi stage with its on-screen (CSS pixel) box. */
export async function visibleTexts(page: Page): Promise<SceneText[]> {
  return page.evaluate(() => {
    type Node = {
      visible?: boolean;
      alpha?: number;
      children?: Node[];
      text?: unknown;
      getBounds?: () => { x: number; y: number; width: number; height: number };
      worldAlpha?: number;
    };
    const app = (window as unknown as { __TQS_APP__?: { stage: Node } })
      .__TQS_APP__;
    if (!app) return [];
    const found: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    const walk = (node: Node): void => {
      if (node.visible === false || node.alpha === 0) return;
      if (typeof node.text === "string" && node.text && node.getBounds) {
        const b = node.getBounds();
        if (b.width > 0 && b.height > 0)
          found.push({
            text: node.text,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          });
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(app.stage);
    return found;
  });
}

const matches = (text: string, matcher: Matcher): boolean =>
  typeof matcher === "string" ? text.includes(matcher) : matcher.test(text);

export async function waitForText(
  page: Page,
  matcher: Matcher,
  timeout = 15000,
): Promise<SceneText> {
  let hit: SceneText | undefined;
  await expect
    .poll(
      async () => {
        hit = (await visibleTexts(page)).find((t) => matches(t.text, matcher));
        return Boolean(hit);
      },
      {
        timeout,
        message: `expected on-screen text ${String(matcher)}`,
      },
    )
    .toBe(true);
  return hit as SceneText;
}

export async function expectNoText(
  page: Page,
  matcher: Matcher,
  timeout = 3000,
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await visibleTexts(page)).some((t) => matches(t.text, matcher)),
      { timeout, message: `text ${String(matcher)} should not be on screen` },
    )
    .toBe(false);
}

/** Click the centre of the first visible text matching `matcher`. */
export async function clickText(
  page: Page,
  matcher: Matcher,
  timeout = 15000,
): Promise<void> {
  const node = await waitForText(page, matcher, timeout);
  await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2);
}

export async function matchStatus(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __TQS_MATCH__?: { state?: { G?: { status?: string } } };
        }
      ).__TQS_MATCH__?.state?.G?.status ?? null,
  );
}

export async function waitForStatus(
  page: Page,
  status: string,
  timeout = 20000,
): Promise<void> {
  await expect
    .poll(() => matchStatus(page), {
      timeout,
      message: `match status should become ${status}`,
    })
    .toBe(status);
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto(`/?backend=${BACKEND}`);
  await expect(page.locator("#lobby-ui")).toBeVisible({ timeout: 30000 });
  await page.locator("#lobby-player-name").fill(name);
  await page.locator("#btn-create-room").click();
  await page.locator("#input-room-name").fill(`Phòng ${name}`);
  await page.locator("#btn-confirm-create").click();
  await expect(page.locator("#lobby-ui")).toBeHidden({ timeout: 20000 });
  const matchID = new URL(page.url()).searchParams.get("matchID");
  expect(matchID).toBeTruthy();
  return matchID as string;
}

export async function joinRoom(page: Page, matchID: string): Promise<void> {
  await page.goto(`/?matchID=${matchID}&backend=${BACKEND}`);
  await expect(page.locator("#lobby-ui")).toBeHidden({ timeout: 20000 });
  await page.waitForFunction(
    () =>
      (window as unknown as { __TQS_MATCH__?: unknown }).__TQS_MATCH__ !==
      undefined,
    null,
    { timeout: 15000 },
  );
}
