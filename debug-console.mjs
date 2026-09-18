import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.log(`[BROWSER ERROR] ${err.name}: ${err.message}`);
    console.log(err.stack);
  });

  try {
    await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
    // Wait a bit to ensure any async errors are caught
    await page.waitForTimeout(3000);
  } catch (e) {
    console.error("Failed to load page:", e);
  }

  await browser.close();
})();
