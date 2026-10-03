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
const origin = process.env.WEB_URL ?? "http://localhost:4200";
const translations = JSON.parse(
  readFileSync(
    new URL("../apps/web/public/i18n/pl.json", import.meta.url),
    "utf8",
  ),
);
const t = translations.knowledge;
const seed = JSON.parse(
  readFileSync(
    new URL(
      "../apps/api/src/modules/knowledge/resources.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
).resources;
const resources = seed.map((resource) => ({
  ...resource,
  revision: 1,
  updatedAt: "2026-10-03T12:00:00.000Z",
}));
const directory = new URL("../tmp/knowledge-qa/", import.meta.url);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  headless: true,
});
let failures = 0;
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  async function audit(name) {
    await page.evaluate(async () => {
      await Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished),
      );
    });
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    const screenshot = new URL(`${name}.png`, directory);
    await page.screenshot({
      path: screenshot.pathname.replace(/^\/(.:)/, "$1"),
      fullPage: true,
    });
    const viewport = new URL(`${name}-viewport.png`, directory);
    await page.screenshot({ path: viewport.pathname.replace(/^\/(.:)/, "$1") });
    console.log(
      `${name}: ${result.violations.length} WCAG violations; document overflow=${overflow}`,
    );
    for (const violation of result.violations)
      console.log(
        JSON.stringify({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        }),
      );
    if (result.violations.length || overflow) failures++;
  }

  await page.goto(`${origin}/zasobnik`);
  await page
    .getByRole("status")
    .filter({ hasText: "Znaleziono zasobów:" })
    .waitFor();
  assert.equal(await page.locator(".resource-card").count(), 12);
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator("#main-content")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await audit("public-desktop");

  await page
    .getByRole("link", { name: "Seniorzy", exact: false })
    .filter({ has: page.locator(".tile-count") })
    .click();
  await page.waitForURL("**/zasobnik/temat/**");
  await page.locator(".fact-grid").waitFor();
  await audit("topic-desktop");
  await page
    .getByRole("link", { name: t.topic.allResources, exact: true })
    .click();
  await page.waitForURL("**/zasobnik?area=**");
  await page
    .getByRole("button", { name: t.kinds.innovation, exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Znaleziono zasobów:" })
    .waitFor();
  await page.waitForURL("**/zasobnik?*kind=**");
  await page.waitForFunction(
    () => document.activeElement?.id === "resources-heading",
  );
  assert.equal(
    await page
      .locator("#resources-heading")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await audit("public-mobile");
  await page
    .getByRole("button", { name: translations.header.themeDark, exact: true })
    .click();
  await audit("public-dark");
  // Wyszukiwania są zliczane w trendach potrzeb, więc audyt nie wysyła frazy do API.
  await page.route(
    (url) => url.searchParams.get("q") === "zzznothing123",
    (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { resources: [], total: 0, page: 1, pageSize: 12 },
        },
      }),
  );
  await page.getByLabel(t.searchLabel, { exact: true }).fill("zzznothing123");
  await page.getByRole("button", { name: t.search, exact: true }).click();
  await page.getByText(t.empty, { exact: true }).waitFor();
  await audit("empty-mobile");

  await page.getByRole("button", { name: t.clear, exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Znaleziono zasobów:" })
    .waitFor();
  await page.route("**/api/knowledge/resources?**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Synthetic failure" },
      },
    }),
  );
  await page.getByRole("button", { name: t.search, exact: true }).click();
  await page.getByRole("alert").waitFor();
  await audit("public-error");
  await page.unroute("**/api/knowledge/resources?**");
  await page.getByRole("button", { name: t.retry, exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Znaleziono zasobów:" })
    .waitFor();

  let loggedIn = false;
  let savedInput;
  const csrfToken = "b".repeat(64);
  const areas = [
    ...new Set(
      resources
        .filter((item) => item.kind === "challenge")
        .flatMap((item) => item.areas),
    ),
  ];
  const trends = {
    from: "2026-09-04",
    until: "2026-10-03",
    currentTotal: 13,
    previousTotal: 8,
    areas: areas.map((area, index) => ({
      area,
      current: index === 0 ? 7 : index < 3 ? 3 : 0,
      previous: index === 0 ? 4 : index === 1 ? 4 : 0,
      rising: index === 0,
    })),
    sources: [
      { source: "matchmaking", count: 8 },
      { source: "search", count: 3 },
      { source: "browse", count: 1 },
      { source: "form", count: 1 },
    ],
    phrases: [{ phrase: "wsparcie seniorów", count: 3 }],
    needs: [{ need: "Relacje społeczne", count: 7 }],
    daily: [{ day: "2026-10-03", count: 13 }],
  };
  const idea = {
    id: "synthetic-idea",
    title: "Synthetic submitted idea",
    essence: "Synthetic essence used only by the accessibility audit.",
    problem: "Synthetic problem.",
    targetAudience: "Synthetic audience",
    description: "",
    stage: "POMYSL",
    kind: "IDEA",
    status: "SUBMITTED",
    region: "",
    hasContact: false,
    audiences: [],
    areas: [],
    needs: [],
    adoptedFromId: null,
    plainLanguageSummary: null,
    visualId: null,
    visualAltText: null,
    hasCanvas: false,
    unreadReply: false,
    createdAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:00.000Z",
  };
  await page.route("**/api/knowledge/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const respond = (data, status = 200) =>
      route.fulfill({ status, json: { success: true, data } });
    if (url.pathname.endsWith("/login")) {
      loggedIn = true;
      return respond({ csrfToken, expiresAt: "2026-10-03T23:59:00.000Z" });
    }
    if (!loggedIn)
      return route.fulfill({
        status: 401,
        json: {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Synthetic session absent" },
        },
      });
    if (url.pathname.endsWith("/session"))
      return respond({ csrfToken, expiresAt: "2026-10-03T23:59:00.000Z" });
    if (url.pathname.endsWith("/trends")) return respond(trends);
    if (url.pathname.endsWith("/ideas"))
      return respond({ items: [{ idea, awaitsRops: true }], attention: 1 });
    if (url.pathname.endsWith(`/ideas/${idea.id}`))
      return respond({
        idea,
        awaitsRops: true,
        messages: [
          {
            id: "synthetic-message",
            author: "AUTHOR",
            content: "Synthetic author message",
            createdAt: "2026-10-03T12:00:00.000Z",
          },
        ],
      });
    if (url.pathname.endsWith("/summary"))
      return respond({
        published: resources.length,
        draft: 0,
        stale: 0,
        staleBefore: "2026-04-06",
      });
    if (method === "PUT") {
      assert.equal(route.request().headers()["x-knowledge-csrf"], csrfToken);
      const body = route.request().postDataJSON();
      savedInput = body.resource;
      const index = resources.findIndex((item) => item.id === body.resource.id);
      resources[index] = {
        ...body.resource,
        revision: body.revision + 1,
        updatedAt: "2026-10-03T15:00:00.000Z",
      };
      return respond(resources[index]);
    }
    if (url.pathname.endsWith("/resources"))
      return respond({
        resources: resources.slice(0, 12),
        total: resources.length,
        page: 1,
        pageSize: 12,
      });
    if (url.pathname.endsWith("/logout")) {
      loggedIn = false;
      return respond({ accepted: true });
    }
    throw new Error(
      `Unhandled synthetic admin route: ${method} ${url.pathname}`,
    );
  });
  await page.goto(`${origin}/zasobnik/admin`);
  await page.getByRole("heading", { name: t.admin.loginTitle }).waitFor();
  assert.equal(await page.locator("table").count(), 0);
  await audit("admin-login-mobile");
  await page
    .getByLabel(t.admin.password, { exact: true })
    .fill("Synthetic password");
  await page.getByRole("button", { name: t.admin.login, exact: true }).click();
  await page.locator(".resource-card").first().waitFor();
  await page.setViewportSize({ width: 1280, height: 900 });
  await audit("admin-resources");
  await page
    .getByRole("button", { name: /^Edytuj/ })
    .first()
    .click();
  await page.getByRole("heading", { name: t.admin.editTitle }).waitFor();
  await page.setViewportSize({ width: 320, height: 800 });
  await page
    .getByLabel(t.admin.title, { exact: true })
    .scrollIntoViewIfNeeded();
  await audit("admin-editor-mobile");
  await page
    .getByLabel(t.admin.title, { exact: true })
    .fill("Synthetic edited resource");
  await page.getByRole("button", { name: t.admin.save, exact: true }).click();
  await page.getByText(t.admin.saved, { exact: true }).waitFor();
  assert.equal(savedInput.title, "Synthetic edited resource");
  await page.getByRole("button", { name: "Pomysły (1)", exact: true }).click();
  await page
    .getByRole("button", { name: t.admin.ideas.open, exact: false })
    .click();
  await page.getByText("Synthetic author message", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: t.admin.ideas.reject, exact: true })
    .click();
  await page
    .getByText(t.admin.ideas.messageRequired, { exact: true })
    .waitFor();
  await audit("admin-ideas-mobile");
  await page.getByRole("button", { name: t.admin.trends, exact: true }).click();
  await page.getByRole("heading", { name: t.trends.title }).waitFor();
  await page.locator(".table-scroll").focus();
  await page.locator(".table-scroll").press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelector(".table-scroll")?.scrollLeft > 0,
  );
  await audit("admin-trends-mobile");
  await page.getByRole("button", { name: t.admin.logout, exact: true }).click();
  await page.getByRole("heading", { name: t.admin.loginTitle }).waitFor();
  assert.equal(await page.locator("table").count(), 0);
  assert.deepEqual(runtimeErrors, []);
} finally {
  await browser.close();
}
if (failures)
  throw new Error(`Accessibility checks failed in ${failures} views.`);
console.log(
  "Search, empty state, retry, editor, login/logout and admin trends checks passed.",
);
