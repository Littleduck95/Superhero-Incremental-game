/* Sanity checks for the engine: old saves, the storage ceiling, crew
   payroll, offline catch-up, project slices and the content tables.
     node scripts/sanity.mjs
   Exits non-zero on the first thing that is wrong. This is not a balance
   check — balance.mjs is — it only asserts that nothing is broken. */
import { E } from "./engine.mjs";

let fails = 0;
const ok = (name, cond, extra = "") => { if (!cond) { fails++; console.log("FAIL " + name + " " + extra); } else console.log("  ok  " + name); };
const finite = (o, where) => {
  for (const k in o) {
    const v = o[k];
    if (typeof v === "number" && !Number.isFinite(v) && v !== Infinity) { console.log("FAIL non-finite " + where + "." + k + " = " + v); fails++; }
    else if (v && typeof v === "object" && !Array.isArray(v)) finite(v, where + "." + k);
  }
};

/* 1. an old save, from before crew / storage / projects existed */
const old = { hero: "bastion", res: { leads: 500, salvage: 400, funding: 900, xp: 40 },
  own: { perch: 8, yard: 6, watch: 4, safehouse: 2, informants: 1, gym: 1, precinct: 0, tower: 0 },
  gear: { rig: 5, padding: 4 }, ranks: { impact: 3 }, tech: { scanners: true, haymaker: true },
  district: "docks", cleared: { flats: 40, docks: 3 }, totalXP: 900, legacy: 1, careerFunding: 5000, allTimeFunding: 5000 };
let s = E.migrate(old);
ok("migrate keeps hero", s.hero === "bastion");
ok("migrate seeds crew", s.crew && s.crew.n === 0 && typeof s.crew.jobs.beat === "number");
ok("migrate grants lockups so an old save has room", s.own.lockup > 0, "got " + s.own.lockup);
ok("migrate keeps the old boss gate", !!s.bosses.flats);
let d = E.derive(s);
ok("caps are real numbers", d.caps.funding > 0 && Number.isFinite(d.caps.funding), JSON.stringify(d.caps));

/* 2. live play: 4 hours at 1s a tick, no buying at all. `quiet` turns off
      random events, whose windfalls are allowed over the ceiling. */
s = { ...E.migrate(null), hero: "grayline", own: { ...E.freshState().own, perch: 4, yard: 3, watch: 2, safehouse: 3, lockup: 2 } };
for (let t = 0; t < 4 * 3600; t++) s = E.step(s, 1, { auto: true, quiet: true });
d = E.derive(s);
finite(s.res, "res"); finite(s.crew, "crew"); finite(s.market, "market");
ok("crew turn up to fill the beds", s.crew.n > 0 && s.crew.n <= d.beds, `${s.crew.n}/${d.beds}`);
ok("income stops at the ceiling", s.res.leads <= d.caps.leads + 1e-6, `${s.res.leads} vs ${d.caps.leads}`);
ok("payroll never drives funding negative", s.res.funding >= 0);
ok("the log filled and stayed capped", s.log.length > 0 && s.log.length <= E.TUNE.logKeep, "len " + s.log.length);
ok("crew put themselves to work", E.crewSplit(s).idle === 0, "idle " + E.crewSplit(s).idle);
ok("achievements fired", Object.keys(s.achieved).length > 0, JSON.stringify(Object.keys(s.achieved)));

/* 3. unpayable payroll: crew walk instead of the game breaking */
let broke = { ...E.migrate(null), hero: "grayline", res: { leads: 0, salvage: 0, funding: 0, xp: 0 } };
broke.own = { ...broke.own, safehouse: 6 };
broke.crew = { n: 25, grow: 0, unpaid: 0, jobs: { beat: 25, scavenge: 0, outreach: 0, sparring: 0, intel: 0 } };
for (let t = 0; t < 600; t++) broke = E.step(broke, 1, {});
ok("unpaid crew hand keys back", broke.crew.n < 25, "left with " + broke.crew.n);
ok("assignments shrink with the outfit", E.crewSplit(broke).n === broke.crew.n && E.crewSplit(broke).idle >= 0);

/* 4. offline catch-up: 24h in 240 slices, the way the loader does it */
let away = { ...E.migrate(null), hero: "kilowatt" };
away.own = { ...away.own, perch: 20, yard: 20, watch: 20, lockup: 10, safehouse: 4 };
const beforeLog = away.log.length;
for (let i = 0; i < 240; i++) away = E.step(away, (24 * 3600) / 240, {});
finite(away.res, "away.res");
d = E.derive(away);
ok("offline respects the ceiling", away.res.salvage <= d.caps.salvage + 1e-6);
ok("no events farmed while away", !(away.log.slice(beforeLog).some((l) => /payphone|envelope|container|council|chase|district is calling|quiet night/i.test(l.text))));
ok("market drifts back to par", Math.abs(away.market.leads - 1) < 1e-6);

/* 5. projects: slices accumulate and complete */
let w = { ...E.migrate(null), hero: "nocturne", res: { leads: 1e9, salvage: 1e9, funding: 1e9, xp: 0 } };
const pr = E.PROJECTS[0];
ok("a 10% slice costs a tenth of the whole", Math.abs(E.projectCost(pr, 0, 0.1).funding * 10 - E.projectCost(pr, 0, 1).funding) <= 10);
const most = E.projectMax(w, pr, 1);
ok("projectMax stays inside what is left", most > 0 && most <= 1, "max " + most.toFixed(3));

/* 6. every tech, job and project id is sane and reachable */
const ids = new Set();
for (const t of E.TECH) { ok("tech id unique: " + t.id, !ids.has(t.id)); ids.add(t.id); }
for (const t of E.TECH) for (const r of t.req) ok(`${t.id} requires a real node`, ids.has(r), r);
ok("every achievement has a test", E.ACHIEVEMENTS.every((a) => typeof a.test === "function"));
const fresh = E.freshState();
for (const a of E.ACHIEVEMENTS) { try { a.test(fresh, { level: 1 }); } catch (e) { fails++; console.log("FAIL achievement " + a.id + ": " + e.message); } }

console.log(fails ? `\n${fails} FAILED` : "\nall good");
process.exit(fails ? 1 : 0);
