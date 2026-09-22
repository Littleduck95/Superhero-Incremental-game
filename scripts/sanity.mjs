/* Sanity checks for the engine: old saves, the storage ceiling, crew
   payroll, offline catch-up, project slices and the content tables.
     node scripts/sanity.mjs
   Runs every check and exits non-zero if any of them failed. This is not a balance
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
/* a project is a count and a slice, and both feed multipliers on
   everything: junk in either used to turn the whole game into NaN */
const junkWorks = E.migrate({ hero: "grayline", tech: { projects: true },
  projects: { beacon: { done: "x", prog: "y" }, ward: { done: -4, prog: 9 }, spire: 7, nonesuch: { done: 3 } } });
const dw = E.derive(junkWorks);
ok("a junk project can't NaN the game", [dw.global, dw.power, dw.resolve, dw.caps.leads, dw.gross.funding].every(Number.isFinite),
  JSON.stringify({ g: dw.global, p: dw.power, cap: dw.caps.leads }));
ok("a junk project slice is clamped inside the next one", E.projectAt(junkWorks, E.PROJECTS.find((p) => p.id === "ward")).prog < 1);
ok("an unknown project is dropped", !("nonesuch" in junkWorks.projects) && !("spire" in junkWorks.projects), JSON.stringify(junkWorks.projects));
/* the career counters multiply the region and set the ceilings: a save
   claiming negative legacy ran every one of them backwards */
const junkCareer = E.migrate({ hero: "grayline", legacy: -1000, totalXP: -5e6, careerFunding: -1e9,
  traded: -7, patrols: -3, runs: -2, time: -50, streak: { days: -50, last: -9 } });
const dc = E.derive(junkCareer);
ok("a negative career can't run the region backwards", dc.global > 0 && dc.caps.leads > 0 && dc.patrol > 0,
  `global ${dc.global} caps ${dc.caps.leads} patrol ${dc.patrol}`);
ok("and the counters themselves are scrubbed",
  junkCareer.legacy === 0 && junkCareer.totalXP === 0 && junkCareer.careerFunding === 0 && junkCareer.streak.days === 0);
/* crewSplit clamps on read, but the tick works the raw map */
const junkJobs = E.migrate({ hero: "grayline", crew: { n: 5, jobs: { beat: -4, scavenge: 2.7 } } });
ok("junk crew assignments are scrubbed at load",
  junkJobs.crew.jobs.beat === 0 && junkJobs.crew.jobs.scavenge === 2, JSON.stringify(junkJobs.crew.jobs));
/* an invalid slice is not progress: clamping it up handed over a project */
const junkProg = E.migrate({ hero: "grayline", projects: { ward: { done: -4, prog: 9 } } });
ok("an impossible project slice is not free progress", E.projectAt(junkProg, E.PROJECTS.find((p) => p.id === "ward")).prog === 0,
  JSON.stringify(junkProg.projects));
const keptProg = E.migrate({ hero: "grayline", projects: { ward: { done: 2, prog: 0.4 } } });
ok("a real project slice is kept", keptProg.projects.ward.done === 2 && Math.abs(keptProg.projects.ward.prog - 0.4) < 1e-9);

/* migrate scrubs in place, so the state it returns must be its own */
const shared = { hero: "grayline", ranks: { impact: 3.7 }, cleared: { flats: 9.2 }, keepsakes: { bag: 2.5 }, queue: [], log: [] };
const migrated = E.migrate(shared);
ok("migrate never writes back through the save it was handed",
  shared.ranks.impact === 3.7 && shared.cleared.flats === 9.2 && shared.keepsakes.bag === 2.5,
  JSON.stringify({ r: shared.ranks, c: shared.cleared, k: shared.keepsakes }));
ok("and shares no mutable part of it",
  migrated.ranks !== shared.ranks && migrated.cleared !== shared.cleared
  && migrated.keepsakes !== shared.keepsakes && migrated.queue !== shared.queue && migrated.log !== shared.log);

/* nothing you hold runs backwards */
const junkNeg = E.migrate({ hero: "grayline", res: { leads: -500, funding: -1e9 }, own: { perch: -20, lockup: 2.7 }, gear: { rig: -8 }, ranks: { impact: -3 } });
ok("negative holdings are scrubbed", junkNeg.res.leads === 0 && junkNeg.own.perch === 0 && junkNeg.gear.rig === 0 && junkNeg.ranks.impact === 0);
ok("fractional holdings are whole", junkNeg.own.lockup === 2);
/* the bisecting max-buy has to land where walking the costs landed */
for (const item of [...E.TERRITORY, ...E.GEAR]) {
  const res = { leads: 4e6, salvage: 4e6, funding: 4e6, xp: 4e6 };
  let walked = 0;
  while (walked < 1000 && E.canPay(E.costOf(item, 7, walked + 1, 1), res)) walked++;
  ok("max buy bisects to the same count: " + item.id, E.maxAffordable(item, 7, res, 1) === walked,
    `${E.maxAffordable(item, 7, res, 1)} vs ${walked}`);
}

/* 14. ownership marks double producers, and only producers */
let ms = { ...E.migrate(null), hero: "grayline" };
const at24 = E.derive({ ...ms, own: { ...ms.own, perch: 24 } }).gross.leads / 24;
const at25 = E.derive({ ...ms, own: { ...ms.own, perch: 25 } }).gross.leads / 25;
ok("the 25th perch doubles the lot", Math.abs(at25 / at24 - 2) < 1e-9, `${at24} -> ${at25}`);
ok("marks count correctly", E.msCrossed(24) === 0 && E.msCrossed(25) === 1 && E.msCrossed(400) === 6 && E.msCrossed(500) === 7);
ok("the next mark is always ahead", E.msNext(0) === 25 && E.msNext(25) === 50 && E.msNext(400) === 500 && E.msNext(650) === 700);
const capsAt = (n) => E.derive({ ...ms, own: { ...ms.own, lockup: n } }).caps.funding;
ok("lockups take no marks", Math.abs((capsAt(25) - capsAt(24)) - (capsAt(24) - capsAt(23))) < 2, "storage steps stay even");

/* 15. keepsakes apply, stack, and survive the numbers */
const bare = E.derive({ ...ms, own: { ...ms.own, perch: 10 } });
const kitted = E.derive({ ...ms, own: { ...ms.own, perch: 10 }, keepsakes: { bag: 1, cowl: 1, frequencies: 2 } });
ok("keepsakes raise power and resolve", Math.abs(kitted.power / bare.power - 1.2) < 1e-9 && Math.abs(kitted.resolve / bare.resolve - 1.25) < 1e-9);
ok("keepsakes stack per copy", Math.abs(kitted.gross.leads / bare.gross.leads - 1.4) < 1e-9, `${kitted.gross.leads / bare.gross.leads}`);
ok("every keepsake id is distinct", new Set(E.KEEPSAKES.map((k) => k.id)).size === E.KEEPSAKES.length);
const junkKeep = E.migrate({ hero: "grayline", keepsakes: { bag: "x", clock: -30, cowl: 2.7, nonesuch: 5 }, estate: { picks: ["bag", "made-up"] } });
ok("junk keepsake counts are scrubbed", junkKeep.keepsakes.bag === 0 && junkKeep.keepsakes.clock === 0 && junkKeep.keepsakes.cowl === 2);
const dk = E.derive(junkKeep);
ok("a junk estate can't poison the stats", Number.isFinite(dk.power) && Number.isFinite(dk.resolve) && Number.isFinite(dk.cdMult) && dk.cdMult > 0);
ok("an unknown keepsake is ignored", Number.isFinite(dk.kpCount) && dk.kpCount === 2, "count " + dk.kpCount);
ok("a drawn estate keeps only real ids", junkKeep.estate.picks.join() === "bag", junkKeep.estate.picks.join());

/* 16. the crew board: a hand can always be moved, idle or not. Crew put
      themselves to work the moment they walk in, so a board that could
      only spend idle hands was a board nobody could ever use. */
const outfit = (n, jobs) => ({
  ...E.migrate(null), hero: "grayline",
  own: { ...E.freshState().own, safehouse: 4 },
  crew: { n, grow: 0, unpaid: 0, jobs: { beat: 0, scavenge: 0, outreach: 0, sparring: 0, intel: 0, ...jobs } },
});
const sum = (jobs) => E.JOBS.reduce((t, j) => t + (jobs[j.id] || 0), 0);

const packed = outfit(8, { beat: 8 });
ok("nobody is idle with the whole outfit on one job", E.crewSplit(packed).idle === 0);
let moved = E.assignCrew(packed, "scavenge", 1);
ok("+ moves a hand with nobody idle", moved && moved.scavenge === 1 && moved.beat === 7, JSON.stringify(moved));
ok("+ moves one hand, not two", moved && sum(moved) === 8, JSON.stringify(moved));

const evened = outfit(8, { beat: 5, scavenge: 3 });
ok("+ pulls off the fullest job", E.assignCrew(evened, "intel", 1).beat === 4);
ok("all takes the whole outfit", sum(E.assignCrew(evened, "outreach", "max")) === 8 && E.assignCrew(evened, "outreach", "max").outreach === 8);
ok("none stands a job down", E.assignCrew(evened, "beat", "none").beat === 0);
ok("- frees a hand rather than moving one", E.assignCrew(evened, "beat", -1).beat === 4 && sum(E.assignCrew(evened, "beat", -1)) === 7);

ok("+ on a job that already holds everyone is a no-op", E.assignCrew(packed, "beat", 1) === null);
ok("all on a job that already holds everyone is a no-op", E.assignCrew(packed, "beat", "max") === null);
ok("- on an empty job is a no-op", E.assignCrew(packed, "intel", -1) === null);
ok("an empty outfit has nothing to move", E.assignCrew(outfit(0, {}), "beat", 1) === null && E.assignCrew(outfit(0, {}), "beat", "max") === null);

const idling = outfit(8, { beat: 2 });
ok("idle hands go first", E.assignCrew(idling, "intel", 1).beat === 2 && E.assignCrew(idling, "intel", 1).intel === 1);
ok("all sweeps up the idle too", E.assignCrew(idling, "intel", "max").intel === 8);

/* an overstuffed save (a safehouse lost, a hand walked) is clamped on read,
   and a move off it can never conjure people who left */
const overstuffed = outfit(3, { beat: 9, scavenge: 4 });
ok("a stale assignment is clamped before it is moved", sum(E.assignCrew(overstuffed, "intel", "max")) === 3);
ok("clamped moves keep the outfit whole", E.assignCrew(overstuffed, "intel", 1) && sum(E.assignCrew(overstuffed, "intel", 1)) === 3);

/* the tick must not undo the player: a choice survives live play */
let chosen = outfit(8, { beat: 8 });
chosen = { ...chosen, crew: { ...chosen.crew, jobs: E.assignCrew(chosen, "sparring", "max") } };
chosen.res = { leads: 0, salvage: 0, funding: 1e9, xp: 0 };
for (let t = 0; t < 120; t++) chosen = E.step(chosen, 1, { quiet: true });
ok("the tick keeps the player's assignment", chosen.crew.jobs.sparring >= 8, JSON.stringify(chosen.crew.jobs));
ok("new hands still put themselves to work", E.crewSplit(chosen).idle === 0, "idle " + E.crewSplit(chosen).idle);

/* 17. the XP readout has to match the fight it is describing, and the
      batched settle has to pay what simulating every kill would. A hit
      is worth one kill however big it lands, so counting a Training
      Floor's whole overkill had the readout — and the catch-up that
      settles off it — promising kills the fight could never deliver. */
const fighter = (terr, gear, rank, gym, district) => {
  const f = { ...E.migrate(null), hero: "grayline" };
  for (const t of E.TERRITORY) f.own[t.id] = terr;
  f.own.gym = gym;
  for (const gi of E.GEAR) f.gear[gi.id] = gear;
  for (const pw of E.POWERS) f.ranks[pw.id] = rank;
  f.res = { leads: 9e12, salvage: 9e12, funding: 9e14, xp: 9e9 };
  f.totalXP = 1e7;
  for (const dist of E.DISTRICTS) f.bosses[dist.id] = true;
  for (const a of E.ABILITIES) f.tech[a.tech] = true;
  f.tech.triggers = true;
  f.district = district;
  return f;
};
const ranAt = (f, slices) => {
  let b = f;
  for (let i = 0; i < slices; i++) b = E.step(b, 1, { quiet: true });
  return Object.values(b.cleared).reduce((a, c) => a + c, 0);
};
/* The readout check has to simulate every kill, or it compares ttkEff
   against kills the settle awarded off ttkEff and can never fail. */
const realBatch0 = E.TUNE.killBatch, realSteps0 = E.TUNE.fightSteps;
for (const [label, f] of [["mid", fighter(25, 15, 10, 4, "docks")], ["endgame", fighter(120, 80, 40, 120, "docks")]]) {
  const dd = E.derive(f);
  const promised = 1 / dd.ttkEff;
  E.TUNE.killBatch = Infinity;
  E.TUNE.fightSteps = 1e9;
  const real = ranAt(f, 20) / 20;
  E.TUNE.killBatch = realBatch0;
  E.TUNE.fightSteps = realSteps0;
  ok(`the XP readout matches the fight (${label})`, real > promised * 0.6 && real < promised * 1.5,
    `promised ${promised.toFixed(1)}/s, ran at ${real.toFixed(1)}/s`);
}
/* A tap is the player's move and the shortcut must not swallow it: the
   settle skipped the ability loop outright, so in a fast enough fight a
   tapped ability did nothing at all — no damage, no buff, no cooldown. */
const tapper = fighter(120, 80, 40, 120, "flats");
const tappedIn = { ...tapper, fight: { ...tapper.fight, cast: ["surge"] } };
const realBatch1 = E.TUNE.killBatch, realSteps1 = E.TUNE.fightSteps;
const tappedOut = E.step(tappedIn, 1, { quiet: true });
E.TUNE.killBatch = Infinity;
E.TUNE.fightSteps = 1e9;
const tappedFull = E.step(tappedIn, 1, { quiet: true });
E.TUNE.killBatch = realBatch1;
E.TUNE.fightSteps = realSteps1;
ok("a tapped ability fires even in a settled slice", (tappedOut.fight.cd.surge || 0) > 0,
  `cd ${JSON.stringify(tappedOut.fight.cd)} buff ${JSON.stringify(tappedOut.fight.buff)}`);
ok("and fires exactly as it would if every kill were simulated",
  Math.abs((tappedOut.fight.cd.surge || 0) - (tappedFull.fight.cd.surge || 0)) < 1e-6,
  `${tappedOut.fight.cd.surge} vs ${tappedFull.fight.cd.surge}`);

/* the cut-over is a rate, so it must not move with the slice length */
const rated = fighter(120, 80, 40, 120, "docks");
const perSlice = [0.1, 1, 60].map((dt) => {
  let b = rated;
  for (let i = 0; i < 60 / dt; i++) b = E.step(b, dt, { quiet: true });
  return Object.values(b.cleared).reduce((a, c) => a + c, 0);
});
ok("60 seconds pays the same however it is sliced",
  perSlice.every((v) => Math.abs(v - perSlice[0]) <= perSlice[0] * 0.05), perSlice.join(" / "));

/* the batch is a shortcut, not a payout: it must land where the full
   simulation lands.
     The settle runs on an average, so it can only be fair over a window
   long enough to average. A fight opens with everything off cooldown, so
   it gets one activation the steady rate never pays for, and Surge's
   cycle is now its run plus the recharge that follows it — four of them
   in thirty seconds, which made that one opening worth three percent of
   the whole window. Five minutes is the steady state being modelled. */
const batched = fighter(120, 80, 40, 120, "flats");
const withBatch = ranAt(batched, 300);
const realBatch = E.TUNE.killBatch;
E.TUNE.killBatch = Infinity;
const without = ranAt(batched, 300);
E.TUNE.killBatch = realBatch;
ok("the batched settle pays what simulating every kill pays",
  Math.abs(withBatch - without) <= without * 0.02, `${withBatch} vs ${without}`);
/* The shortcut is for trash only: a boss is one foe, and settling one at
   the trash rate would hand out a district's worth of kills a second.
   The Broker outlasts a slice for this hero, so while he is up nothing
   else should be dying. */
const bossOn = { ...fighter(12, 6, 4, 1, "midtown"), cleared: {} };
const bossFight = { ...bossOn, fight: E.startBoss(E.derive(bossOn)) };
const afterBoss = E.step(bossFight, 1, { quiet: true });
ok("a boss holds the fight for the whole slice", afterBoss.fight.boss === true, JSON.stringify(afterBoss.fight).slice(0, 90));
ok("no trash is settled while a boss is up", (afterBoss.cleared.midtown || 0) === 0, "kills " + afterBoss.cleared.midtown);
ok("the boss fight is simulated, both ways", afterBoss.fight.enemyHP < bossFight.fight.enemyHP
  && afterBoss.fight.heroHP < bossFight.fight.heroHP,
  `boss ${bossFight.fight.enemyHP} -> ${afterBoss.fight.enemyHP}, hero ${bossFight.fight.heroHP} -> ${afterBoss.fight.heroHP}`);

/* 18. every tech, job and project id is sane and reachable */
const ids = new Set();
for (const t of E.TECH) { ok("tech id unique: " + t.id, !ids.has(t.id)); ids.add(t.id); }
for (const t of E.TECH) for (const r of t.req) ok(`${t.id} requires a real node`, ids.has(r), r);
ok("every achievement has a test", E.ACHIEVEMENTS.every((a) => typeof a.test === "function"));
const fresh = E.freshState();
for (const a of E.ACHIEVEMENTS) { try { a.test(fresh, { level: 1 }); } catch (e) { fails++; console.log("FAIL achievement " + a.id + ": " + e.message); } }

/* 19. a timed ability recharges after it drops, not through itself */
const bracer = fighter(30, 20, 10, 0, "flats");
bracer.tech = { ...bracer.tech, triggers: false };
const bd = E.derive(bracer);
const braceA = bd.abilities.find((a) => a.id === "brace");
const hayA = bd.abilities.find((a) => a.id === "haymaker");
ok("a timed ability's cycle is its run plus its recharge",
  Math.abs(braceA.cycle - (braceA.cd + braceA.dur)) < 1e-9, `${braceA.cycle} vs ${braceA.cd} + ${braceA.dur}`);
ok("an instant one has nothing to wait through", Math.abs(hayA.cycle - hayA.cd) < 1e-9, `${hayA.cycle} vs ${hayA.cd}`);

const braced = E.step({ ...bracer, fight: { ...bracer.fight, cast: ["brace"] } }, 0.5, { quiet: true });
ok("firing it banks the whole cycle",
  Math.abs((braced.fight.cd.brace || 0) - (braceA.cycle - 0.5)) < 1e-6, `${braced.fight.cd.brace} vs ${braceA.cycle - 0.5}`);
ok("so the recharge still owed when it drops is the whole recharge",
  Math.abs((braced.fight.cd.brace || 0) - (braced.fight.buff.brace || 0) - braceA.cd) < 1e-6,
  `cd ${braced.fight.cd.brace} buff ${braced.fight.buff.brace} vs ${braceA.cd}`);
let held = braced;
for (let i = 0; i < 200 && (held.fight.buff.brace || 0) > 0; i++) held = E.step(held, 0.25, { quiet: true });
ok("and the clock the player watches only starts then",
  !(held.fight.buff.brace > 0) && (held.fight.cd.brace || 0) > braceA.cd - 0.25 - 1e-6
    && (held.fight.cd.brace || 0) <= braceA.cd + 1e-6,
  `cd ${held.fight.cd.brace} vs ${braceA.cd}`);

/* cut short, it hands back the seconds it never got to spend */
const weak = fighter(1, 0, 0, 0, "midtown");
weak.tech = { ...weak.tech, triggers: false };
const wd = E.derive(weak);
const wBrace = wd.abilities.find((a) => a.id === "brace");
let dropped = { ...weak, fight: { ...E.startBoss(wd), cast: ["brace"] } };
let spent = 0;
while (dropped.fight.ko <= 0 && spent < 20) { dropped = E.step(dropped, 0.1, { quiet: true }); spent += 0.1; }
ok("a guard cut short by a knockout hands the unspent recharge back",
  dropped.fight.ko > 0 && spent < wBrace.dur && !dropped.fight.boss
    && Math.abs((dropped.fight.cd.brace || 0) - wBrace.cd) <= 0.1 + 1e-6,
  `down at ${spent.toFixed(1)}s, cd ${dropped.fight.cd.brace} vs ${wBrace.cd}`);

/* 20. power ranks buy in bulk on the Ops buy modes */
const impact = E.POWERS.find((p) => p.id === "impact");
let singles = 0;
for (let i = 0; i < 10; i++) singles += E.powerCost(impact, 3 + i).xp;
ok("ten ranks cost what ten singles cost", E.powerCostN(impact, 3, 10).xp === singles,
  `${E.powerCostN(impact, 3, 10).xp} vs ${singles}`);
ok("a run of one is just the rank", E.powerCostN(impact, 7, 1).xp === E.powerCost(impact, 7).xp);
ok("a run of none is free", E.powerCostN(impact, 7, 0).xp === 0);
const purse = { xp: E.powerCostN(impact, 0, 6).xp };
ok("max takes every rank the XP covers", E.powerMax(impact, 0, purse) === 6, "got " + E.powerMax(impact, 0, purse));
ok("and never the one it does not", E.powerCostN(impact, 0, 7).xp > purse.xp);
ok("no XP buys no ranks", E.powerMax(impact, 0, { xp: 0 }) === 0);
ok("the Mind discount carries through a whole run",
  E.powerCostN(impact, 0, 5, 0.5).xp < E.powerCostN(impact, 0, 5).xp &&
  E.powerMax(impact, 0, purse, 0.5) > E.powerMax(impact, 0, purse));

console.log(fails ? `\n${fails} FAILED` : "\nall good");
process.exit(fails ? 1 : 0);
