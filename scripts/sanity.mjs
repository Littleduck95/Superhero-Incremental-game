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

/* 6. flashpoints: quiet play never rolls one, and a live one expires */
let fq = { ...E.migrate(null), hero: "grayline" };
for (let t = 0; t < 3600; t++) fq = E.step(fq, 1, { quiet: true });
ok("quiet play never rolls a flashpoint", !fq.flash);
let fl = { ...E.migrate(null), hero: "grayline", flash: { id: "alarm", left: 5 } };
fl = E.step(fl, 30, { quiet: true });
ok("a flashpoint expires on its own", !fl.flash);
ok("the miss makes the log", fl.log.some((l) => /vault/i.test(l.text)), JSON.stringify(fl.log));

/* 7. the bounty board: rolls, pays, streaks, and turns over at midnight */
let b = { ...E.migrate(null), hero: "grayline", bosses: { flats: true } };
b = E.contractTick(b, 1000) || b;
const eligible = E.CONTRACTS.filter((c) => !c.show || c.show(b, E.derive(b))).length;
ok("the board rolls a full slate", b.contracts && b.contracts.day === 1000 && b.contracts.list.length === Math.min(E.TUNE.contractsADay, eligible), JSON.stringify(b.contracts));
ok("contract ids are distinct", new Set(b.contracts.list.map((c) => c.id)).size === b.contracts.list.length);
ok("goals and pays are positive", b.contracts.list.every((c) => c.goal > 0 && Object.values(c.pay).every((v) => v > 0)));
ok("a fresh board changes nothing on the next tick", E.contractTick(b, 1000) === null);
b.contracts.list[0] = { id: "shoeleather", base: b.patrols || 0, goal: 5, pay: { funding: 777 }, done: false };
b.patrols = (b.patrols || 0) + 5;
const fundedBefore = b.res.funding;
b = E.contractTick(b, 1000) || b;
ok("a filled bounty pays out over the ceiling", b.contracts.list[0].done && b.res.funding - fundedBefore >= 777, `+${b.res.funding - fundedBefore}`);
ok("filling anything starts the streak", b.streak.days === 1 && b.streak.last === 1000, JSON.stringify(b.streak));
const g0 = E.derive({ ...b, streak: { days: 0, last: 0 } }).global;
const g5 = E.derive({ ...b, streak: { days: 5, last: 1000 } }).global;
ok("the streak is worth region", g5 > g0, `${g0} vs ${g5}`);
const b2 = E.contractTick(b, 1001) || b;
ok("midnight turns the board over", b2.contracts.day === 1001 && b2.contracts.list.every((c) => !c.done));
const b3 = E.contractTick(b, 1002) || b;
ok("a skipped day lapses the streak", b3.streak.days === 0, "days " + b3.streak.days);
for (const c of E.CONTRACTS) ok("contract metric exists: " + c.id, typeof E.METRICS[c.metric] === "function");
for (const k in E.METRICS) ok("metric is finite on a fresh save: " + k, Number.isFinite(E.METRICS[k](E.freshState())));

/* 8. midnight settles before it rolls: a goal crossed late still pays */
let late = { ...E.migrate(null), hero: "grayline", bosses: { flats: true } };
late = E.contractTick(late, 2000) || late;
late.contracts = { day: 2000, list: [{ id: "shoeleather", base: 0, goal: 5, pay: { funding: 555 }, done: false }] };
late.patrols = 5;
const lateBefore = late.res.funding;
late = E.contractTick(late, 2001) || late;
ok("a stale board settles before rolling over", late.res.funding - lateBefore >= 555, `+${late.res.funding - lateBefore}`);
ok("the late fill credits the day it was posted", late.streak.last === 2000 && late.streak.days === 1, JSON.stringify(late.streak));
ok("and the new day's board still rolls", late.contracts.day === 2001);

/* 9. goals never inflate off a passing boon */
let boony = { ...E.migrate(null), hero: "grayline", bosses: { flats: true } };
boony.own = { ...boony.own, watch: 10 };
const calm = (E.contractTick({ ...boony, boon: null }, 3000) || boony).contracts;
const hyped = (E.contractTick({ ...boony, boon: { id: "streak", mult: 2, left: 60 } }, 3000) || boony).contracts;
const calmLedger = calm.list.find((c) => c.id === "ledger");
const hypedLedger = hyped.list.find((c) => c.id === "ledger");
if (calmLedger && hypedLedger)
  ok("a live boon does not inflate goals", hypedLedger.goal === calmLedger.goal, `${hypedLedger.goal} vs ${calmLedger.goal}`);

/* 10. a weaker boon never downgrades a stronger one */
const strong = { id: "signal", mult: 2, left: 60 };
const merged = E.mergeBoon(strong, { id: "board", mult: 1.5, left: 600 });
ok("mergeBoon keeps the stronger multiplier", merged.mult === 2 && merged.left > 60, JSON.stringify(merged));
ok("mergeBoon converts a weak boon at equal value", Math.abs(merged.left - 360) < 1e-9, "left " + merged.left);
ok("mergeBoon upgrades to a stronger one", E.mergeBoon({ id: "quiet", mult: 1.35, left: 100 }, strong).mult === 2);
ok("mergeBoon takes a boon when none is live", E.mergeBoon(null, strong).mult === 2);

/* 11. a fast farmer's catch-up keeps its kills: with auto-fire disabling
      the batch fast-path, the loop budget settles the remainder instead
      of throwing hours of XP away */
let farm = { ...E.migrate(null), hero: "grayline", district: "flats" };
farm.gear = { ...farm.gear, rig: 2000, padding: 200 };
farm.tech = { haymaker: true };
const df = E.derive(farm, { auto: true });
const farmed = E.step(farm, 3600, { quiet: true, auto: true });
ok("a huge step keeps nearly all its kills", farmed.totalXP >= df.xpRate * 3600 * 0.8,
  `${farmed.totalXP} of ~${Math.round(df.xpRate * 3600)}`);

/* 12. offline catch-up goes through one shared policy */
let nap = { ...E.migrate(null), hero: "kilowatt" };
nap.own = { ...nap.own, perch: 20, yard: 20, watch: 20, lockup: 10 };
const woke = E.catchUp(nap, 24 * 3600);
ok("catchUp respects the ceiling", woke.res.salvage <= E.derive(woke).caps.salvage + 1e-6);
ok("catchUp rolls no events or flashpoints", !woke.flash && !woke.log.some((l) => /payphone|envelope|witness|silent alarm/i.test(l.text)));

/* 13. a garbage save loads as a game, not a crash or a NaN factory */
const junk = E.migrate({ hero: "grayline", ranks: null, totalXP: undefined, res: { leads: "x" },
  crew: { n: "9", jobs: "no" }, market: "abc", queue: {}, own: { perch: NaN }, streak: 7 });
const dj = E.derive(junk);
ok("garbage saves load finite", Number.isFinite(dj.global) && Number.isFinite(junk.res.leads) && Number.isFinite(junk.own.perch), JSON.stringify({ g: dj.global, leads: junk.res.leads }));
ok("garbage queue becomes a list", Array.isArray(junk.queue));
ok("garbage crew is countable", Number.isFinite(junk.crew.n) && Number.isFinite(junk.crew.jobs.beat));
const junkStep = E.step(junk, 60, { quiet: true });
ok("a scrubbed save steps cleanly", Number.isFinite(junkStep.res.funding) && Number.isFinite(junkStep.totalXP));

/* 14. every tech, job and project id is sane and reachable */
const ids = new Set();
for (const t of E.TECH) { ok("tech id unique: " + t.id, !ids.has(t.id)); ids.add(t.id); }
for (const t of E.TECH) for (const r of t.req) ok(`${t.id} requires a real node`, ids.has(r), r);
ok("every achievement has a test", E.ACHIEVEMENTS.every((a) => typeof a.test === "function"));
const fresh = E.freshState();
for (const a of E.ACHIEVEMENTS) { try { a.test(fresh, { level: 1 }); } catch (e) { fails++; console.log("FAIL achievement " + a.id + ": " + e.message); } }

console.log(fails ? `\n${fails} FAILED` : "\nall good");
process.exit(fails ? 1 : 0);
