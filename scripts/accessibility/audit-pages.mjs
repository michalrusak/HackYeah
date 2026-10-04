import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const root =
  process.env.REPO_PATH ?? path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(
    process.env.QA_TOOLS_PATH ?? path.join(root, "tmp/a11y-tools"),
    "package.json",
  ),
);
const { chromium } = require("playwright-core");
const axePath = require.resolve("axe-core/axe.min.js");
const t = JSON.parse(
  readFileSync(path.join(root, "apps/web/public/i18n/pl.json"), "utf8"),
);
const output = process.env.QA_OUTPUT ?? path.join(root, "tmp/accessibility");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const report = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const origin = process.env.WEB_URL ?? "http://localhost:4200";
async function audit(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    }),
  );
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    overflow: [
      ...document.querySelectorAll(
        "main, .mat-drawer-content, .mat-mdc-dialog-content",
      ),
    ]
      .filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2)
      .map((e) => ({
        tag: e.className,
        width: e.clientWidth,
        scroll: e.scrollWidth,
      })),
    h1: document.querySelectorAll("main h1").length,
    title: document.title,
  }));
  const item = {
    name,
    ...layout,
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
    incomplete: result.incomplete.map((v) => v.id),
  };
  report.push(item);
  console.log(JSON.stringify(item));
}
try {
  for (const route of [
    "/matchmaking",
    "/dostosuj/mobilne-centrum-pomocy",
    "/tester-innowacji",
    "/pomysly",
    "/pomysly/nowy",
    "/pomysly/moje",
    "/nabory",
    "/materialy",
    "/about",
    "/contact",
    "/rops-contact",
  ]) {
    await page.goto(origin + route);
    await page.locator("main").waitFor();
    await page
      .locator(".loading-state, mat-progress-bar")
      .first()
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {});
    await audit(route + " desktop");
    await page.setViewportSize({ width: 320, height: 800 });
    await audit(route + " 320px");
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.goto(origin + "/pomysly/nowy");
  for (let step = 1; step <= 4; step++) {
    if (step > 1)
      await page
        .getByRole("tab", {
          name: new RegExp(t.ideaCreator.new["step" + step]),
        })
        .click();
    await audit("idea-step-" + step);
  }
  await page.goto(origin + "/tester-innowacji");
  await page.getByRole("button", { name: t.auth.login, exact: true }).click();
  await audit("login-dialog");
  await page.locator("#auth-form").evaluate((e) => e.requestSubmit());
  await audit("login-errors");
  await page.keyboard.press("Escape");
  await page
    .getByRole("tab", { name: t.projects.tabs.announcements, exact: true })
    .click();
  await page
    .getByRole("button", { name: t.projects.create, exact: true })
    .click();
  await audit("project-form");
  await page.locator("#project-form").evaluate((e) => e.requestSubmit());
  await audit("project-errors");
} catch (error) {
  errors.push(error.message);
  throw error;
} finally {
  writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
}
process.exitCode =
  report.some((r) => r.violations.length || r.overflow.length) || errors.length
    ? 1
    : 0;
