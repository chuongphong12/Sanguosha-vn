/** Two real isolated browser contexts; intentionally outside default unit CI. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startProofServer } from "./transport";

const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
const server = await startProofServer(join(dir, "rooms.json")),
  browser = await chromium.launch();
try {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  const a = await c1.newPage(),
    b = await c2.newPage();
  await Promise.all([a.goto(server.url), b.goto(server.url)]);
  await a.getByRole("button", { name: "Tạo phòng thử" }).click();
  await a.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Ghế: 0"),
  );
  const room = await a.getByLabel("Mã phòng").inputValue();
  await b.getByLabel("Mã phòng").fill(room);
  await b.getByRole("button", { name: "Vào ghế trống" }).click();
  await b.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Ghế: 1"),
  );
  await a.getByRole("button", { name: "Rút một lá" }).click();
  await a.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Bài trên tay: 0"),
  );
  await b.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("0: 1"),
  );
  assert.match(await b.locator("#state").innerText(), /Bài trên tay: trống/);
  const secondary = await c1.newPage();
  await secondary.goto(server.url);
  await secondary.getByRole("button", { name: "Lấy lại ghế đã lưu" }).click();
  await secondary.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Chỉ xem"),
  );
  await secondary
    .getByRole("button", { name: "Nhận quyền điều khiển" })
    .click();
  await secondary.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Điều khiển: Có"),
  );
  await a.getByRole("button", { name: "Rút một lá" }).click();
  await a.waitForFunction(
    () => document.querySelector("#notice")?.textContent === "Stale controller",
  );
  await secondary.getByRole("button", { name: "Rút một lá" }).click();
  await secondary.waitForFunction(() =>
    document
      .querySelector("#state")
      ?.textContent?.includes("Bài trên tay: 0, 1"),
  );
  await secondary.reload();
  await secondary.getByRole("button", { name: "Lấy lại ghế đã lưu" }).click();
  await secondary.waitForFunction(() =>
    document
      .querySelector("#state")
      ?.textContent?.includes("Bài trên tay: 0, 1"),
  );
  // Fixture Jink 3 goes to B after A has drawn cards 0, 1, 2.
  await secondary.getByRole("button", { name: "Rút một lá" }).click();
  await secondary.waitForFunction(() =>
    document
      .querySelector("#state")
      ?.textContent?.includes("Bài trên tay: 0, 1, 2"),
  );
  await b.getByRole("button", { name: "Rút một lá" }).click();
  await b.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("Bài trên tay: 3"),
  );
  await secondary
    .getByRole("button", { name: "Chơi Sát", exact: true })
    .click();
  await secondary
    .getByRole("button", { name: "Sát", exact: true })
    .first()
    .click();
  await secondary.getByRole("button", { name: "1", exact: true }).click();
  await secondary
    .getByRole("button", { name: "Xác nhận", exact: true })
    .click();
  await b.getByRole("button", { name: "Thiểm", exact: true }).waitFor();
  assert.equal(await secondary.locator("#prompt button").count(), 0);
  await b.reload();
  await b.getByRole("button", { name: "Lấy lại ghế đã lưu" }).click();
  await b.getByRole("button", { name: "Thiểm", exact: true }).click();
  await b.waitForFunction(() =>
    document.querySelector("#state")?.textContent?.includes("SlashMissed"),
  );
  assert.match(await b.locator("#state").innerText(), /Bài trên tay: trống/);
  assert.match(await b.locator("#state").innerText(), /HP: 0: 4, 1: 4/);
  assert.equal(await b.locator("#prompt button").count(), 0);
  console.log(
    JSON.stringify({
      status: "passed",
      scope:
        "two browser contexts and secondary same-seat tab; local prototype only",
      checks: [
        "private hands",
        "real draw",
        "secondary read-only",
        "control fencing",
        "refresh seat restore",
        "actual Slash/Jink prompt and MethodUse",
        "prompt owner privacy",
        "refresh while awaiting Jink",
      ],
    }),
  );
} finally {
  await browser.close();
  await server.close();
  await rm(dir, { recursive: true, force: true });
}
