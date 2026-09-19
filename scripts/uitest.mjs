/* Drives the BUILT game in a real Chromium and checks what the engine
   tests can't: that the systems actually render and respond. Covers the
   flashpoint banner, patrol momentum, the bounty board and streak, a
   stakeout round, the ticker, ownership marks, and the estate rite.
     npm run build && node scripts/uitest.mjs
   Needs a Chromium binary: set CHROMIUM_PATH, or let Playwright find its
   own. Starts its own `vite preview` on a spare port and stops it after.
   Exits non-zero on the first thing that is wrong. */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4199;
const URL = `http://localhost:${PORT}/`;

let fails = 0;
const fail = (m) => { console.log("FAIL " + m); fails++; };
const ok = (name, cond, extra = "") => (cond ? console.log("  ok  " + name) : fail(name + " " + extra));

/* ---- serve dist/ ---- */
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore" });
const up = async () => {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(URL); if (r.ok) return true; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};
if (!(await up())) { console.log("FAIL preview server never came up — run `npm run build` first"); server.kill(); process.exit(1); }

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

/* Seed a mid-game save: first boss down (opens the board), a live
   flashpoint, and a warm streak — before the app boots. */
const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const seeded = {
  at: Date.now(),
  state: {
    hero: "grayline",
    res: { leads: 5000, salvage: 5000, funding: 5000, xp: 500 },
    own: { perch: 5, lockup: 3, yard: 3, watch: 2, safehouse: 1, informants: 0, gym: 0, precinct: 0, tower: 0 },
    cleared: { flats: 12 }, bosses: { flats: true }, district: "flats", totalXP: 800,
    streak: { days: 3, last: day },
    flash: { id: "witness", left: 18 },
  },
};

const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", (e) => fail("page error: " + e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text() + (m.location().url || "")) && fail("console error: " + m.text()));
await page.addInitScript((s) => localStorage.setItem("mantle:hero:v3", JSON.stringify(s)), seeded);
await page.goto(URL);
await page.waitForTimeout(1500);

/* the flashpoint banner is up, and responding pays and clears it */
ok("flashpoint banner shows", (await page.locator(".n-flash.urgent").count()) === 1);
const leadsBefore = await page.locator(".n-stat.tone-cyan .n-val").innerText();
await page.getByRole("button", { name: "Respond" }).click();
await page.waitForTimeout(300);
ok("responding clears the banner", (await page.locator(".n-flash.urgent").count()) === 0);
ok("responding paid leads", leadsBefore !== (await page.locator(".n-stat.tone-cyan .n-val").innerText()));

/* momentum builds on chained patrol taps */
for (let i = 0; i < 5; i++) { await page.locator(".n-patrol").click(); await page.waitForTimeout(120); }
ok("momentum shows on the patrol button", (await page.locator(".n-momentum").count()) === 1);

/* the ticker runs */
ok("the ticker runs", (await page.locator(".n-ticker").count()) === 1);

/* the bounties tab exists past the first boss and holds the board */
await page.getByRole("tab", { name: /Bounties/ }).click();
await page.waitForTimeout(1200); /* contract tick runs every second */
ok("day streak card shows", (await page.getByText("Day Streak", { exact: false }).count()) >= 1);
ok("contracts rolled", (await page.locator(".n-work").count()) >= 2);

/* a stakeout runs: start, marker sweeps, move in resolves to a cooldown */
await page.getByRole("button", { name: "Start the stakeout", exact: true }).click();
await page.waitForTimeout(400);
ok("the sweep is up", (await page.locator(".n-stake-bar").count()) === 1);
await page.getByRole("button", { name: "Move in", exact: true }).click();
await page.waitForTimeout(300);
ok("the stakeout resolved to a cooldown", /next in/.test(await page.locator(".n-stake").innerText()));

/* a producer shows its next ownership mark */
await page.getByRole("tab", { name: /Region/ }).click();
await page.waitForTimeout(300);
ok("a producer shows its next mark", /×2 at 25/.test(await page.locator(".n-item", { hasText: "ROOFTOP PERCH" }).innerText()));

/* ---- the estate rite: confirm the pass, take a keepsake ---- */
const rich = { at: Date.now(), state: { ...seeded.state, hero: "bastion", tech: { mantle: true }, careerFunding: 9e9, flash: null } };
const page3 = await (await browser.newContext()).newPage();
page3.on("pageerror", (e) => fail("rite page error: " + e.message));
await page3.addInitScript((s) => localStorage.setItem("mantle:hero:v3", JSON.stringify(s)), rich);
await page3.goto(URL);
await page3.waitForTimeout(1200);
await page3.getByRole("tab", { name: /Legacy/ }).click();
await page3.waitForTimeout(300);
await page3.locator(".n-item", { hasText: "PASS THE COWL ON" }).click();
await page3.waitForTimeout(200);
await page3.locator(".n-item", { hasText: "TAP AGAIN TO CONFIRM" }).click();
await page3.waitForTimeout(300);
ok("the estate opens", (await page3.locator(".n-rite").count()) === 1);
ok("three keepsakes are drawn", (await page3.locator(".n-rite .n-hero").count()) === 3);
const kName = (await page3.locator(".n-rite .n-hero-name").first().innerText()).trim();
await page3.locator(".n-rite .n-hero").first().click();
await page3.waitForTimeout(500);
ok("the career reset to hero select", (await page3.locator(".n-hero").count()) === 4);
await page3.locator(".n-hero").first().click();
await page3.waitForTimeout(400);
await page3.getByRole("tab", { name: /Legacy/ }).click();
await page3.waitForTimeout(300);
ok("the keepsake survived the reset", (await page3.locator(".n-badge-card", { hasText: kName }).count()) >= 1, kName);
ok("the career stats show", (await page3.locator(".n-career-card").count()) >= 5);

/* fresh boot still reaches hero select */
const page2 = await (await browser.newContext()).newPage();
await page2.goto(URL);
await page2.waitForTimeout(800);
ok("fresh boot shows hero select", (await page2.locator(".n-hero").count()) === 4);

await browser.close();
server.kill();
console.log(fails ? `\n${fails} FAILED` : "\nui all good");
process.exit(fails ? 1 : 0);
