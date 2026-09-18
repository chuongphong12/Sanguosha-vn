import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("response", (response) => {
    if (!response.ok())
      console.log("FAILED:", response.url(), response.status());
  });
  page.on("console", (msg) => console.log("CONSOLE:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("requestfailed", (request) =>
    console.log("REQUEST FAILED:", request.url(), request.failure().errorText),
  );
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(3000);
  await browser.close();
})();
