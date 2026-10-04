import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
if (!process.env.QA_TOOLS_PATH || !process.env.CHROME_BIN)
  throw new Error("Set QA_TOOLS_PATH and CHROME_BIN; see docs/KNOWLEDGE.md.");
const require = createRequire(
  path.join(process.env.QA_TOOLS_PATH, "package.json"),
);
const { chromium } = require("playwright-core");
const axePath = require.resolve("axe-core/axe.min.js");
const t = JSON.parse(
  readFileSync("apps/web/public/i18n/pl.json", "utf8"),
).knowledge;
const resources = JSON.parse(
  readFileSync("apps/api/src/modules/knowledge/resources.v1.json", "utf8"),
).resources.map((r) => ({
  videoUrl: null,
  facts: [],
  ...r,
  revision: 1,
  updatedAt: "2026-10-03T12:00:00.000Z",
}));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  headless: true,
});
mkdirSync("tmp/knowledge-discovery-qa", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let fail = false;
  await page.route("**/api/knowledge/resources?**", (route) => {
    if (fail)
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Synthetic failure" },
        },
      });
    const params = new URL(route.request().url()).searchParams;
    const list = resources.filter(
      (r) =>
        (!params.get("kind") || r.kind === params.get("kind")) &&
        (!params.get("area") || r.areas.includes(params.get("area"))) &&
        (!params.get("scope") || r.scope === params.get("scope")) &&
        (!params.get("video") || r.videoUrl || r.videoPageUrl) &&
        (!params.get("q") ||
          (r.title + r.summary)
            .toLowerCase()
            .includes(params.get("q").toLowerCase())),
    );
    const num = Number(params.get("page") || 1),
      size = Number(params.get("pageSize") || 12);
    return route.fulfill({
      json: {
        success: true,
        data: {
          resources: list.slice((num - 1) * size, num * size),
          total: list.length,
          page: num,
          pageSize: size,
        },
      },
    });
  });
  await page.route("**/api/knowledge/overview", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { total: resources.length, areas: [], updatedAt: null },
      },
    }),
  );
  async function ready() {
    await page.locator('.catalog[aria-busy="false"]').waitFor();
  }
  async function audit(name) {
    if (await page.locator(".catalog").count()) await ready();
    await page.evaluate(async () => {
      await Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      );
    });
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
    );
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("main, .workspace-content")].some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ),
    );
    console.log(
      name,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            message: n.failureSummary,
          })),
        })),
      ),
      "overflow=",
      overflow,
    );
    await page.screenshot({
      path: `tmp/knowledge-discovery-qa/${name}.png`,
      fullPage: false,
    });
    assert.equal(results.violations.length, 0);
    assert.equal(overflow, false);
  }
  await page.goto(`${process.env.WEB_URL ?? "http://localhost:4200"}/zasobnik`);
  console.log("Opened", page.url());
  await audit("desktop");
  await page
    .getByRole("button", {
      name: t.discovery.paths.discover.title,
      exact: false,
    })
    .click();
  await page.waitForURL("**/zasobnik?kind=innovation");
  await ready();
  await page.waitForFunction(
    () => document.activeElement?.id === "resources-heading",
  );
  await audit("innovations");
  await page.locator(".resource-grid").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "tmp/knowledge-discovery-qa/cards-desktop.png",
  });
  await page
    .getByRole("button", { name: t.discovery.situations.senior, exact: true })
    .click();
  await page.waitForURL("**/zasobnik?area=**");
  await ready();
  assert.equal(new URL(page.url()).searchParams.get("kind"), "innovation");
  await page.getByRole("button", { name: t.videoOnly, exact: true }).click();
  await page.waitForURL("**video=1");
  await ready();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.ok((await page.locator(".video-poster").count()) > 0);
  await page.setViewportSize({ width: 320, height: 800 });
  await audit("mobile-videos");
  await page.locator(".resource-card").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "tmp/knowledge-discovery-qa/card-mobile.png" });
  await page
    .getByRole("button", {
      name: t.discovery.removeFilter.replace("{{value}}", t.videoOnly),
      exact: true,
    })
    .click();
  await page.waitForURL((url) => !url.searchParams.has("video"));
  await page.reload();
  await ready();
  assert.equal(await page.locator(".active-filters button").count(), 3);
  await page.locator(".advanced-filters summary").click();
  await page.locator(".advanced-filters").scrollIntoViewIfNeeded();
  await audit("mobile-filters");
  await page.getByLabel(t.searchLabel, { exact: true }).fill("zzznothing123");
  await page.getByRole("button", { name: t.search, exact: true }).click();
  await page.getByText(t.discovery.emptyTitle, { exact: true }).waitFor();
  await audit("mobile-empty");
  fail = true;
  await page.getByRole("button", { name: t.search, exact: true }).click();
  await page.getByRole("alert").waitFor();
  await audit("mobile-error");
  fail = false;
  await page.getByRole("button", { name: t.retry, exact: true }).click();
  await page.getByText(t.discovery.emptyTitle, { exact: true }).waitFor();
  await page.locator(".topics-section summary").focus();
  await page.keyboard.press("Enter");
  const topic = page.locator(".area-tile").filter({ hasText: "Seniorzy" });
  await topic.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/zasobnik/temat/**");
  await page.locator(".fact-grid").waitFor();
  await audit("mobile-topic");
  assert.deepEqual(errors, []);
  console.log(
    "Discovery, situation, videos, filter removal, URL restore, empty and retry: PASS",
  );
} finally {
  await browser.close();
}
