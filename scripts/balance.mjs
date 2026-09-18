/* Balance check: a greedy bot plays a career and reports pacing.
     node scripts/balance.mjs [hours=48] [hero=grayline] [patrolRate=1]
   It bundles src/Mantle.jsx with esbuild (React stubbed out) and drives
   the exported engine one second at a time, buying whatever is cheapest
   in seconds-of-income, auto-firing abilities and taking bosses on when
   the forecast says they're won. Numbers are a ceiling on a human, not a
   promise — but if the bot can't do it, nobody can. */
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(os.tmpdir(), "mantle-engine.mjs");
await build({
  entryPoints: [path.join(here, "../src/Mantle.jsx")],
  bundle: true, format: "esm", outfile: out, jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime"],
});
fs.writeFileSync(path.join(os.tmpdir(), "react.js"), "export default {}; export const useState=0,useEffect=0,useRef=0,useCallback=0,useMemo=0;");
const stub = path.join(os.tmpdir(), "react-jsx-runtime.js");
fs.writeFileSync(stub, "export const jsx=0,jsxs=0,Fragment=0;");
let src = fs.readFileSync(out, "utf8")
  .replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(stub).href)}`)
  .replace(/from "react"/g, `from ${JSON.stringify(pathToFileURL(path.join(os.tmpdir(), "react.js")).href)}`);
fs.writeFileSync(out, src);
const { engine: E } = await import(pathToFileURL(out).href);

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
  return list;
}
const weight = (c, d) => Math.max(...Object.keys(c.cost).map((k) => c.cost[k] / Math.max(d.gross[k], 1e-6)));

function buy(s, c) {
  const res = { ...s.res };
  for (const k in c.cost) res[k] -= c.cost[k];
  if (c.kind === "own") return { ...s, res, own: { ...s.own, [c.item.id]: (s.own[c.item.id] || 0) + 1 } };
  if (c.kind === "gear") return { ...s, res, gear: { ...s.gear, [c.item.id]: (s.gear[c.item.id] || 0) + 1 } };
  if (c.kind === "rank") return { ...s, res, ranks: { ...s.ranks, [c.item.id]: (s.ranks[c.item.id] || 0) + 1 } };
  return { ...s, res, tech: { ...s.tech, [c.item.id]: true } };
}

const started = Date.now();
for (let t = 0; t < hours * 3600; t++) {
  s = E.step(s, 1, { auto: true, climb: true });
  if (patrolRate > 0 && t < 3600 * 2) {
    const gain = E.derive(s).patrol * patrolRate;
    s = { ...s, res: { ...s.res, leads: s.res.leads + gain, salvage: s.res.salvage + gain } };
  }
  /* buy the cheapest affordable thing, in seconds of income, a few times */
  for (let n = 0; n < 6; n++) {
    const d = E.derive(s);
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
  for (const id of ["haymaker", "brace", "secondwind", "surge", "triggers", "tempo", "threat", "mantle"])
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
console.log(`res: ` + Object.entries(s.res).map(([k, v]) => `${k} ${v.toExponential(1)}`).join(", "));
