// Снимает banner.png (1280×640, ×2) и og.jpg (1200×630) с banner.html и og.html. Нужен Playwright: node scripts/banner.cjs
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const root = path.join(__dirname, "..");
  const b = await chromium.launch();
  const shots = [
    ["banner.html", "banner.png", 1280, 640, 2, "png"],   // README и превью репозитория
    ["og.html", "og.jpg", 1200, 630, 1, "jpeg"],        // превью ссылки в мессенджерах
  ];
  for (const [page, file, width, height, scale, type] of shots) {
    const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "dark" });
    await p.goto("file://" + path.join(root, page));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(root, file), type, ...(type === "jpeg" ? { quality: 88 } : {}) });
    console.log(file);
  }
  await b.close();
})();
