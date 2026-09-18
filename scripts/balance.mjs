/* Balance check: a greedy bot plays a career and reports pacing.
     node scripts/balance.mjs [hours=48] [hero=grayline] [patrolRate=1]
   It drives the engine (see engine.mjs) one second at a time, buying
   whatever is cheapest in seconds-of-income, staffing the crew,
   auto-firing abilities and taking bosses on when the forecast says
   they're won. Numbers are a ceiling on a human, not a
   promise — but if the bot can't do it, nobody can. */
import { E } from "./engine.mjs";

const hours = Number(process.argv[2] || 48);
/* BOSS_HP=1.5 BOSS_DPS=1.2 BOSS_XP=0.5 scale every boss, for tuning runs */
for (const dist of E.DISTRICTS) {
  dist.boss.hp *= Number(process.env.BOSS_HP || 1);
  dist.boss.dps *= Number(process.env.BOSS_DPS || 1);
  dist.boss.xp *= Number(process.env.BOSS_XP || 1);
}
const heroId = process.argv[3] || "grayline";
const patrolRate = Number(process.argv[4] ?? 1);

let s = { ...E.freshState(), hero: heroId };
const log = [];
const seen = { boss: {}, reach: {}, gate: {}, tech: {} };
const clock = (t) => `${Math.floor(t / 3600)}h${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}m`;

function candidates(s, d) {
  const list = [];
  for (const t of E.TERRITORY) if (t.show(s)) list.push({ kind: "own", item: t, cost: E.costOf(t, s.own[t.id] || 0, 1, d.cut.terr) });
  for (const gi of E.GEAR) if (gi.show(s)) list.push({ kind: "gear", item: gi, cost: E.costOf(gi, s.gear[gi.id] || 0, 1, d.cut.gear) });
  for (const p of d.powers) list.push({ kind: "rank", item: p, cost: E.powerCost(p, s.ranks[p.id] || 0, d.cut.rank) });
  for (const t of E.TECH) if (!s.tech[t.id] && t.req.every((r) => s.tech[r])) list.push({ kind: "tech", item: t, cost: E.costOf(t, 0, 1, d.cut.tech) });
  if (s.tech.projects)
    for (const pr of E.PROJECTS) {
      const at = E.projectAt(s, pr);
      const share = Math.min(0.1, 1 - at.prog);
      list.push({ kind: "work", item: pr, share, cost: E.projectCost(pr, at.done, share, d.cut.tech) });
    }
  return list;
}
const weight = (c, d) => Math.max(...Object.keys(c.cost).map((k) => c.cost[k] / Math.max(d.gross[k], 1e-6)));

function buy(s, c) {
  const res = { ...s.res };
  for (const k in c.cost) res[k] -= c.cost[k];
  if (c.kind === "own") return { ...s, res, own: { ...s.own, [c.item.id]: (s.own[c.item.id] || 0) + 1 } };
  if (c.kind === "gear") return { ...s, res, gear: { ...s.gear, [c.item.id]: (s.gear[c.item.id] || 0) + 1 } };
  if (c.kind === "rank") return { ...s, res, ranks: { ...s.ranks, [c.item.id]: (s.ranks[c.item.id] || 0) + 1 } };
  if (c.kind === "work") {
    const at = E.projectAt(s, c.item);
    const prog = at.prog + c.share;
    const done = prog >= 1 - 1e-6;
    return { ...s, res, projects: { ...s.projects, [c.item.id]: done ? { done: at.done + 1, prog: 0 } : { done: at.done, prog } } };
  }
  return { ...s, res, tech: { ...s.tech, [c.item.id]: true } };
}

/* A full lockup is a hard stop: nothing else matters until there is room. */
function unstick(s, d) {
  if (!d.full.length) return null;
  const cost = E.costOf(E.TERRITORY.find((t) => t.id === "lockup"), s.own.lockup || 0, 1, d.cut.terr);
  return E.canPay(cost, s.res) ? { kind: "own", item: { id: "lockup" }, cost } : null;
}

/* New hands go to whichever job has the fewest on it. */
function staff(s) {
  const split = E.crewSplit(s);
  if (!split.idle) return s;
  const jobs = { ...split.jobs };
  for (let i = 0; i < split.idle; i++) {
    const thin = E.JOBS.reduce((a, b) => ((jobs[a.id] || 0) <= (jobs[b.id] || 0) ? a : b));
    jobs[thin.id] = (jobs[thin.id] || 0) + 1;
  }
  return { ...s, crew: { ...s.crew, jobs } };
}

const started = Date.now();
for (let t = 0; t < hours * 3600; t++) {
  s = E.step(s, 1, { auto: true, climb: true });
  if (patrolRate > 0 && t < 3600 * 2) {
    const dd = E.derive(s);
    const gain = dd.patrol * patrolRate;
    /* patrols are income: they stop at the ceiling, same as in the game,
       and never claw back a windfall already over it */
    const up = (k) => (s.res[k] >= dd.caps[k] ? s.res[k] : Math.min(dd.caps[k], s.res[k] + gain));
    s = { ...s, res: { ...s.res, leads: up("leads"), salvage: up("salvage") } };
  }
  s = staff(s);
  /* buy the cheapest affordable thing, in seconds of income, a few times */
  for (let n = 0; n < 6; n++) {
    const d = E.derive(s);
    const stuck = unstick(s, d);
    if (stuck) { s = buy(s, stuck); continue; }
    const ok = candidates(s, d).filter((c) => E.canPay(c.cost, s.res));
    if (!ok.length) break;
    ok.sort((a, b) => weight(a, d) - weight(b, d));
    s = buy(s, ok[0]);
  }
  for (const dist of E.DISTRICTS) {
    if (s.bosses[dist.id] && !seen.boss[dist.id]) { seen.boss[dist.id] = t; log.push([t, `BOSS DOWN  ${dist.boss.name} (${dist.name})`]); }
    if ((s.cleared[dist.id] || 0) >= dist.need && seen.gate[dist.id] === undefined) {
      seen.gate[dist.id] = t;
      const f = E.forecastBoss({ ...s, district: dist.id }, E.derive({ ...s, district: dist.id }, { auto: true }), true);
      log.push([t, `boss up    ${dist.boss.name}: ${f.win ? `would win in ${Math.round(f.time)}s with ${(f.left * 100).toFixed(0)}% left` : `would lose at ${(f.left * 100).toFixed(0)}%`}`]);
    }
    if (s.district === dist.id && seen.reach[dist.id] === undefined) { seen.reach[dist.id] = t; log.push([t, `reached    ${dist.name}`]); }
  }
  for (const id of ["haymaker", "brace", "secondwind", "surge", "triggers", "tempo", "threat", "mantle", "fence", "projects", "command", "vault"])
    if (s.tech[id] && !seen.tech[id]) { seen.tech[id] = t; log.push([t, `tech       ${id}`]); }
}
const d = E.derive(s);
console.log(`hero ${heroId}, ${hours}h simulated in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
for (const [t, m] of log) console.log(`${clock(t).padStart(7)}  ${m}`);
console.log("\ndistrict        old gate   boss down   forecast now");
for (const dist of E.DISTRICTS) {
  const f = E.forecastBoss({ ...s, district: dist.id }, E.derive({ ...s, district: dist.id }, { auto: true }), true);
  console.log(`${dist.name.padEnd(15)} ${(seen.gate[dist.id] !== undefined ? clock(seen.gate[dist.id]) : "—").padStart(8)}   ${(seen.boss[dist.id] !== undefined ? clock(seen.boss[dist.id]) : "—").padStart(9)}   ${f.win ? `win ${Math.round(f.time)}s` : `lose at ${(f.left * 100).toFixed(0)}%`}`);
}
console.log(`\nend: level ${d.level}, power ${d.power.toFixed(0)}, resolve ${d.resolve.toFixed(0)}, tech ${d.techDone}/${E.TECH.length}, region ${d.region}, safehouses ${s.own.safehouse}, floors ${s.own.gym}, held ${d.held}`);
console.log(`crew ${d.crew.n}/${d.beds} (payroll ${d.upkeep.toExponential(1)}/s), lockups ${s.own.lockup}, works ${d.projDone}, badges ${d.badges}/${E.ACHIEVEMENTS.length}`);
console.log(`res: ` + Object.entries(s.res).map(([k, v]) => `${k} ${v.toExponential(1)}`).join(", "));
console.log(`cap: ` + Object.entries(d.caps).map(([k, v]) => `${k} ${Number(v).toExponential(1)}`).join(", ") + (d.full.length ? `  FULL: ${d.full.join(", ")}` : ""));
