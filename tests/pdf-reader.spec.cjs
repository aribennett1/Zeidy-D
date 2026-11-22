const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/viewer.html");
  await page.waitForFunction(() => window.loaded);
  await page.evaluate(async () => {
    const v = reader.active;
    await reader.renderPage(v, 6);
    const s = reader
      .spans(v, 6)
      .find((s) => s.textContent.startsWith("Line 0150"));
    const r = s.getBoundingClientRect(),
      b = v.container.getBoundingClientRect();
    v.container.scrollTop += r.top - b.top - 180;
  });
  await page.waitForTimeout(450);
});
const position = (page, text) =>
  page.evaluate((text) => {
    if (!text) {
      const a = reader.capture();
      return { text: a.text, x: a.x, y: a.y, scale: a.scale };
    }
    const span = [
      ...reader.active.pages.querySelectorAll(".textLayer span"),
    ].find((s) => s.textContent === text);
    if (!span) throw new Error("Anchor missing: " + text);
    const r = span.getBoundingClientRect();
    return {
      text,
      x: r.left,
      y: r.top,
      scale: reader.active.viewer.currentScale,
    };
  }, text);
async function update(page, name) {
  const bytes = fs.readFileSync(`tests/fixtures/${name}.pdf`),
    version = crypto.createHash("sha256").update(bytes).digest("hex");
  await page.route("**/pdf-version.json?*", (route) =>
    route.fulfill({ json: { version, url: `/tests/fixtures/${name}.pdf` } }),
  );
  await page.evaluate(() => reader.checkVersion());
}
test("overlay keeps rendered anchor and zoom on entry and exit", async ({
  page,
}) => {
  const a = await position(page);
  await page.evaluate(() => reader.toggleFullscreen());
  const b = await position(page, a.text);
  expect(b.text).toBe(a.text);
  expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2);
  expect(b.scale).toBe(a.scale);
  await page.evaluate(() => reader.toggleFullscreen());
  const c = await position(page, a.text);
  expect(c.text).toBe(a.text);
  expect(Math.abs(c.y - a.y)).toBeLessThanOrEqual(2);
});
for (const name of ["same", "insert", "remove", "edit", "pagination"])
  test(`update ${name} keeps actual rendered text stationary`, async ({
    page,
  }) => {
    const a = await position(page);
    await page.evaluate((text) => {
      window.samples = [];
      window.monitoring = true;
      const sample = () => {
        if (!window.monitoring) return;
        const span = [
          ...reader.active.pages.querySelectorAll(".textLayer span"),
        ].find((s) => s.textContent === text);
        window.samples.push(span ? span.getBoundingClientRect().top : null);
        requestAnimationFrame(sample);
      };
      sample();
    }, a.text);
    await update(page, name);
    const samples = await page.evaluate(() => {
      window.monitoring = false;
      return window.samples;
    });
    expect(samples.length).toBeGreaterThan(0);
    for (const y of samples) {
      expect(y).not.toBeNull();
      expect(Math.abs(y - a.y)).toBeLessThanOrEqual(2);
    }
    const b = await position(page, a.text);
    expect(b.text).toBe(a.text);
    expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(2);
    expect(b.scale).toBe(a.scale);
    expect(await page.locator(".pdf-scroll").count()).toBe(1);
  });
test("deleted anchor retains nearby surviving text", async ({ page }) => {
  await page.evaluate(() => {
    const a = reader.active;
    const s = reader
      .spans(a, 6)
      .find((s) => s.textContent.startsWith("Line 0150"));
    const r = s.getBoundingClientRect(),
      b = a.container.getBoundingClientRect();
    a.container.scrollTop += r.top - b.top - b.height / 2;
  });
  const survivor = "Line 0151 reading the sefer with unique context 2567.";
  const before = await position(page, survivor);
  await update(page, "deleted");
  const after = await position(page, survivor);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
  const b = await position(page);
  expect(b.text).toMatch(/Line 015[0-9]/);
  expect(Number.isFinite(b.y)).toBe(true);
});
test("update waits for active gestures and disposes repeated viewers", async ({
  page,
}) => {
  await page.evaluate(() => {
    reader.touching = true;
  });
  await page.evaluate(() => {
    window.previousView = reader.active;
  });
  const pending = update(page, "insert");
  await page.waitForTimeout(700);
  expect(await page.locator(".pdf-scroll:not(.preparing)").count()).toBe(1);
  expect(await page.evaluate(() => reader.version)).toBeUndefined();
  await page.evaluate(() => {
    reader.touching = false;
  });
  await pending;
  expect(
    await page.evaluate(
      () => previousView.disposed && previousView.abort.signal.aborted,
    ),
  ).toBe(true);
  await update(page, "remove");
  await update(page, "same");
  expect(await page.locator(".pdf-scroll").count()).toBe(1);
});
test("only Full Sefer route enables polling", async ({ page }) => {
  const enabled = await page.evaluate(async () => {
    const { autoUpdatesEnabled } = await import("/pdf-reader.mjs");
    return [
      "09 - Misc/Final Sefer",
      "09 - Misc/Bentching",
      "01 - Bereshis/01 - Bereshis/5784",
    ].map(autoUpdatesEnabled);
  });
  expect(enabled).toEqual([true, false, false]);
});
test("PDF internal link navigates through annotation layer", async ({
  page,
}) => {
  await page.evaluate(async () => {
    await reader.renderPage(reader.active, 1);
    reader.active.container.scrollTop = 0;
  });
  await page.locator(".annotationLayer a").first().click();
  await expect
    .poll(() => page.evaluate(() => reader.active.viewer.currentPageNumber))
    .toBe(6);
});
test("same version avoids reload; timer and visibility trigger checks", async ({
  page,
}) => {
  let checks = 0,
    downloads = 0;
  const data = fs.readFileSync("tests/fixtures/original.pdf");
  const version = crypto.createHash("sha256").update(data).digest("hex");
  await page.route("**/pdf-version.json?*", (r) => {
    checks++;
    return r.fulfill({
      json: { version, url: "/tests/fixtures/original.pdf" },
    });
  });
  page.on("request", (r) => {
    if (r.url().includes("original.pdf")) downloads++;
  });
  await page.clock.install();
  await page.evaluate(async () => {
    reader.destroy();
    reader.host.replaceChildren();
    const { PDFReader } = await import("/pdf-reader.mjs");
    window.reader = new PDFReader(reader.host, "/tests/fixtures/original.pdf", {
      autoUpdate: true,
    });
    await reader.ready;
  });
  expect(checks).toBe(1);
  const initial = downloads;
  await page.clock.fastForward(20001);
  await expect.poll(() => checks).toBe(2);
  // The route counter records request arrival, before fetch/JSON parsing finishes.
  // Wait for the timer check to release its lock before testing a separate event.
  await expect.poll(() => page.evaluate(() => reader.busy)).toBe(false);
  await page.evaluate(() => {
    // Dispatching a synthetic event does not change headless WebKit's visibility.
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(checks).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => checks).toBe(3);
  await expect.poll(() => page.evaluate(() => reader.busy)).toBe(false);
  expect(downloads).toBe(initial);
  await page.evaluate(() => reader.destroy());
  await page.clock.fastForward(40000);
  expect(checks).toBe(3);
});
test("failed update leaves current text and viewer intact", async ({
  page,
}) => {
  const a = await position(page);
  await page.route("**/pdf-version.json?*", (r) =>
    r.fulfill({
      json: { version: "a".repeat(64), url: "/tests/fixtures/broken.pdf" },
    }),
  );
  await page.route("**/broken.pdf?*", (r) => r.abort());
  await page.evaluate(() => reader.checkVersion());
  const b = await position(page, a.text);
  expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2);
  expect(await page.locator(".pdf-scroll").count()).toBe(1);
});
test("real Full Sefer renders a bounded set of canvases", async ({ page }) => {
  await page.evaluate(async () => {
    reader.destroy();
    reader.host.replaceChildren();
    const { PDFReader } = await import("/pdf-reader.mjs");
    window.reader = new PDFReader(
      reader.host,
      "/Files/09%20-%20Misc/Final%20Sefer/Final%20Sefer.pdf",
    );
    await reader.ready;
  });
  expect(await page.locator(".pdf-scroll canvas").count()).toBeLessThan(20);
  expect(await page.evaluate(() => reader.active.doc.numPages)).toBeGreaterThan(
    100,
  );
  await page.evaluate(async () =>
    reader.renderPage(reader.active, Math.min(400, reader.active.doc.numPages)),
  );
  expect(await page.locator(".pdf-scroll canvas").count()).toBeLessThan(20);
});
