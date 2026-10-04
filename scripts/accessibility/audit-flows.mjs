import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
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
const reports = [],
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const origin = process.env.WEB_URL ?? "http://localhost:4200";
const now = "2026-10-03T12:00:00.000Z";
const idea = {
  id: "a11y-idea",
  title: "Sąsiedzka pomoc w gminie",
  essence: "Spotkania mieszkańców pomagających osobom starszym.",
  problem: "Brak kontaktu z sąsiadami i pomocy w codziennych sprawach.",
  targetAudience: "Osoby starsze i ich opiekunowie",
  description: "Regularne spotkania i wspólne działania w lokalnej bibliotece.",
  stage: "POMYSL",
  kind: "IDEA",
  status: "PUBLISHED",
  region: "Kraków",
  hasContact: false,
  audiences: [],
  areas: [],
  needs: [],
  adoptedFromId: null,
  plainLanguageSummary: null,
  visualId: null,
  visualAltText: null,
  hasCanvas: true,
  createdAt: now,
  updatedAt: now,
};
const summary = Object.fromEntries(
  [
    "id",
    "title",
    "essence",
    "targetAudience",
    "stage",
    "kind",
    "region",
    "audiences",
    "areas",
    "needs",
    "visualId",
    "visualAltText",
    "createdAt",
  ].map((k) => [k, idea[k]]),
);
const call = {
  id: "a11y-call",
  name: "Nabór testowy",
  operator: "Hub",
  description: "Wsparcie inicjatyw społecznych.",
  opensAt: now,
  closesAt: "2027-12-31T12:00:00.000Z",
  budget: null,
  maxGrant: null,
  status: "open",
  sections: [
    {
      id: "problem",
      title: "Opis potrzeby",
      question: "Jaki problem chcesz rozwiązać?",
      help: "Opisz potrzeby mieszkańców.",
      maxLength: 600,
      required: true,
      order: 1,
    },
  ],
};
let app = {
  application: {
    id: "a11y-application",
    ideaId: idea.id,
    grantCallId: call.id,
    answers: { problem: "" },
    status: "DRAFT",
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
  },
  call,
  idea: summary,
};
const conv = {
  id: "a11y-conversation",
  subject: "Pomoc w znalezieniu innowacji",
  citizenId: "mock-citizen-123",
  employeeId: null,
  createdAt: now,
  updatedAt: now,
};
let sent = 0,
  fail = false,
  authenticated = false,
  mutationLog = [];
let matchMode = "found";
const match = {
  id: "senior-cuder",
  name: "Senior CUDER",
  description: "Gra do wspólnych spotkań.",
  audiences: ["Seniorzy"],
  areas: ["Seniorzy"],
  needs: ["Relacje społeczne"],
  sourceUrl:
    "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow%2Csenior-cuder",
  verifiedAt: "2026-10-03",
  score: 100,
  level: "high",
  matchedNeeds: ["Relacje społeczne"],
  explanation: "Wspólne potrzeby: Relacje społeczne.",
};
const project = {
  id: "12345678-1234-4123-8123-123456789011",
  organizerName: "Fundacja Sąsiedzi",
  title: "Test pomysłu na integrację",
  description: "Spotkania sąsiedzkie łączące pokolenia w naszej okolicy.",
  requirements: "Osoby chętne do wspólnych spotkań",
  location: "Kraków",
  mode: "hybrid",
  stage: "prototype",
  status: "open",
  isOwner: false,
  applicationCount: 1,
  acceptedCount: 1,
  feedbackCount: 0,
  averageRating: null,
  createdAt: now,
  updatedAt: now,
};
await page.addInitScript(
  ({ now }) => {
    localStorage.setItem(
      "ideaCreator.ideas",
      JSON.stringify([
        {
          id: "a11y-idea",
          title: "Sąsiedzka pomoc w gminie",
          token: "test-only-token",
          savedAt: now,
        },
      ]),
    );
    localStorage.setItem(
      "ideaCreator.applications",
      JSON.stringify([
        {
          id: "a11y-application",
          ideaId: "a11y-idea",
          ideaTitle: "Sąsiedzka pomoc",
          callId: "a11y-call",
          callName: "Nabór testowy",
          token: "test-only-token",
          savedAt: now,
        },
      ]),
    );
  },
  { now },
);
await page.route("**/api/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    p = url.pathname.replace(/^\/api/, "");
  const ok = (data) => route.fulfill({ json: { success: true, data } });
  if (p === "/matchmaking")
    return ok({
      catalog: { version: 1, innovationCount: 15 },
      relatedInformation: [],
      interpretation: {
        summary: "Seniorzy potrzebują wspólnych spotkań.",
        audiences: ["Seniorzy"],
        areas: ["Seniorzy"],
        needs: ["Relacje społeczne"],
        missingInformation: [],
      },
      matches: matchMode === "none" ? [] : [match],
      ...(matchMode === "found"
        ? {}
        : {
            clarification: {
              reason: matchMode === "none" ? "no_matches" : "too_many_matches",
              question: "Jakiej pomocy potrzebują mieszkańcy?",
              round: 1,
              maxRounds: 3,
              totalMatches: matchMode === "none" ? 0 : 12,
            },
          }),
    });
  if (p === "/adaptations")
    return ok({
      advice: {
        message: "Ustalamy zakres.",
        question: "Jak często dostępne jest auto?",
        suggestedAnswers: ["Raz w tygodniu"],
        objective: "Wsparcie domowe.",
        resources: [],
        proposals: [],
        gaps: ["Transport."],
        nextSteps: ["Potwierdzić transport."],
        budget: "Brak wycen.",
        changes: [],
      },
      sources: [{ id: "rops", label: "ROPS", url: "https://rops.krakow.pl/" }],
    });
  if (p === "/testers/projects")
    return ok({ projects: [project], total: 1, page: 1, pageSize: 20 });
  if (p === "/testers/projects/" + project.id)
    return ok({
      project,
      myApplication: {
        id: "12345678-1234-4123-8123-123456789012",
        projectId: project.id,
        message: "Chcę pomóc.",
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      },
      myFeedback: null,
      feedback: [],
    });
  if (p.startsWith("/ideas") && fail)
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Test awarii" },
    });
  if (p === "/ideas")
    return ok({ items: [summary], total: 1, page: 1, pageSize: 12 });
  if (p === "/ideas/a11y-idea") return ok({ idea });
  if (p === "/ideas/a11y-idea/plain-language")
    return ok({ text: "Sąsiedzi spotykają się i pomagają osobom starszym." });
  if (p === "/canvas/template")
    return ok({
      template: {
        version: 1,
        title: "Plan innowacji",
        description: "Opisz swój plan.",
        fields: [
          {
            id: "problem",
            title: "Problem",
            question: "Jaki problem rozwiązujesz?",
            hint: "Opisz sytuację.",
            maxLength: 600,
            column: 1,
            order: 1,
          },
        ],
      },
    });
  if (p === "/ideas/a11y-idea/canvas")
    return ok({
      version: 1,
      answers: { problem: "Brak pomocy sąsiedzkiej." },
      updatedAt: now,
    });
  if (p === "/calls")
    return ok({ calls: [call], hasOpenCall: true, nextOpeningAt: null });
  if (p === "/applications/a11y-application") {
    if (req.method() === "PATCH") {
      mutationLog.push("save");
      app.application.answers = req.postDataJSON().answers;
    }
    return ok(app);
  }
  if (p === "/applications/a11y-application/submit") {
    mutationLog.push("submit");
    sent++;
    app.application.status = "SUBMITTED";
    app.application.submittedAt = now;
    return ok(app);
  }
  if (p === "/contact/conversations")
    return req.method() === "GET"
      ? ok([conv])
      : route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: "SERVICE_UNAVAILABLE", message: "Test awarii" },
          },
        });
  if (p === "/contact/conversations/a11y-conversation/messages")
    return ok([
      {
        id: "a11y-message",
        content: "Dzień dobry. Jak możemy pomóc?",
        conversationId: conv.id,
        senderId: "mock-employee-456",
        createdAt: now,
      },
    ]);
  if (p === "/auth/me")
    return ok({
      user: authenticated
        ? { id: "12345678-1234-4123-8123-123456789012", login: "tester" }
        : null,
    });
  if (p === "/testers/profile/me") return ok({ profile: null });
  if (p === "/testers/profiles")
    return ok({ profiles: [], total: 0, limit: 100 });
  if (p === "/testers/searches") return ok({ searches: [] });
  if (p === "/assistant/chat")
    return ok({
      reply: "Dla kogo chcesz przygotować pomoc?",
      followUpQuestions: ["Jakiej pomocy potrzebują mieszkańcy?"],
    });
  // Never send a mutation to the real backend from this test.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method()))
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Unmocked test request" },
    });
  return route.continue();
});
async function audit(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: axePath });
  const axe = await page.evaluate(() =>
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
        "html,main,.mat-drawer-content,.mat-mdc-dialog-content,.mat-mdc-tab-body-active",
      ),
    ]
      .filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2)
      .map((e) => ({
        tag: e.className,
        width: e.clientWidth,
        scroll: e.scrollWidth,
      })),
    h1: document.querySelectorAll("main h1").length,
    focus: document.activeElement?.outerHTML.slice(0, 250),
  }));
  const item = {
    name,
    ...layout,
    violations: axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
    incomplete: axe.incomplete.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
  };
  reports.push(item);
  console.log(
    JSON.stringify({
      name,
      violations: item.violations,
      overflow: item.overflow,
    }),
  );
}
async function both(name) {
  await audit(name);
  await page.setViewportSize({ width: 320, height: 800 });
  await audit(name + " 320px");
  await page.setViewportSize({ width: 1280, height: 900 });
}
async function go(route) {
  await page.goto(origin + route);
  await page.locator("main").waitFor();
  await page
    .locator("mat-progress-bar")
    .first()
    .waitFor({ state: "hidden", timeout: 10000 });
}
try {
  for (const route of [
    "/dostepnosc",
    "/pomysly",
    "/pomysly/moje",
    "/pomysly/a11y-idea",
    "/pomysly/a11y-idea/canva",
    "/nabory",
    "/nabory/a11y-call/wniosek/a11y-application",
  ]) {
    await go(route);
    await both(route);
  }
  assert.equal(
    await page.locator("textarea").count(),
    1,
    "Application fixture must render",
  );
  await page
    .getByRole("button", {
      name: t.ideaCreator.application.submit,
      exact: true,
    })
    .click();
  await audit("application validation");
  assert.equal(sent, 0);
  await page
    .getByRole("textbox")
    .fill("Chcemy pomóc starszym mieszkańcom w codziennych sprawach.");
  await page
    .getByRole("button", {
      name: t.ideaCreator.application.submit,
      exact: true,
    })
    .click();
  assert.equal(sent, 0, "Review is required for a valid application");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("textbox")
    .fill(
      "Chcemy pomóc starszym mieszkańcom. Zaktualizowana odpowiedź przed wysłaniem.",
    );
  assert.equal(
    await page.getByRole("checkbox").isChecked(),
    false,
    "Editing invalidates review",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", {
      name: t.ideaCreator.application.submit,
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: t.ideaCreator.application.submittedTitle })
    .waitFor();
  assert.equal(sent, 1);
  assert.equal(mutationLog.at(-2), "save");
  assert.equal(mutationLog.at(-1), "submit");
  checks.push(
    "Application validates required fields, saves latest data before submit, requires review, announces success.",
  );
  await both("application submitted");
  await go("/pomysly/nowy");
  for (let i = 1; i <= 4; i++) {
    await page
      .getByRole("tab", { name: t.ideaCreator.new["step" + i], exact: true })
      .click();
    await page.setViewportSize({ width: 320, height: 800 });
    await audit("creator step " + i + " 320px");
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page
    .getByRole("button", { name: t.ideaCreator.new.saveDraft, exact: true })
    .click();
  await page.locator("input[formcontrolname=title]").waitFor();
  await audit("creator validation");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("formcontrolname") === "title",
  );
  checks.push("Creator moves to invalid step and focuses first invalid field.");
  await page
    .getByRole("button", { name: t.ideaCreator.assistant.open, exact: true })
    .click();
  await both("assistant drawer");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: t.ideaCreator.assistant.open, exact: true })
    .waitFor();
  await go("/rops-contact");
  await page
    .getByRole("button", { name: /Pomoc w znalezieniu innowacji/ })
    .press("Enter");
  await page.getByRole("heading", { name: conv.subject }).waitFor();
  await both("contact conversation");
  assert.equal(
    await page
      .getByRole("heading", { name: conv.subject })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  checks.push(
    "ROPS conversation can be selected with Enter and focus moves to its heading.",
  );
  await page
    .getByRole("button", {
      name: t["rops-contact"].new_conversation,
      exact: true,
    })
    .click();
  await both("contact new form");
  await page
    .getByRole("button", { name: t["rops-contact"].send, exact: true })
    .click();
  await audit("contact validation");
  await page.locator("input[name=firstName]").fill("Ala");
  await page.locator("input[name=lastName]").fill("Testowa");
  await page.locator("input[name=subject]").fill("Test dostępności");
  await page
    .locator("textarea[name=message]")
    .fill("Przykładowa wiadomość testowa.");
  await page
    .getByRole("button", { name: t["rops-contact"].send, exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: t.a11y.sendError }).waitFor();
  assert.equal(
    await page.locator("textarea[name=message]").inputValue(),
    "Przykładowa wiadomość testowa.",
  );
  await audit("contact failure preserves draft");
  checks.push("A failed message preserves the draft and announces an error.");
  authenticated = true;
  await go("/tester-innowacji");
  await page
    .getByRole("button", { name: t.testers.addProfile, exact: true })
    .first()
    .click();
  await both("tester profile dialog");
  await page.keyboard.press("Escape");
  authenticated = false;
  await go("/tester-innowacji");
  await page
    .getByRole("button", { name: t.testers.addProfile, exact: true })
    .first()
    .click();
  await both("registration dialog");
  await page.keyboard.press("Escape");
  authenticated = true;
  await go("/tester-innowacji");
  await page
    .getByRole("tab", { name: t.projects.tabs.announcements, exact: true })
    .click();
  await page
    .getByRole("button", { name: t.projects.details, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: project.title, exact: true })
    .waitFor();
  await both("project detail and feedback");
  await page.keyboard.press("Escape");
  for (const mode of ["found", "none", "many"]) {
    matchMode = mode;
    await go("/matchmaking");
    await page
      .getByRole("textbox", {
        name: t.matchmaking.descriptionLabel,
        exact: true,
      })
      .fill("Seniorzy potrzebują wspólnych spotkań.");
    await page
      .getByRole("button", { name: t.matchmaking.submit, exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: t.matchmaking.interpretationTitle,
        exact: true,
      })
      .waitFor();
    await both("matchmaking " + mode);
  }
  await go("/dostosuj/mobilne-centrum-pomocy");
  await page
    .getByRole("textbox", { name: t.adaptation.need, exact: true })
    .fill("Seniorzy potrzebują wizyt domowych.");
  await page
    .getByRole("button", { name: t.adaptation.start, exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Jak często dostępne jest auto?" })
    .waitFor();
  await both("adaptation AI response");
  fail = true;
  await go("/pomysly/a11y-idea");
  await both("idea API failure");
  fail = false;
  await go("/pomysly/nowy");
  await page
    .getByRole("tab", { name: t.ideaCreator.new.step3, exact: true })
    .click();
  await page.addStyleTag({
    content:
      "*:not(mat-icon){line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
  });
  await both("creator text spacing");
  await page.screenshot({
    path: path.join(output, "creator-text-spacing.png"),
    fullPage: true,
  });
  await go("/matchmaking");
  await page
    .getByRole("link", { name: t.layout?.skipToContent ?? /Przejdź do treści/ })
    .press("Enter");
  assert.equal(
    await page.locator("main").evaluate((e) => e === document.activeElement),
    true,
  );
  checks.push("Skip link focuses main.");
  await page.setViewportSize({ width: 640, height: 450 });
  await audit("matchmaking zoom 200 percent equivalent viewport");
  await page.emulateMedia({ forcedColors: "active" });
  await audit("matchmaking forced colors");
} catch (error) {
  errors.push(error.message);
  throw error;
} finally {
  writeFileSync(
    path.join(output, "flows-report.json"),
    JSON.stringify({ reports, checks, errors }, null, 2),
  );
  await browser.close();
}
process.exitCode =
  reports.some((r) => r.violations.length || r.overflow.length) || errors.length
    ? 1
    : 0;
