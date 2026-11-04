// Снимает banner.png (1280×640, ×2) с banner.html. Нужен Playwright: node scripts/banner.cjs
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const root = path.join(__dirname, "..");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await p.goto("file://" + path.join(root, "banner.html"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(root, "banner.png") });
  await b.close();
  console.log("banner.png");
})();
