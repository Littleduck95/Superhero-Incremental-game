/* Drives the BUILT game in a real Chromium and checks what the engine
   tests can't: that the systems actually render and respond. Covers the
   flashpoint banner, patrol momentum, the bounty board and streak, a
   stakeout round, the ticker, ownership marks, the settings panel with
   its import, export and do-over, and the estate rite.
     npm run test:ui
   The dependency is `playwright-core`, which drives a browser but ships
   none, so point CHROMIUM_PATH at a Chromium or Chrome binary if one
   isn't in the usual places. Starts its own `vite preview` on a spare
   port and always stops it again, even when a check throws — a leaked
   server would make every later run fail on the port.
   Exits non-zero on the first thing that is wrong. */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4199;
const URL = `http://localhost:${PORT}/`;

let fails = 0;
const fail = (m) => { console.log("FAIL " + m); fails++; };
const ok = (name, cond, extra = "") => (cond ? console.log("  ok  " + name) : fail(name + " " + extra));

/* playwright-core brings no browser of its own: take CHROMIUM_PATH, then
   the places a Chromium usually lands, and say so plainly if there is
   none rather than failing inside launch(). */
const findChromium = () => {
  const named = process.env.CHROMIUM_PATH;
  if (named) {
    if (fs.existsSync(named)) return named;
    throw new Error(`CHROMIUM_PATH is set to ${named}, which does not exist`);
  }
  const tries = [
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  const hit = tries.find((p) => fs.existsSync(p));
  if (hit) return hit;
  throw new Error("no Chromium found — set CHROMIUM_PATH to a Chrome or Chromium binary");
};

const answers = async () => {
  try { return (await fetch(URL, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
};

/* Something already on the port would answer every request with whatever
   it is serving — a stale build, silently passing. --strictPort stops the
   new server binding but not the old one replying, so refuse up front. */
if (await answers()) {
  console.log(`FAIL something is already serving ${URL} — stop it first (a leaked preview server serves a stale build)`);
  process.exit(1);
}

/* Serve dist/. Spawned in its own process group so the whole group can be
   torn down: killing `npx` alone can leave the vite child holding the port. */
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: root, stdio: "ignore", detached: true,
});
const stopServer = () => {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ }
  try { server.kill("SIGTERM"); } catch { /* already gone */ }
};
process.on("exit", stopServer);

const up = async () => {
  for (let i = 0; i < 50; i++) {
    if (await answers()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};
if (!(await up())) { console.log("FAIL preview server never came up — run `npm run build` first"); stopServer(); process.exit(1); }

let browser;
try {
  browser = await chromium.launch({ executablePath: findChromium() });
} catch (e) {
  console.log("FAIL could not start a browser: " + e.message);
  stopServer();
  process.exit(1);
}

try {

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

/* ---- settings: the switches, the code, the import, the do-over ---- */
const page4 = await (await browser.newContext()).newPage();
page4.on("pageerror", (e) => fail("settings page error: " + e.message));
await page4.addInitScript((s) => localStorage.setItem("mantle:hero:v3", JSON.stringify(s)), { ...seeded, state: { ...seeded.state, flash: null } });
await page4.goto(URL);
await page4.waitForTimeout(1200);

await page4.getByRole("button", { name: "Settings", exact: true }).click();
await page4.waitForTimeout(200);
ok("the gear opens settings", (await page4.locator(".n-set").count()) === 1);

/* the export code is the career, tagged so it is obvious what it is */
const shown = await page4.locator('textarea[aria-label="Your save code"]').inputValue();
ok("a save code is offered", shown.startsWith("MANTLE1:") && shown.length > 40, shown.slice(0, 16));

/* a switch takes effect at once and is still set after a reload */
await page4.locator(".n-set-row", { hasText: "Headline ticker" }).getByRole("button", { name: "off" }).click();
await page4.waitForTimeout(200);
ok("the ticker switches off", (await page4.locator(".n-ticker").count()) === 0);
await page4.locator(".n-set-row", { hasText: "Numbers" }).getByRole("button", { name: "1.23e7" }).click();
await page4.waitForTimeout(200);
ok("numbers switch to scientific", /e\d/.test(await page4.locator(".n-stat.tone-cyan .n-val").innerText()), await page4.locator(".n-stat.tone-cyan .n-val").innerText());
await page4.reload();
await page4.waitForTimeout(1200);
ok("the switches survive a reload", (await page4.locator(".n-ticker").count()) === 0 && /e\d/.test(await page4.locator(".n-stat.tone-cyan .n-val").innerText()));

/* importing a code replaces the career it is pasted into */
const imported = "MANTLE1:" + Buffer.from(JSON.stringify({
  at: Date.now(),
  state: { ...seeded.state, hero: "nocturne", flash: null, own: { ...seeded.state.own, perch: 25 } },
})).toString("base64");
await page4.getByRole("button", { name: "Settings", exact: true }).click();
await page4.waitForTimeout(200);
await page4.locator('textarea[aria-label="Paste a save code"]').fill("not a save at all");
await page4.getByRole("button", { name: "Import", exact: true }).click();
await page4.getByRole("button", { name: /Confirm — replace/ }).click();
await page4.waitForTimeout(200);
ok("a code that isn't a save is refused", (await page4.locator(".n-set-note").count()) === 1 && (await page4.locator(".n-set").count()) === 1);
await page4.locator('textarea[aria-label="Paste a save code"]').fill(imported);
await page4.getByRole("button", { name: "Import", exact: true }).click();
await page4.getByRole("button", { name: /Confirm — replace/ }).click();
await page4.waitForTimeout(400);
ok("importing closes the panel", (await page4.locator(".n-set").count()) === 0);
/* the rail renders the hero's name uppercase, so match the text loosely */
ok("the imported career is the one on screen", /nocturne/i.test(await page4.locator(".n-who .n-key").first().innerText()), await page4.locator(".n-who .n-key").first().innerText());
const keptCode = await page4.evaluate(() => localStorage.getItem("mantle:hero:v3"));
ok("an import is written to storage at once", /nocturne/.test(keptCode || ""));

/* starting over is a do-over, not a prestige: back to hero select */
await page4.getByRole("button", { name: "Settings", exact: true }).click();
await page4.waitForTimeout(200);
await page4.getByRole("button", { name: "Start this career over", exact: true }).click();
await page4.getByRole("button", { name: /Confirm — start over/ }).click();
await page4.waitForTimeout(400);
ok("starting over lands at hero select", (await page4.locator(".n-hero").count()) === 4);

/* hero select can reach it too, which is how a save gets into a browser
   that has no career to open the tab bar with */
await page4.getByRole("button", { name: /Settings & save data/ }).click();
await page4.waitForTimeout(200);
ok("hero select can reach settings too", (await page4.locator(".n-set").count()) === 1);
await page4.locator(".n-set-row", { hasText: "Animations" }).getByRole("button", { name: "off" }).click();
await page4.waitForTimeout(200);
ok("animations switch off", (await page4.locator(".n.still").count()) === 1);
await page4.keyboard.press("Escape");
await page4.waitForTimeout(200);
ok("escape closes settings", (await page4.locator(".n-set").count()) === 0);

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
const drawn = (await page3.locator(".n-rite .n-hero-name").allInnerTexts()).join("|");

/* backing out is free, but it is not a way to deal a fresh hand */
await page3.getByRole("button", { name: /Not yet/ }).click();
await page3.waitForTimeout(200);
ok("backing out closes the estate", (await page3.locator(".n-rite").count()) === 0);
await page3.locator(".n-item", { hasText: "PASS THE COWL ON" }).click();
await page3.waitForTimeout(150);
await page3.locator(".n-item", { hasText: "TAP AGAIN TO CONFIRM" }).click();
await page3.waitForTimeout(300);
ok("reopening deals the same three", (await page3.locator(".n-rite .n-hero-name").allInnerTexts()).join("|") === drawn, drawn);

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

} catch (e) {
  fail("threw: " + (e && e.message ? e.message : e));
} finally {
  try { await browser.close(); } catch { /* already down */ }
  stopServer();
}

console.log(fails ? `\n${fails} FAILED` : "\nui all good");
process.exit(fails ? 1 : 0);
