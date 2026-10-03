import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// Optional QA dependencies are installed outside the application workspace.
const toolsPath = process.env.QA_TOOLS_PATH;
if (!toolsPath || !process.env.CHROME_BIN) {
  throw new Error(
    "Set QA_TOOLS_PATH (directory containing node_modules with playwright-core and axe-core) and CHROME_BIN. See docs/MATCHMAKING-CRITERIA.md.",
  );
}
const require = createRequire(path.join(toolsPath, "package.json"));
const { chromium } = require("playwright-core");
const axePath = require.resolve("axe-core/axe.min.js");
const origin = process.env.WEB_URL ?? "http://localhost:4200";
const translations = JSON.parse(
  readFileSync(
    new URL("../apps/web/public/i18n/pl.json", import.meta.url),
    "utf8",
  ),
);
const innovations = JSON.parse(
  readFileSync(
    new URL(
      "../apps/api/src/modules/matchmaking/catalog.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
).innovations;
const information = JSON.parse(
  readFileSync(
    new URL(
      "../apps/api/src/modules/matchmaking/information.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
).information;
const innovation = innovations.find((item) => item.id === "senior-cuder");
const data = {
  interpretation: {
    summary: "Seniorzy potrzebują wspólnych spotkań.",
    needs: ["Relacje społeczne"],
    audiences: ["Seniorzy"],
    areas: ["Seniorzy"],
    missingInformation: [],
  },
  matches: [
    {
      ...innovation,
      score: 100,
      level: "high",
      matchedNeeds: ["Relacje społeczne"],
      explanation: "Wspólne potrzeby: Relacje społeczne.",
    },
  ],
  relatedInformation: information.filter((item) => item.id === "mapa-seniorzy"),
  catalog: { version: 1, innovationCount: innovations.length },
};
mkdirSync(new URL("../tmp/matchmaking-qa/", import.meta.url), {
  recursive: true,
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  headless: true,
});
let failures = 0;
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
  });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  let response = { status: 200, body: { success: true, data } };
  await page.route("**/api/matchmaking", (route) =>
    route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    }),
  );
  await page.goto(origin + "/matchmaking");
  await page
    .getByRole("textbox", { name: translations.matchmaking.descriptionLabel })
    .waitFor();
  await page.keyboard.press("Tab");
  if (
    await page
      .locator(".skip-link")
      .evaluate((element) => element !== document.activeElement)
  ) {
    throw new Error("Skip link is not the first keyboard target");
  }
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.activeElement?.id === "main-content",
  );

  async function audit(name) {
    await page.evaluate(async () => {
      const finiteAnimations = document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        );
      await Promise.allSettled(
        finiteAnimations.map((animation) => animation.finished),
      );
    });
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    console.log(
      `${name}: ${results.violations.length} violations; overflow=${overflow}`,
    );
    for (const violation of results.violations)
      console.log(
        violation.id,
        violation.nodes.map((node) => ({
          target: node.target,
          details: node.failureSummary,
        })),
      );
    failures += results.violations.length + (overflow ? 1 : 0);
    await page.screenshot({
      path: new URL(
        `../tmp/matchmaking-qa/${name}.png`,
        import.meta.url,
      ).pathname.replace(/^\/(.:)/, "$1"),
      fullPage: true,
    });
  }

  await audit("form-desktop");
  const textbox = page.getByRole("textbox", {
    name: translations.matchmaking.descriptionLabel,
  });
  const submit = page.getByRole("button", {
    name: translations.matchmaking.submit,
    exact: true,
  });
  await textbox.fill("Samotni seniorzy potrzebują wspólnych spotkań.");
  await submit.click();
  await page.waitForFunction(
    () => document.activeElement?.id === "interpretation-title",
  );
  await audit("results-desktop");
  await page.setViewportSize({ width: 320, height: 800 });
  await audit("results-mobile");
  await page
    .getByRole("button", { name: translations.header.themeDark, exact: true })
    .click();
  await audit("results-dark");
  response = {
    status: 200,
    body: {
      success: true,
      data: {
        ...data,
        matches: [],
        interpretation: {
          ...data.interpretation,
          needs: [],
          missingInformation: ["Kogo dotyczy problem?"],
        },
      },
    },
  };
  await submit.click();
  await page
    .getByText(translations.matchmaking.emptyTitle, { exact: true })
    .waitFor();
  await audit("empty-mobile");
  response = {
    status: 504,
    body: { success: false, error: { code: "AI_TIMEOUT", message: "Timeout" } },
  };
  await submit.click();
  await page.getByRole("alert").waitFor();
  await audit("error-mobile");
  if (runtimeErrors.length) {
    console.log("Runtime errors:", runtimeErrors);
    failures += runtimeErrors.length;
  }
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
