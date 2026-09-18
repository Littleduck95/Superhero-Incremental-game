import React, { useState, useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ *
 *  MANTLE — pick a hero, hold a city, get stronger
 *
 *    REGION   buildings produce leads, salvage and funding
 *    FIGHT    an auto battler. Gear wins fights; fights are the only
 *             source of XP
 *    POWERS   ranks bought with XP, multiplying region and combat
 *    TECH     a four-branch tree. Street makes the region richer and
 *             cheaper, Body and Mind amplify what you already own, and
 *             Ops unlocks the quality-of-life the game withholds at
 *             the start: bulk buying, the build queue, auto-patrol,
 *             auto-climb and longer offline time
 * ------------------------------------------------------------------ */

/* ============================ CONTENT ============================= */

const RESOURCES = [
  { id: "leads", name: "Leads", tone: "cyan" },
  { id: "salvage", name: "Salvage", tone: "steel" },
  { id: "funding", name: "Funding", tone: "signal" },
  { id: "xp", name: "XP", tone: "magenta" },
];

const HEROES = [
  {
    id: "grayline", name: "Grayline",
    epithet: "Moves faster than the report of it.",
    perk: "Patrols bring back twice as much.",
    mods: { patrol: 2 },
    signature: { id: "afterimage", name: "Afterimage", target: "patrol", per: 0.45, base: 30, growth: 1.46, blurb: "Each rank leaves one more of you on the street." },
  },
  {
    id: "kilowatt", name: "Kilowatt",
    epithet: "Runs the city grid as a second nervous system.",
    perk: "The region brings in 40% more funding.",
    mods: { funding: 1.4 },
    signature: { id: "siphon", name: "Grid Siphon", target: "funding", per: 0.4, base: 45, growth: 1.46, blurb: "Every meter in the district reads a little low." },
  },
  {
    id: "bastion", name: "Bastion",
    epithet: "The thing villains break themselves on.",
    perk: "Everything costs 20% less, and you start twice as tough.",
    mods: { cost: 0.8, resolve: 2 },
    signature: { id: "immovable", name: "Immovable", target: "resolve", per: 0.5, base: 40, growth: 1.46, blurb: "Nothing moves you, so everything breaks on you." },
  },
  {
    id: "nocturne", name: "Nocturne",
    epithet: "Has never once been photographed.",
    perk: "Leads come in twice as fast.",
    mods: { leads: 2 },
    signature: { id: "blackout", name: "Blackout", target: "power", per: 0.45, base: 34, growth: 1.45, blurb: "They never land one, because they never see one." },
  },
];

const POWERS = [
  { id: "reflex", name: "Reflex", target: "patrol", per: 0.3, base: 10, growth: 1.42, blurb: "Every rank makes a sweep cover more ground." },
  { id: "impact", name: "Impact", target: "power", per: 0.3, base: 14, growth: 1.55, blurb: "Hit harder, end it sooner." },
  { id: "endurance", name: "Endurance", target: "resolve", per: 0.3, base: 18, growth: 1.55, blurb: "Stay standing long enough to finish." },
  { id: "perception", name: "Perception", target: "leads", per: 0.25, base: 26, growth: 1.43, blurb: "You notice the one thing that's out of place." },
  { id: "strength", name: "Strength", target: "salvage", per: 0.25, base: 32, growth: 1.43, blurb: "Heavier wreckage, far fewer trips." },
  { id: "presence", name: "Presence", target: "funding", per: 0.25, base: 50, growth: 1.44, blurb: "People fund what they already trust." },
  { id: "instinct", name: "Instinct", target: "xp", per: 0.25, base: 80, growth: 1.45, blurb: "You take more away from every fight." },
];

const DISTRICTS = [
  { id: "flats", name: "The Flats", hp: 20, dps: 0.5, xp: 6, need: 0, foes: ["Corner Muggers", "Bag Snatcher", "Two Drunks"] },
  { id: "docks", name: "Dockside", hp: 140, dps: 2.5, xp: 126, need: 10, foes: ["Wharf Crew", "Container Thieves", "The Harbourman"] },
  { id: "railyards", name: "Rail Yards", hp: 1000, dps: 13, xp: 2700, need: 15, foes: ["Coupler Gang", "Switchback", "Freight Raiders"] },
  { id: "midtown", name: "Midtown", hp: 7000, dps: 65, xp: 56000, need: 20, foes: ["Armoured Car Crew", "The Broker", "Glasshouse Jumpers"] },
  { id: "spire", name: "Spire District", hp: 50000, dps: 330, xp: 1200000, need: 25, foes: ["Private Security", "Vault Runners", "Mr. Ardent"] },
  { id: "undercity", name: "The Undercity", hp: 360000, dps: 1700, xp: 26000000, need: 30, foes: ["Tunnel Pack", "The Sump King", "Something Older"] },
  { id: "aboveline", name: "Above the Line", hp: 2600000, dps: 8500, xp: 560000000, need: 35, foes: ["Orbital Mercs", "The Consortium", "Halo Squad"] },
  { id: "breach", name: "The Breach", hp: 19000000, dps: 43000, xp: 12000000000, need: 40, foes: ["The Other Side", "A Walking Fault", "Nothing With A Name"] },
];

const GEAR = [
  { id: "rig", name: "Knuckle Rig", stat: "power", per: 1.5, base: { salvage: 20 }, growth: 1.18, show: () => true, blurb: "Weighted, wrapped, illegal in eleven states." },
  { id: "padding", name: "Body Padding", stat: "resolve", per: 14, base: { salvage: 30 }, growth: 1.18, show: () => true, blurb: "Takes the hit so your ribs don't." },
  { id: "trophy", name: "Trophy Case", stat: "xp", per: 0.2, base: { funding: 300 }, growth: 1.25, show: (s) => s.own.watch >= 1, blurb: "You learn more when you keep what you beat." },
  { id: "exo", name: "Exo Frame", stat: "both", power: 16, resolve: 80, base: { funding: 1200, leads: 700 }, growth: 1.22, show: (s) => !!s.tech.servo, blurb: "Servo-assisted everything, including the parts that hurt." },
];

const TERRITORY = [
  { id: "perch", name: "Rooftop Perch", makes: "leads", rate: 0.5, base: { salvage: 12 }, growth: 1.15, show: () => true, blurb: "A clear sightline over four blocks." },
  { id: "yard", name: "Scrap Yard", makes: "salvage", rate: 0.45, base: { leads: 18 }, growth: 1.15, show: (s) => s.own.perch >= 1, blurb: "Wreckage comes to you instead of the other way round." },
  { id: "watch", name: "Block Watch", makes: "funding", rate: 0.35, base: { leads: 40, salvage: 70 }, growth: 1.15, show: (s) => s.own.yard >= 2, blurb: "The neighbourhood decides to chip in." },
  { id: "informants", name: "Informant Network", makes: "leads", rate: 4, base: { funding: 800, salvage: 400 }, growth: 1.16, show: (s) => s.own.watch >= 3, blurb: "Forty people who owe you, and one who doesn't." },
  { id: "precinct", name: "Precinct Liaison", makes: "funding", rate: 3.5, base: { funding: 1500, leads: 900 }, growth: 1.17, show: (s) => s.own.informants >= 2, blurb: "A badge who picks up when you call." },
  { id: "tower", name: "Signal Tower", makes: null, base: { funding: 30000, salvage: 10000, leads: 7000 }, growth: 1.22, show: (s) => !!s.tech.uplink, blurb: "Each tower lifts everything you hold." },
];

/* ---------------------------- the tree ---------------------------- *
 *  branch + tier drive the layout; req drives the wiring.
 *  amp   doubles a power's per-rank value
 *  mult  multiplies a building (or "all" of them)
 *  cost  is flat — tech is bought once
 * ------------------------------------------------------------------ */
const BRANCHES = [
  { id: "street", name: "Street", blurb: "Makes the region richer, and cheaper to expand." },
  { id: "body", name: "Body", blurb: "Amplifies the powers and gear you fight with." },
  { id: "mind", name: "Mind", blurb: "Amplifies the powers your region runs on, and makes ranks cheaper." },
  { id: "ops", name: "Ops", blurb: "Everything that saves you clicks: bulk buying, the queue, automation." },
];

const TECH = [
  /* ---- STREET: the old stuff, but better and cheaper ---- */
  { id: "scanners", branch: "street", tier: 1, name: "Police Scanners", req: [], cost: { salvage: 400, leads: 200 }, mult: { perch: 2 }, effect: "Rooftop perches produce twice as much." },
  { id: "rights", branch: "street", tier: 1, name: "Salvage Rights", req: [], cost: { leads: 500, salvage: 250 }, mult: { yard: 2 }, effect: "Scrap yards produce twice as much." },
  { id: "zoning", branch: "street", tier: 2, name: "Zoning Permits", req: ["scanners", "rights"], cost: { funding: 4000, salvage: 3000 }, mult: { all: 2 }, effect: "Every building in the region produces twice as much." },
  { id: "bulk", branch: "street", tier: 2, name: "Bulk Contracts", req: ["rights"], cost: { funding: 3000, leads: 2000 }, cut: { terr: 0.85 }, effect: "Everything in the region costs 15% less." },
  { id: "drones", branch: "street", tier: 3, name: "Drone Relays", req: ["zoning"], cost: { leads: 40000, funding: 30000 }, mult: { perch: 3, informants: 2 }, effect: "Perches three times as much again, informants twice." },
  { id: "union", branch: "street", tier: 3, name: "Union Contract", req: ["zoning"], cost: { salvage: 25000, funding: 30000 }, mult: { yard: 3 }, effect: "Scrap yards three times as much again." },
  { id: "civic", branch: "street", tier: 4, name: "Civic Trust", req: ["drones", "union"], cost: { funding: 300000 }, mult: { watch: 3, precinct: 2 }, effect: "Block watches three times as much, liaisons twice." },
  { id: "eminent", branch: "street", tier: 4, name: "Eminent Domain", req: ["bulk"], cost: { funding: 250000, salvage: 60000 }, cut: { terr: 0.8 }, effect: "The region costs another 20% less." },
  { id: "uplink", branch: "street", tier: 5, name: "Orbital Uplink", req: ["civic"], cost: { funding: 2500000, leads: 400000 }, effect: "Opens the Signal Tower." },
  { id: "boost", branch: "street", tier: 6, name: "Signal Boost", req: ["uplink"], cost: { funding: 20000000, xp: 400000000 }, effect: "Signal towers give 20% each instead of 10%." },

  /* ---- BODY: the fight ---- */
  { id: "ballistics", branch: "body", tier: 1, name: "Strike Analysis", amp: "impact", req: [], cost: { xp: 170, salvage: 600 } },
  { id: "secondwind", branch: "body", tier: 1, name: "Second Wind", amp: "endurance", req: [], cost: { xp: 230, salvage: 900 } },
  { id: "plating", branch: "body", tier: 2, name: "Forged Plating", req: ["ballistics"], cost: { salvage: 4000, funding: 1500 }, cut: { gear: 0.75 }, effect: "All gear costs 25% less." },
  { id: "servo", branch: "body", tier: 2, name: "Servo Assist", req: ["secondwind"], cost: { funding: 8000, salvage: 4000 }, effect: "Opens the Exo Frame." },
  { id: "medicine", branch: "body", tier: 3, name: "Field Medicine", req: ["secondwind"], cost: { xp: 1500000, funding: 60000 }, effect: "A knockout costs 1.5 seconds instead of 5." },
  { id: "stims", branch: "body", tier: 3, name: "Combat Stims", req: ["servo"], cost: { xp: 3000000, funding: 90000 }, effect: "Power and resolve up by half." },
  { id: "threat", branch: "body", tier: 4, name: "Threat Assessment", req: ["stims", "medicine"], cost: { xp: 40000000, funding: 400000 }, effect: "Moves you to the best district you can win, automatically." },
  { id: "overclock", branch: "body", tier: 5, name: "Overclock", req: ["threat"], cost: { xp: 400000000, funding: 3000000 }, effect: "Power and resolve doubled." },

  /* ---- MIND: amplify the amplifiers ---- */
  { id: "kinetics", branch: "mind", tier: 1, name: "Kinetic Study", amp: "reflex", req: [], cost: { xp: 120, salvage: 400 } },
  { id: "optics", branch: "mind", tier: 1, name: "Optic Implant", amp: "perception", req: [], cost: { xp: 320, leads: 900 } },
  { id: "myofiber", branch: "mind", tier: 2, name: "Myofiber Weave", amp: "strength", req: ["optics"], cost: { xp: 600, salvage: 2200 } },
  { id: "media", branch: "mind", tier: 2, name: "Media Training", amp: "presence", req: ["kinetics"], cost: { xp: 900, funding: 2500 } },
  { id: "memory", branch: "mind", tier: 3, name: "Muscle Memory", req: ["kinetics", "optics"], cost: { xp: 900000, funding: 45000 }, cut: { rank: 0.8 }, effect: "Power ranks cost 20% less XP." },
  { id: "instincts", branch: "mind", tier: 3, name: "Combat Instinct", amp: "instinct", req: ["myofiber", "media"], cost: { xp: 2000000, funding: 70000 } },
  { id: "focus", branch: "mind", tier: 4, name: "Deep Focus", req: ["memory"], cost: { xp: 30000000, funding: 350000 }, cut: { rank: 0.75 }, effect: "Power ranks cost another 25% less." },
  { id: "cascade", branch: "mind", tier: 4, name: "Power Cascade", req: ["instincts"], cost: { xp: 60000000, funding: 600000 }, effect: "Every power rank adds 1% to the region and 0.5% to combat." },
  { id: "mantle", branch: "mind", tier: 5, name: "The Mantle Protocol", req: ["cascade", "overclock", "boost", "smart"], cost: { funding: 40000000, xp: 3000000000 }, effect: "Lets you pass the cowl to a new hero." },

  /* ---- OPS: quality of life, earned rather than given ---- */
  { id: "bulkorders", branch: "ops", tier: 1, name: "Bulk Orders", req: [], cost: { salvage: 300, leads: 300 }, effect: "Unlocks buying ten at a time." },
  { id: "notes", branch: "ops", tier: 1, name: "Field Notes", req: [], cost: { leads: 250, salvage: 250 }, effect: "Shows how long until you can afford anything." },
  { id: "logistics", branch: "ops", tier: 2, name: "Logistics", req: ["bulkorders"], cost: { funding: 2500, salvage: 2000 }, effect: "Unlocks buying the most you can afford at once." },
  { id: "standing", branch: "ops", tier: 2, name: "Standing Orders", req: ["notes"], cost: { funding: 3500, leads: 2500 }, effect: "Unlocks the build queue. Tap anything you can't afford and it waits in line." },
  { id: "autopilot", branch: "ops", tier: 3, name: "Autopilot", req: ["standing"], cost: { funding: 80000, xp: 1200000 }, effect: "Patrols twice a second without you." },
  { id: "archive", branch: "ops", tier: 3, name: "Deep Archive", req: ["logistics"], cost: { funding: 60000, leads: 40000 }, effect: "Offline progress counts for 24 hours instead of 8." },
  { id: "smart", branch: "ops", tier: 4, name: "Smart Queue", req: ["autopilot"], cost: { funding: 500000, xp: 25000000 }, effect: "Queued orders repeat forever instead of clearing once bought." },
  { id: "contingency", branch: "ops", tier: 4, name: "Contingency Fund", req: ["archive"], cost: { funding: 700000, xp: 35000000 }, effect: "Offline progress runs at full rate instead of half." },
];

const TUNE = {
  levelBase: 40,
  levelRatio: 1.35,
  levelBonus: 0.03,
  legacyBonus: 0.05,
  legacyDivisor: 2000000000,
  baseResolve: 22,
  koSeconds: 5,
  koFast: 1.5,
  offlineCap: 8 * 3600,
  offlineCapLong: 24 * 3600,
  offlineRate: 0.5,
  autopilotRate: 2,
  saveKey: "mantle:hero:v3",
};

/* ============================= ENGINE ============================= */

const RES_IDS = RESOURCES.map((r) => r.id);
const POWER_AMP = {};
TECH.forEach((t) => t.amp && (POWER_AMP[t.amp] = t.id));
const techById = (id) => TECH.find((t) => t.id === id);

const xpFor = (level) => TUNE.levelBase * (Math.pow(TUNE.levelRatio, level - 1) - 1);
const levelOf = (total) =>
  Math.floor(Math.log(1 + Math.max(0, total) / TUNE.levelBase) / Math.log(TUNE.levelRatio)) + 1;
const legacyFor = (f) => Math.floor(Math.sqrt(f / TUNE.legacyDivisor));

const freshState = (legacy = 0) => ({
  hero: null,
  res: { leads: 0, salvage: 0, funding: 0, xp: 0 },
  own: { perch: 0, yard: 0, watch: 0, informants: 0, precinct: 0, tower: 0 },
  gear: { rig: 0, padding: 0, trophy: 0, exo: 0 },
  ranks: {},
  tech: {},
  queue: [],
  district: "flats",
  cleared: {},
  fight: { enemyHP: 0, heroHP: 0, ko: 0 },
  totalXP: 0,
  legacy,
  careerFunding: 0,
  allTimeFunding: 0,
});

const heroById = (id) => HEROES.find((h) => h.id === id) || null;
const powersFor = (hero) => (hero ? [...POWERS, hero.signature] : POWERS);
const distById = (id) => DISTRICTS.find((x) => x.id === id) || DISTRICTS[0];
const unlocked = (s, i) => i === 0 || (s.cleared[DISTRICTS[i - 1].id] || 0) >= DISTRICTS[i].need;

function derive(s) {
  const hero = heroById(s.hero);
  const tech = s.tech;
  const powers = powersFor(hero);

  const mult = { patrol: 1, leads: 1, salvage: 1, funding: 1, xp: 1, power: 1, resolve: 1, global: 1 };
  let totalRanks = 0;
  for (const p of powers) {
    const r = s.ranks[p.id] || 0;
    if (!r) continue;
    totalRanks += r;
    const amped = POWER_AMP[p.id] && tech[POWER_AMP[p.id]] ? 2 : 1;
    mult[p.target] *= 1 + p.per * amped * r;
  }

  /* building multipliers and cost cuts, both read straight off the tree */
  const bMult = {};
  for (const t of TERRITORY) bMult[t.id] = 1;
  const mods = hero ? hero.mods : {};
  const cut = { terr: mods.cost || 1, gear: mods.cost || 1, rank: mods.cost || 1, tech: mods.cost || 1 };
  for (const t of TECH) {
    if (!tech[t.id]) continue;
    if (t.mult) {
      for (const k in t.mult) {
        if (k === "all") for (const id in bMult) bMult[id] *= t.mult.all;
        else bMult[k] *= t.mult[k];
      }
    }
    if (t.cut) for (const k in t.cut) cut[k] *= t.cut[k];
  }

  const level = levelOf(s.totalXP);
  const towerEach = tech.boost ? 0.2 : 0.1;
  const levelMult = 1 + TUNE.levelBonus * (level - 1);
  const global =
    mult.global * levelMult *
    (1 + TUNE.legacyBonus * s.legacy) *
    (1 + towerEach * s.own.tower) *
    (tech.cascade ? 1 + 0.01 * totalRanks : 1);

  const gross = {
    leads: (s.own.perch * 0.5 * bMult.perch + s.own.informants * 4 * bMult.informants) * mult.leads * (mods.leads || 1) * global,
    salvage: s.own.yard * 0.45 * bMult.yard * mult.salvage * (mods.salvage || 1) * global,
    funding: (s.own.watch * 0.35 * bMult.watch + s.own.precinct * 3.5 * bMult.precinct) * mult.funding * (mods.funding || 1) * global,
    xp: 0,
  };

  /* Combat deliberately does NOT use `global`. Economy multipliers scale the
     region; gear, power ranks and the Body branch scale the hero. Letting
     global into both made the survival gate grow as global squared. */
  let addPower = 0, addResolve = 0, xpBonus = 0;
  for (const gi of GEAR) {
    const n = s.gear[gi.id] || 0;
    if (!n) continue;
    if (gi.stat === "power") addPower += gi.per * n;
    else if (gi.stat === "resolve") addResolve += gi.per * n;
    else if (gi.stat === "xp") xpBonus += gi.per * n;
    else if (gi.stat === "both") { addPower += gi.power * n; addResolve += gi.resolve * n; }
  }
  const fightMult =
    (1 + TUNE.legacyBonus * s.legacy) *
    (tech.cascade ? 1 + 0.005 * totalRanks : 1) *
    (tech.stims ? 1.5 : 1) *
    (tech.overclock ? 2 : 1);
  const power = (1 + addPower) * mult.power * fightMult;
  const resolve = (TUNE.baseResolve + addResolve) * mult.resolve * (mods.resolve || 1) * fightMult;
  const xpMult = (1 + xpBonus) * mult.xp;

  const dist = distById(s.district);
  const ttk = power > 0 ? dist.hp / power : Infinity;
  const damageTaken = dist.dps * ttk;
  const winnable = damageTaken < resolve;
  const xpRate = winnable ? (dist.xp * xpMult) / ttk : 0;
  gross.xp = xpRate;

  const patrol = mult.patrol * (mods.patrol || 1) * levelMult * (1 + TUNE.legacyBonus * s.legacy);
  const floorXP = xpFor(level);
  const nextXP = xpFor(level + 1);

  return {
    hero, powers, mult, bMult, cut, level, levelMult, global, gross, totalRanks, towerEach,
    patrol, power, resolve, xpMult, fightMult, dist, ttk, damageTaken, winnable, xpRate,
    ko: tech.medicine ? TUNE.koFast : TUNE.koSeconds,
    healthLeft: Math.max(0, 1 - damageTaken / resolve),
    xpInto: s.totalXP - floorXP,
    xpNeed: nextXP - floorXP,
    xpPct: Math.min(100, ((s.totalXP - floorXP) / (nextXP - floorXP)) * 100),
    region: TERRITORY.reduce((n, t) => n + s.own[t.id], 0),
    cleared: s.cleared[dist.id] || 0,
    techDone: TECH.filter((t) => s.tech[t.id]).length,
  };
}

function costOf(item, own, count, discount = 1) {
  const g = item.growth;
  const base = item.base || item.cost;
  const factor = g ? (Math.pow(g, own) * (Math.pow(g, count) - 1)) / (g - 1) : count;
  const out = {};
  for (const k in base) out[k] = Math.ceil(base[k] * factor * discount);
  return out;
}

const powerCost = (p, rank, discount = 1) => ({ xp: Math.ceil(p.base * Math.pow(p.growth, rank) * discount) });
const canPay = (cost, res) => Object.keys(cost).every((k) => res[k] >= cost[k]);

function maxAffordable(item, own, res, discount) {
  let n = 0;
  while (n < 1000 && canPay(costOf(item, own, n + 1, discount), res)) n++;
  return n;
}

/* Resolves the auto battle for dt seconds — one partial swing or thousands
   of kills, so the live tick and the offline catch-up share a code path. */
function combatStep(s, dt, d) {
  const dist = d.dist;
  let { enemyHP, heroHP, ko } = s.fight;
  if (!(enemyHP > 0) || enemyHP > dist.hp) enemyHP = dist.hp;
  if (!(heroHP > 0) || heroHP > d.resolve) heroHP = ko > 0 ? 0 : d.resolve;

  let xp = 0, kills = 0, t = dt, guard = 0;
  while (t > 1e-9 && guard++ < 800) {
    if (ko > 0) {
      const spend = Math.min(t, ko);
      ko -= spend; t -= spend;
      if (ko <= 1e-9) { ko = 0; heroHP = d.resolve; enemyHP = dist.hp; }
      continue;
    }
    const tKill = d.power > 0 ? enemyHP / d.power : Infinity;
    const tDown = dist.dps > 0 ? heroHP / dist.dps : Infinity;
    const next = Math.min(tKill, tDown, t);
    enemyHP -= d.power * next;
    heroHP -= dist.dps * next;
    t -= next;
    if (enemyHP <= 1e-9) { kills++; xp += dist.xp * d.xpMult; enemyHP = dist.hp; heroHP = d.resolve; }
    else if (heroHP <= 1e-9) { heroHP = 0; ko = d.ko; }
  }
  return { fight: { enemyHP, heroHP, ko }, xp, kills };
}

/* Head of the queue is bought the moment it's affordable. Smart Queue sends
   it to the back instead of dropping it, so a queue can cycle forever. */
function queueStep(s, res, d) {
  if (!s.tech.standing || !s.queue.length) return null;
  const head = s.queue[0];
  const list = head.kind === "gear" ? GEAR : TERRITORY;
  const item = list.find((i) => i.id === head.id);
  if (!item) return { queue: s.queue.slice(1) };
  const bucket = head.kind === "gear" ? s.gear : s.own;
  const own = bucket[head.id] || 0;
  const cost = costOf(item, own, 1, head.kind === "gear" ? d.cut.gear : d.cut.terr);
  if (!canPay(cost, res)) return null;
  for (const k in cost) res[k] -= cost[k];
  return {
    queue: s.tech.smart ? [...s.queue.slice(1), head] : s.queue.slice(1),
    key: head.kind === "gear" ? "gear" : "own",
    bucket: { ...bucket, [head.id]: own + 1 },
  };
}

function bestDistrict(s, d) {
  for (let i = DISTRICTS.length - 1; i >= 0; i--) {
    if (!unlocked(s, i)) continue;
    const dist = DISTRICTS[i];
    if (dist.dps * (dist.hp / d.power) < d.resolve) return dist.id;
  }
  return DISTRICTS[0].id;
}

function step(s, dt) {
  const d = derive(s);
  const res = { ...s.res };
  for (const k of RES_IDS) if (k !== "xp") res[k] = Math.max(0, res[k] + d.gross[k] * dt);

  if (s.tech.autopilot) {
    const auto = d.patrol * TUNE.autopilotRate * dt;
    res.leads += auto;
    res.salvage += auto;
  }

  const c = combatStep(s, dt, d);
  res.xp += c.xp;

  const q = queueStep(s, res, d);
  const next = {
    ...s,
    res,
    fight: c.fight,
    cleared: c.kills ? { ...s.cleared, [s.district]: (s.cleared[s.district] || 0) + c.kills } : s.cleared,
    totalXP: s.totalXP + c.xp,
    careerFunding: s.careerFunding + d.gross.funding * dt,
    allTimeFunding: s.allTimeFunding + d.gross.funding * dt,
  };
  if (q) {
    next.queue = q.queue;
    if (q.key) next[q.key] = q.bucket;
  }
  if (s.tech.threat) {
    const best = bestDistrict(next, d);
    if (best !== next.district) {
      next.district = best;
      next.fight = { enemyHP: 0, heroHP: 0, ko: 0 };
    }
  }
  return next;
}

/* ---------------------------- display ---------------------------- */

const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];

function abbreviate(n) {
  let i = 0;
  while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0)) + SUFFIX[i];
}

const amt = (n) => (!isFinite(n) ? "—" : n < 1000 ? Math.floor(n).toString() : abbreviate(n));

function rate(n) {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(n);
  if (v < 10) return sign + v.toFixed(2);
  if (v < 1000) return sign + v.toFixed(1);
  return sign + abbreviate(v);
}

function duration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return `${Math.floor(sec)}s`;
}

const secs = (t) => (!isFinite(t) ? "never" : t < 10 ? t.toFixed(1) + "s" : t < 600 ? Math.round(t) + "s" : duration(t));
const x = (n) => (n >= 100 ? "×" + amt(n) : "×" + n.toFixed(n < 10 ? 2 : 1));
const nameOf = (id) => RESOURCES.find((r) => r.id === id)?.name ?? id;
const toneOf = (id) => RESOURCES.find((r) => r.id === id)?.tone ?? "plain";

/* ============================ THE HOOK ============================ */

function useGame() {
  const [s, setS] = useState(() => freshState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("fight");
  const [branch, setBranch] = useState("street");
  const [rawMode, setMode] = useState(1);
  const [away, setAway] = useState(null);
  const [armed, setArmed] = useState(null);
  const [saveNote, setSaveNote] = useState("");
  const [tip, setTip] = useState(null);

  const live = useRef(s);
  live.current = s;

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const hit = await window.storage.get(TUNE.saveKey);
        const saved = JSON.parse(hit.value);
        let back = { ...freshState(), ...saved.state };
        const cap = back.tech.archive ? TUNE.offlineCapLong : TUNE.offlineCap;
        const eff = back.tech.contingency ? 1 : TUNE.offlineRate;
        const gap = Math.min(cap, (Date.now() - saved.at) / 1000);
        if (back.hero && gap > 60) {
          const before = { funding: back.res.funding, xp: back.totalXP };
          const slice = (gap * eff) / 240;
          for (let i = 0; i < 240; i++) back = step(back, slice);
          if (!dead) setAway({ gap, funding: back.res.funding - before.funding, xp: back.totalXP - before.xp });
        }
        if (!dead) setS(back);
      } catch {
        /* nothing saved, or storage unavailable */
      }
      if (!dead) setReady(true);
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      setS((p) => (p.hero ? step(p, dt) : p));
    }, 100);
    return () => clearInterval(id);
  }, [ready]);

  const persist = useCallback(async () => {
    try {
      await window.storage.set(TUNE.saveKey, JSON.stringify({ at: Date.now(), state: live.current }));
      setSaveNote("saved " + new Date().toLocaleTimeString());
    } catch {
      setSaveNote("this session can't save progress");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(persist, 10000);
    const onHide = () => document.visibilityState === "hidden" && persist();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      persist();
    };
  }, [ready, persist]);

  const d = derive(s);

  /* Buy modes are Ops tech, so clamp if the player prestiged out of them. */
  const modes = [1, ...(s.tech.bulkorders ? [10] : []), ...(s.tech.logistics ? ["max"] : [])];
  const mode = modes.includes(rawMode) ? rawMode : 1;

  /* ---- tooltips ---- */
  const TIP_W = 250;
  const showTip = (e, id, title, body, via) => {
    const r = e.currentTarget.getBoundingClientRect();
    const above = r.top > window.innerHeight * 0.55;
    setTip({
      id, title, body, via, above,
      x: Math.min(Math.max(8, r.left + r.width / 2 - TIP_W / 2), window.innerWidth - TIP_W - 8),
      y: above ? window.innerHeight - r.top + 8 : r.bottom + 8,
    });
  };
  const tipProps = (id, title, body) => ({
    type: "button",
    "aria-label": `${title}. ${body}`,
    onPointerEnter: (e) => e.pointerType === "mouse" && showTip(e, id, title, body, "hover"),
    onPointerLeave: (e) => e.pointerType === "mouse" && setTip(null),
    onClick: (e) => {
      e.stopPropagation();
      if (tip && tip.id === id && tip.via === "tap") setTip(null);
      else showTip(e, id, title, body, "tap");
    },
  });

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    const onKey = (e) => e.key === "Escape" && setTip(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [tip]);

  /* How long until a cost is affordable, given current income. */
  const eta = (cost) => {
    let worst = 0;
    for (const k in cost) {
      const missing = cost[k] - s.res[k];
      if (missing <= 0) continue;
      const inc = d.gross[k];
      if (!(inc > 0)) return Infinity;
      worst = Math.max(worst, missing / inc);
    }
    return worst;
  };
  const etaLabel = (cost, ok) => (!s.tech.notes || ok ? null : secs(eta(cost)));

  /* ---- tooltip copy ---- */
  const RES_TEXT = {
    leads: "Street tips and dispatch chatter. Perches and informants pull them in, and most of the region is paid for in leads and salvage.",
    salvage: "Wreckage stripped after a fight. The cheapest thing the city makes, and what your early gear is built from.",
    funding: "Cash. The expensive half of the region runs on it, and your career is scored on how much of it you take in.",
    xp: "Experience, and the only thing powers cost. It comes from winning fights and nowhere else. Every point you have ever earned counts toward your level, so spending it never slows you down.",
  };
  const resTip = (id) =>
    id === "xp"
      ? `${RES_TEXT.xp} ${d.winnable ? `${d.dist.name} is paying ${rate(d.xpRate)}/s.` : `You aren't clearing ${d.dist.name}, so nothing is coming in.`}`
      : `${RES_TEXT[id]} Coming in at ${rate(d.gross[id])}/s.`;

  const levelTip = () =>
    `Level ${d.level}, off ${amt(s.totalXP)} XP earned this career. Each level above the first adds ${(TUNE.levelBonus * 100).toFixed(0)}% to the region, so level alone has you at ${x(d.levelMult)}. ` +
    `${amt(Math.max(0, d.xpNeed - d.xpInto))} more XP to level ${d.level + 1}.`;

  const heroTip = () =>
    d.hero ? `${d.hero.epithet} ${d.hero.perk} ${d.hero.signature.name} can only be bought while you wear this cowl. Your level, towers and research have the region running at ${x(d.global)}.` : "";

  const fightTip = () =>
    `An auto battle. You deal ${rate(d.power)} damage a second and can absorb ${amt(d.resolve)} before you go down. ` +
    `${d.dist.name} has ${amt(d.dist.hp)} health and hits for ${rate(d.dist.dps)}/s, so a fight takes ${secs(d.ttk)} and costs ${amt(d.damageTaken)} health. ` +
    (d.winnable
      ? `You finish with ${(d.healthLeft * 100).toFixed(0)}% left and heal between fights, so this district farms forever.`
      : `That's more than you have, so you go down at about ${((d.resolve / d.damageTaken) * 100).toFixed(0)}% of the way through. More Impact to finish sooner, more Endurance to last.`);

  const distTip = (dist, i, open) =>
    open
      ? `${dist.foes.join(", ")}. ${amt(dist.hp)} health, hits for ${rate(dist.dps)}/s, pays ${amt(dist.xp)} XP a kill. You have cleared ${amt(s.cleared[dist.id] || 0)}.`
      : `Locked. Clear ${dist.need} fights in ${DISTRICTS[i - 1].name} to open it — you have ${amt(s.cleared[DISTRICTS[i - 1].id] || 0)}.`;

  const resMod = (d.hero?.mods || {}).resolve || 1;
  const gearTip = (gi) => {
    const n = s.gear[gi.id] || 0;
    const what =
      gi.stat === "power" ? `+${gi.per} base power each`
      : gi.stat === "resolve" ? `+${gi.per} base resolve each`
      : gi.stat === "xp" ? `+${(gi.per * 100).toFixed(0)}% XP per kill each`
      : `+${gi.power} power and +${gi.resolve} resolve each`;
    return `${gi.blurb} ${what}. You own ${n}. Gear sets your base stats and power ranks multiply them, so the two compound. Region bonuses like levels and towers never touch combat.`;
  };

  const terrTip = (t) => {
    const own = s.own[t.id];
    if (t.id === "tower") return `${t.blurb} Each one adds ${(d.towerEach * 100).toFixed(0)}% to everything the region produces, and they stack.`;
    const each = (t.id === "informants" ? 4 : t.rate) * d.bMult[t.id] * d.mult[t.makes] * ((d.hero?.mods || {})[t.makes] || 1) * d.global;
    return `${t.blurb} You hold ${own}, at ${rate(each * own)} ${nameOf(t.makes).toLowerCase()} a second. Tech has these at ${x(d.bMult[t.id])} and your powers at ${x(d.mult[t.makes])}. Each costs ${((t.growth - 1) * 100).toFixed(0)}% more than the last.`;
  };

  const powerTip = (p) => {
    const rank = s.ranks[p.id] || 0;
    const ampId = POWER_AMP[p.id];
    const amped = ampId && s.tech[ampId];
    const per = p.per * (amped ? 2 : 1);
    const target =
      p.target === "global" ? "everything" :
      p.target === "patrol" ? "what a patrol brings back" :
      p.target === "power" ? "your damage in a fight" :
      p.target === "resolve" ? "how much you can absorb" :
      p.target === "xp" ? "XP from every kill" : nameOf(p.target).toLowerCase();
    const labLine = amped
      ? ` ${techById(ampId).name} doubled this, so a rank is worth ${(per * 100).toFixed(0)}% instead of ${(p.per * 100).toFixed(0)}%.`
      : ampId ? ` ${techById(ampId).name} in the tree would make every rank of this worth double.` : "";
    return `${p.blurb} Each rank adds ${(per * 100).toFixed(0)}% to ${target}. Rank ${rank} has you at ${x(1 + per * rank)}.${labLine}`;
  };

  const all = [...POWERS, ...HEROES.map((h) => h.signature)];
  const techEffect = (t) =>
    t.amp ? `Every rank of ${all.find((p) => p.id === t.amp)?.name} counts double` : t.effect;

  const techTip = (t) => {
    const opens = TECH.filter((o) => o.req.includes(t.id)).map((o) => o.name);
    const missing = t.req.filter((r) => !s.tech[r]).map((r) => techById(r).name);
    return (
      `${techEffect(t)}. Bought once and it holds for the rest of this career. ` +
      (missing.length ? `Still needs: ${missing.join(", ")}. ` : "") +
      (opens.length ? `Opens: ${opens.join(", ")}.` : "Nothing else is waiting on it.")
    );
  };

  const queueTip = () =>
    `Anything you can't afford goes in here when you tap it, and buys itself the moment the money lands. ` +
    (s.tech.smart
      ? `Smart Queue is running, so orders go to the back of the line instead of clearing — the queue cycles forever.`
      : `Each order clears once bought. Smart Queue in the Ops branch makes them repeat.`);

  const legacyTip = () =>
    `Left behind by every hero before you. Each point adds ${(TUNE.legacyBonus * 100).toFixed(0)}% to the region and to combat, and never goes away. Passing the cowl is the only way to earn it, and the only thing it doesn't burn.`;

  /* ---- actions ---- */
  const choose = (id) => setS((p) => ({ ...p, hero: id }));
  const setDistrict = (id) => setS((p) => ({ ...p, district: id, fight: { enemyHP: 0, heroHP: 0, ko: 0 } }));

  const patrol = () =>
    setS((p) => {
      const gain = derive(p).patrol;
      return { ...p, res: { ...p.res, leads: p.res.leads + gain, salvage: p.res.salvage + gain } };
    });

  const buyFrom = (key, which) => (item) =>
    setS((p) => {
      const dd = derive(p);
      const own = p[key][item.id] || 0;
      const max = maxAffordable(item, own, p.res, dd.cut[which]);
      const n = mode === "max" ? max : Math.min(mode, max);
      if (n < 1) return p;
      const cost = costOf(item, own, n, dd.cut[which]);
      const res = { ...p.res };
      for (const k in cost) res[k] -= cost[k];
      return { ...p, res, [key]: { ...p[key], [item.id]: own + n } };
    });

  const claim = buyFrom("own", "terr");
  const equip = buyFrom("gear", "gear");

  const enqueue = (kind, id) =>
    setS((p) => (p.tech.standing && p.queue.length < 12 ? { ...p, queue: [...p.queue, { kind, id }] } : p));
  const dequeue = (i) => setS((p) => ({ ...p, queue: p.queue.filter((_, n) => n !== i) }));
  const clearQueue = () => setS((p) => ({ ...p, queue: [] }));

  const train = (pw) =>
    setS((p) => {
      const dd = derive(p);
      const rank = p.ranks[pw.id] || 0;
      const cost = powerCost(pw, rank, dd.cut.rank);
      if (!canPay(cost, p.res)) return p;
      return { ...p, res: { ...p.res, xp: p.res.xp - cost.xp }, ranks: { ...p.ranks, [pw.id]: rank + 1 } };
    });

  const research = (t) =>
    setS((p) => {
      const dd = derive(p);
      const cost = costOf(t, 0, 1, dd.cut.tech);
      if (p.tech[t.id] || !t.req.every((r) => p.tech[r]) || !canPay(cost, p.res)) return p;
      const res = { ...p.res };
      for (const k in cost) res[k] -= cost[k];
      return { ...p, res, tech: { ...p.tech, [t.id]: true } };
    });

  const handOver = () => {
    const gain = legacyFor(s.careerFunding);
    setS((p) => ({ ...freshState(p.legacy + gain), allTimeFunding: p.allTimeFunding }));
    setArmed(null);
    setTab("fight");
  };

  const wipe = async () => {
    try { await window.storage.delete(TUNE.saveKey); } catch { /* nothing stored */ }
    setS(freshState());
    setArmed(null);
    setTab("fight");
  };

  /* ---- view helpers ---- */
  const priceIn = (key, which) => (item) => {
    const own = s[key][item.id] || 0;
    const max = mode === "max" ? maxAffordable(item, own, s.res, d.cut[which]) : 0;
    const n = mode === "max" ? Math.max(1, max) : mode;
    const cost = costOf(item, own, n, d.cut[which]);
    const ok = mode === "max" ? max > 0 : canPay(cost, s.res);
    return { own, max, n, cost, ok };
  };

  const yieldOf = (t) =>
    t.id === "tower"
      ? `+${(d.towerEach * 100).toFixed(0)}% to the region, each`
      : `${rate((t.id === "informants" ? 4 : t.rate) * d.bMult[t.id] * d.mult[t.makes] * ((d.hero?.mods || {})[t.makes] || 1) * d.global)} ${nameOf(t.makes).toLowerCase()}/s each`;

  const gearLine = (gi) =>
    gi.stat === "power" ? `+${rate(gi.per * d.mult.power * d.fightMult)} power each`
    : gi.stat === "resolve" ? `+${amt(gi.per * d.mult.resolve * resMod * d.fightMult)} resolve each`
    : gi.stat === "xp" ? `+${(gi.per * 100).toFixed(0)}% XP per kill each`
    : `+${rate(gi.power * d.mult.power * d.fightMult)} power, +${amt(gi.resolve * d.mult.resolve * resMod * d.fightMult)} resolve each`;

  const queued = (kind, id) => s.queue.filter((q) => q.kind === kind && q.id === id).length;
  const branchTech = TECH.filter((t) => t.branch === branch);
  const branchDone = (b) => TECH.filter((t) => t.branch === b && s.tech[t.id]).length;
  const branchTotal = (b) => TECH.filter((t) => t.branch === b).length;
  const techState = (t) =>
    s.tech[t.id] ? "done" : t.req.every((r) => s.tech[r]) ? "open" : "locked";
  const canBuyTech = (t) => techState(t) === "open" && canPay(costOf(t, 0, 1, d.cut.tech), s.res);

  return {
    s, d, ready, tab, setTab, branch, setBranch, mode, setMode, modes,
    away, setAway, armed, setArmed, saveNote, tip, setTip, tipProps, TIP_W,
    resTip, levelTip, heroTip, fightTip, distTip, gearTip, terrTip, powerTip,
    techTip, techEffect, queueTip, legacyTip, etaLabel,
    choose, setDistrict, patrol, claim, equip, train, research, handOver, wipe,
    enqueue, dequeue, clearQueue, queued,
    priceTerr: priceIn("own", "terr"), priceGear: priceIn("gear", "gear"),
    yieldOf, gearLine, techCost: (t) => costOf(t, 0, 1, d.cut.tech), techState, canBuyTech,
    branchTech, branchDone, branchTotal,
    foe: d.dist.foes[(s.cleared[d.dist.id] || 0) % d.dist.foes.length],
    shownTerritory: TERRITORY.filter((t) => t.show(s)),
    shownGear: GEAR.filter((gi) => gi.show(s)),
    pendingLegacy: legacyFor(s.careerFunding),
  };
}

/* ============================== SHELL ============================= */

function Slab({ label, count, countLabel, sub, cost, res, ok, dim, note, onBuy, tip, multi, flat }) {
  const clickable = !flat && ok;
  return (
    <div
      className={"n-item " + (flat ? "flat " : "") + (dim ? "dim " : "") + (ok || flat ? "" : "off")}
      role={flat ? undefined : "button"}
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!flat && !ok}
      onClick={() => clickable && onBuy()}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onBuy(); }
      }}
    >
      <div className="n-item-top">
        <span className="n-name">{label}</span>
        <span className="n-top-right">
          {count > 0 && <span className="n-count">{countLabel || "×" + count}</span>}
          {tip && <button className="n-info" {...tip}>?</button>}
        </span>
      </div>
      <div className="n-item-bot">
        <span className="n-sub">
          {sub}
          {note && <em className="n-eta">{note}</em>}
        </span>
        {cost && (
          <span className="n-price">
            {multi && <span className="n-multi">buy {multi}</span>}
            {Object.keys(cost).map((k) => (
              <span key={k} className={"tag-" + toneOf(k) + (res[k] >= cost[k] ? "" : " short")}>
                {amt(cost[k])} {nameOf(k).toLowerCase()}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function HeroSelect({ g }) {
  return (
    <div className="n-select">
      <h1 className="n-select-logo">Mantle</h1>
      <p className="n-select-sub">
        {g.s.legacy > 0
          ? `${g.s.legacy} legacy carried over. Whoever you pick starts ${(TUNE.legacyBonus * g.s.legacy * 100).toFixed(0)}% ahead of where the last one did.`
          : "One city, one cowl. Choose who wears it."}
      </p>
      <div className="n-heroes">
        {HEROES.map((h) => (
          <button key={h.id} className="n-hero" onClick={() => g.choose(h.id)}>
            <span className="n-hero-name">{h.name}</span>
            <span className="n-hero-epithet">{h.epithet}</span>
            <span className="n-hero-perk">{h.perk}</span>
            <span className="n-hero-sig">Signature power — {h.signature.name}: {h.signature.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* The build queue: only exists once Standing Orders is researched. */
function Queue({ g }) {
  const { s } = g;
  if (!s.tech.standing) return null;
  return (
    <div className="n-queue">
      <div className="n-queue-head">
        <button className="n-key tip-host" {...g.tipProps("queue", "Build queue", g.queueTip())}>
          Queue {s.queue.length > 0 && `(${s.queue.length})`}
        </button>
        {s.queue.length > 0 && (
          <button className="n-queue-clear" onClick={g.clearQueue}>clear</button>
        )}
      </div>
      {s.queue.length === 0 ? (
        <p className="n-queue-empty">Tap anything you can't afford and it waits here.</p>
      ) : (
        <div className="n-queue-items">
          {s.queue.map((q, i) => {
            const item = (q.kind === "gear" ? GEAR : TERRITORY).find((x) => x.id === q.id);
            return (
              <button key={i} className={"n-chip " + (i === 0 ? "next" : "")} onClick={() => g.dequeue(i)}>
                {item ? item.name : q.id}
                <span className="n-chip-x">×</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fight({ g }) {
  const { s, d } = g;
  const enemyPct = Math.max(0, Math.min(100, (s.fight.enemyHP / d.dist.hp) * 100));
  const heroPct = Math.max(0, Math.min(100, (s.fight.heroHP / d.resolve) * 100));
  const down = s.fight.ko > 0;

  let lastOpen = 0;
  DISTRICTS.forEach((dist, i) => unlocked(s, i) && (lastOpen = i));
  const visible = DISTRICTS.slice(0, lastOpen + 2).map((dist, i) => ({ dist, i, open: unlocked(s, i) }));

  return (
    <>
      <div className="n-districts">
        {visible.map(({ dist, i, open }) => {
          /* tipProps carries its own onClick, so spread it FIRST and call it
             from ours. Spreading it last silently replaces the handler. */
          const tp = g.tipProps("d-" + dist.id, dist.name, g.distTip(dist, i, open));
          return (
            <button
              key={dist.id}
              className={"n-dist " + (s.district === dist.id ? "on " : "") + (open ? "" : "locked")}
              {...tp}
              onClick={(e) => { tp.onClick(e); if (open) g.setDistrict(dist.id); }}
            >
              {dist.name}
              {!open && (
                <span className="n-dist-need">{amt(s.cleared[DISTRICTS[i - 1].id] || 0)}/{dist.need}</span>
              )}
            </button>
          );
        })}
        {s.tech.threat && <span className="n-auto">auto</span>}
      </div>

      <div className={"n-fight " + (down ? "down" : "")}>
        <div className="n-fight-top">
          <span className="n-name">{down ? "Knocked out" : g.foe}</span>
          <span className="n-top-right">
            <span className="n-count">{amt(d.cleared)} cleared</span>
            <button className="n-info" {...g.tipProps("fight", "The fight", g.fightTip())}>?</button>
          </span>
        </div>
        <div className="n-hp">
          <span className="n-hp-key">Them</span>
          <div className="n-bar"><div className="n-bar-fill foe" style={{ width: enemyPct + "%" }} /></div>
          <span className="n-hp-num">{amt(s.fight.enemyHP)}</span>
        </div>
        <div className="n-hp">
          <span className="n-hp-key">You</span>
          <div className="n-bar"><div className="n-bar-fill you" style={{ width: heroPct + "%" }} /></div>
          <span className="n-hp-num">{amt(s.fight.heroHP)}</span>
        </div>
        <div className="n-fight-stats">
          <span><b>{rate(d.power)}</b> power</span>
          <span><b>{amt(d.resolve)}</b> resolve</span>
          <span><b>{amt(d.dist.xp * d.xpMult)}</b> xp a kill</span>
        </div>
        {down ? (
          <p className="n-verdict bad">Back on your feet in {s.fight.ko.toFixed(1)}s.</p>
        ) : d.winnable ? (
          <p className="n-verdict">{secs(d.ttk)} a fight, {(d.healthLeft * 100).toFixed(0)}% health left. {rate(d.xpRate)} xp/s.</p>
        ) : (
          <p className="n-verdict bad">
            You go down at about {((d.resolve / d.damageTaken) * 100).toFixed(0)}% of the way through. More Impact
            to end it sooner, more Endurance to last.
          </p>
        )}
      </div>

      <p className="n-note">Gear is the only thing that raises your base stats. Your powers multiply it.</p>
      {g.shownGear.map((gi) => {
        const p = g.priceGear(gi);
        const q = g.queued("gear", gi.id);
        const canQ = !!s.tech.standing && !p.ok;
        return (
          <Slab
            key={gi.id}
            label={gi.name}
            count={p.own}
            sub={g.gearLine(gi)}
            note={q ? ` · queued ×${q}` : g.etaLabel(p.cost, p.ok) ? ` · ${g.etaLabel(p.cost, p.ok)} away` : null}
            cost={p.cost}
            res={s.res}
            ok={p.ok || canQ}
            dim={!p.ok}
            multi={g.mode === "max" ? "max" : g.mode > 1 ? "×" + g.mode : null}
            onBuy={() => (p.ok ? g.equip(gi) : g.enqueue("gear", gi.id))}
            tip={g.tipProps("g-" + gi.id, gi.name, g.gearTip(gi))}
          />
        );
      })}
    </>
  );
}

/* The tech tree: branch chips, then tiers hanging off a trunk. */
function Tree({ g }) {
  const { s, d } = g;
  const nodes = g.branchTech;
  const tiers = [...new Set(nodes.map((t) => t.tier))].sort((a, b) => a - b);
  const meta = BRANCHES.find((b) => b.id === g.branch);

  return (
    <>
      <div className="n-branches">
        {BRANCHES.map((b) => (
          <button
            key={b.id}
            className={"n-branch " + (g.branch === b.id ? "on" : "")}
            onClick={() => g.setBranch(b.id)}
          >
            {b.name}
            <span className="n-branch-n">{g.branchDone(b.id)}/{g.branchTotal(b.id)}</span>
          </button>
        ))}
      </div>
      <p className="n-note">{meta.blurb}</p>

      <div className="n-tree">
        {tiers.map((tier) => (
          <div className="n-tier" key={tier}>
            <div className="n-spine"><span className="n-tier-num">{tier}</span></div>
            <div className="n-tier-nodes">
              {nodes.filter((t) => t.tier === tier).map((t) => {
                const state = g.techState(t);
                const cost = g.techCost(t);
                const buyable = g.canBuyTech(t);
                const missing = t.req.filter((r) => !s.tech[r]).map((r) => techById(r).name);
                return (
                  <div
                    key={t.id}
                    className={"n-node " + state + (buyable ? " buyable" : "")}
                    role={buyable ? "button" : undefined}
                    tabIndex={buyable ? 0 : -1}
                    onClick={() => buyable && g.research(t)}
                    onKeyDown={(e) => {
                      if (buyable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); g.research(t); }
                    }}
                  >
                    <div className="n-node-top">
                      <span className="n-node-name">{t.name}</span>
                      <span className="n-top-right">
                        {state === "done" && <span className="n-tick">done</span>}
                        <button className="n-info" {...g.tipProps("t-" + t.id, t.name, g.techTip(t))}>?</button>
                      </span>
                    </div>
                    <p className="n-node-eff">{g.techEffect(t)}</p>
                    {state === "locked" && <p className="n-node-req">needs {missing.join(", ")}</p>}
                    {state !== "done" && (
                      <span className="n-price">
                        {Object.keys(cost).map((k) => (
                          <span key={k} className={"tag-" + toneOf(k) + (s.res[k] >= cost[k] ? "" : " short")}>
                            {amt(cost[k])} {nameOf(k).toLowerCase()}
                          </span>
                        ))}
                        {g.etaLabel(cost, buyable) && state === "open" && (
                          <em className="n-eta">{g.etaLabel(cost, buyable)} away</em>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Mantle() {
  const g = useGame();
  const { s, d, tipProps } = g;

  if (!g.ready) return (<div className="n"><style>{CSS}</style><p className="boot">Bringing the scanners up…</p></div>);
  if (!s.hero) return (<div className="n"><style>{CSS}</style><HeroSelect g={g} /></div>);

  const modeTag = g.mode === "max" ? "max" : g.mode > 1 ? "×" + g.mode : null;
  const showModes = (g.tab === "region" || g.tab === "fight") && g.modes.length > 1;

  return (
    <div className="n">
      <style>{CSS}</style>

      <header className="n-top">
        <nav className="n-tabs" role="tablist">
          {[["fight", "Fight"], ["region", "Region"], ["powers", "Powers"], ["tech", "Tech"], ["legacy", "Legacy"]].map(
            ([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={g.tab === id}
                className={"n-tab " + (g.tab === id ? "on" : "")}
                onClick={() => g.setTab(id)}
              >
                {label}
              </button>
            )
          )}
        </nav>
      </header>

      <div className="n-body">
        <aside className="n-rail">
          <div className="n-stat n-who">
            <div className="n-stat-top">
              <button className="n-key tip-host" {...tipProps("hero", d.hero.name, g.heroTip())}>
                {d.hero.name}
              </button>
            </div>
            <div className="n-val"><span className="n-lv">Lv</span> {d.level}</div>
            <div className="n-track"><div className="n-fill" style={{ width: d.xpPct + "%" }} /></div>
            <button className="n-key tip-host n-lvkey" {...tipProps("level", "Level", g.levelTip())}>
              {x(d.global)} region
            </button>
          </div>
          {RESOURCES.map((r) => (
            <div key={r.id} className={"n-stat tone-" + r.tone}>
              <div className="n-stat-top">
                <button className="n-key tip-host" {...tipProps("res-" + r.id, r.name, g.resTip(r.id))}>
                  {r.name}
                </button>
                <span className={"n-flow " + (r.id === "xp" && !d.winnable ? "neg" : "")}>+{rate(d.gross[r.id])}</span>
              </div>
              <div className="n-val">{amt(s.res[r.id])}</div>
            </div>
          ))}
          <div className="n-stat tone-plain">
            <div className="n-stat-top"><span className="n-key">Region</span></div>
            <div className="n-val">{d.region}<span className="n-of"> held</span></div>
          </div>
          <div className="n-stat tone-plain">
            <div className="n-stat-top"><span className="n-key">Tech</span></div>
            <div className="n-val">{d.techDone}<span className="n-of">/{TECH.length}</span></div>
          </div>
        </aside>

        <main className="n-main">
          {g.away && (
            <div className="n-flash">
              Gone {duration(g.away.gap)} — {amt(g.away.funding)} funding, {amt(g.away.xp)} xp.
              <button className="n-x" onClick={() => g.setAway(null)}>OK</button>
            </div>
          )}

          {showModes && (
            <div className="n-modes">
              {g.modes.map((m) => (
                <button key={m} className={"n-mode " + (g.mode === m ? "on" : "")} onClick={() => g.setMode(m)}>
                  {m === "max" ? "Max" : "×" + m}
                </button>
              ))}
            </div>
          )}

          {(g.tab === "region" || g.tab === "fight") && <Queue g={g} />}

          {g.tab === "fight" && <Fight g={g} />}

          {g.tab === "region" &&
            g.shownTerritory.map((t) => {
              const p = g.priceTerr(t);
              const q = g.queued("terr", t.id);
              const canQ = !!s.tech.standing && !p.ok;
              return (
                <Slab
                  key={t.id}
                  label={t.name}
                  count={p.own}
                  sub={g.yieldOf(t)}
                  note={q ? ` · queued ×${q}` : g.etaLabel(p.cost, p.ok) ? ` · ${g.etaLabel(p.cost, p.ok)} away` : null}
                  cost={p.cost}
                  res={s.res}
                  ok={p.ok || canQ}
                  dim={!p.ok}
                  multi={modeTag}
                  onBuy={() => (p.ok ? g.claim(t) : g.enqueue("terr", t.id))}
                  tip={tipProps("tr-" + t.id, t.name, g.terrTip(t))}
                />
              );
            })}

          {g.tab === "powers" && (
            <>
              <p className="n-note">
                Ranks cost XP, which only comes from winning fights. Spending it never slows your
                level — that runs off every point you have ever earned.
              </p>
              {d.powers.map((p) => {
                const rank = s.ranks[p.id] || 0;
                const amped = POWER_AMP[p.id] && s.tech[POWER_AMP[p.id]];
                const per = p.per * (amped ? 2 : 1);
                const cost = powerCost(p, rank, d.cut.rank);
                const target =
                  p.target === "global" ? "everything" :
                  p.target === "patrol" ? "patrols" :
                  p.target === "power" ? "damage" :
                  p.target === "resolve" ? "resolve" :
                  p.target === "xp" ? "xp per kill" : nameOf(p.target).toLowerCase();
                return (
                  <Slab
                    key={p.id}
                    label={p.name}
                    count={rank}
                    countLabel={"rank " + rank}
                    sub={`+${(per * 100).toFixed(0)}% ${target} per rank, now ${x(1 + per * rank)}${amped ? ", doubled" : ""}`}
                    note={g.etaLabel(cost, canPay(cost, s.res)) ? ` · ${g.etaLabel(cost, canPay(cost, s.res))} away` : null}
                    cost={cost}
                    res={s.res}
                    ok={canPay(cost, s.res)}
                    onBuy={() => g.train(p)}
                    tip={tipProps("pw-" + p.id, p.name, g.powerTip(p))}
                  />
                );
              })}
            </>
          )}

          {g.tab === "tech" && <Tree g={g} />}

          {g.tab === "legacy" && (
            <>
              <p className="n-note">
                The cowl outlives whoever is under it. Pass it on and the region, the gear, the
                powers and the whole tree go. You pick a new hero, and they start ahead of where you did.
              </p>
              <Slab
                flat
                label="Legacy"
                count={s.legacy}
                sub={`+${(TUNE.legacyBonus * 100).toFixed(0)}% to everything each, ${amt(s.careerFunding)} funding this career`}
                res={s.res}
                ok
                tip={tipProps("legacy", "Legacy", g.legacyTip())}
              />
              {!s.tech.mantle ? (
                <p className="n-note">Nobody inherits anything until you finish The Mantle Protocol, at the end of the Mind branch.</p>
              ) : (
                <Slab
                  label={g.armed === "hand" ? "Tap again to confirm" : "Pass the cowl on"}
                  count={0}
                  sub={g.pendingLegacy > 0 ? `Worth +${g.pendingLegacy} legacy. Everything else resets.` : "Bring in more funding first."}
                  res={s.res}
                  ok={g.pendingLegacy > 0}
                  onBuy={() => (g.armed === "hand" ? g.handOver() : g.setArmed("hand"))}
                />
              )}
              <div className="n-foot">
                <span>{g.saveNote}</span>
                <button
                  className={"n-ghost " + (g.armed === "wipe" ? "danger" : "")}
                  onClick={() => (g.armed === "wipe" ? g.wipe() : g.setArmed("wipe"))}
                >
                  {g.armed === "wipe" ? "Confirm — erase it all" : "Erase save"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <button className="n-patrol" onClick={g.patrol}>
        Patrol!
        <span className="n-patrol-sub">
          +{amt(d.patrol)} leads, +{amt(d.patrol)} salvage
          {s.tech.autopilot && ` · autopilot running at ${TUNE.autopilotRate}/s`}
        </span>
      </button>

      {g.tip && (
        <div
          className="tip"
          role="tooltip"
          style={g.tip.above ? { left: g.tip.x, bottom: g.tip.y, width: g.TIP_W } : { left: g.tip.x, top: g.tip.y, width: g.TIP_W }}
        >
          <span className="tip-title">{g.tip.title}</span>
          {g.tip.body}
        </div>
      )}
    </div>
  );
}

/* ============================== CSS =============================== */

const CSS = `
.n {
  --paper: #f2ece0; --ink: #171614; --yellow: #ffc72c; --red: #e8402a;
  --rule: rgba(23,22,20,.18);
  height: 100vh; min-height: 520px;
  display: flex; flex-direction: column;
  background-color: var(--paper);
  background-image: radial-gradient(rgba(23,22,20,.10) 1px, transparent 1.15px);
  background-size: 5px 5px;
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px; line-height: 1.4; -webkit-font-smoothing: antialiased;
}
.n *, .n *::before, .n *::after { box-sizing: border-box; }
.n button { font: inherit; cursor: pointer; }
.n :focus-visible { outline: 3px solid var(--red); outline-offset: -1px; }
.boot { margin: auto; opacity: .6; }

/* ---- hero select ---- */
.n-select { flex: 1; overflow-y: auto; padding: 26px 16px 40px; }
.n-select-logo {
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 54px; line-height: .95; letter-spacing: .03em; text-transform: uppercase;
  text-align: center; margin: 0; color: var(--yellow);
  -webkit-text-stroke: 2px var(--ink); text-shadow: 4px 4px 0 var(--ink);
}
.n-select-sub { text-align: center; font-size: 12.5px; margin: 14px auto 22px; max-width: 46ch; opacity: .8; }
.n-heroes { display: grid; gap: 13px; max-width: 640px; margin: 0 auto; }
.n-hero {
  display: block; text-align: left; width: 100%; background: #fff;
  border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink);
  padding: 11px 13px 13px; color: var(--ink);
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-hero:hover { background: #fffdf3; }
.n-hero:active { transform: translate(3px,3px); box-shadow: 1px 1px 0 var(--ink); }
.n-hero-name {
  display: block; font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 25px; letter-spacing: .04em; text-transform: uppercase; line-height: 1.05;
}
.n-hero-epithet { display: block; font-size: 12px; opacity: .7; margin-top: 2px; }
.n-hero-perk {
  display: inline-block; margin-top: 8px; background: var(--yellow);
  border: 2px solid var(--ink); padding: 1px 7px; font-size: 11.5px; font-weight: 700;
}
.n-hero-sig { display: block; margin-top: 8px; font-size: 11.5px; opacity: .75; }

/* ---- top bar: five tabs, full width ---- */
.n-top { flex-shrink: 0; background: var(--ink); }
.n-tabs { display: flex; }
.n-tab {
  flex: 1; background: none; border: none; color: #9c968a;
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 17px; letter-spacing: .05em; text-transform: uppercase; padding: 8px 4px;
}
.n-tab:hover { color: var(--paper); }
.n-tab.on { background: var(--yellow); color: var(--ink); }
.n-badge {
  display: inline-block; margin-left: 4px; background: var(--red); color: #fff;
  font-family: ui-monospace, Menlo, monospace; font-size: 10px; font-weight: 700;
  padding: 0 4px; vertical-align: 3px; letter-spacing: 0;
}
.n-tab.on .n-badge { background: var(--ink); color: var(--yellow); }

/* ---- rail ---- */
.n-body { flex: 1; display: flex; min-height: 0; }
.n-rail {
  width: 118px; flex-shrink: 0; overflow-y: auto;
  border-right: 3px solid var(--ink); background: rgba(23,22,20,.045);
}
.n-stat { padding: 6px 8px 7px; border-bottom: 1px solid var(--rule); border-left: 5px solid transparent; }
.n-stat.n-who { border-left-color: var(--red); background: rgba(232,64,42,.07); }
.n-who .n-key { font-size: 11px; opacity: 1; letter-spacing: .03em; }
.n-lv { font-size: 10px; opacity: .5; font-weight: 400; }
.n-lvkey { display: block; margin-top: 4px; font-size: 9px; opacity: .55; }
.n-stat.tone-cyan { border-left-color: #38bcd8; }
.n-stat.tone-steel { border-left-color: #97a3b0; }
.n-stat.tone-signal { border-left-color: var(--yellow); }
.n-stat.tone-magenta { border-left-color: #e8558f; }
.n-stat.tone-plain { border-left-color: var(--ink); }
.n-stat-top { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }
.n-key { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .62; text-align: left; }
.n-flow { font-size: 9.5px; opacity: .5; font-variant-numeric: tabular-nums; white-space: nowrap; }
.n-flow.neg { color: var(--red); opacity: 1; }
.n-val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.03em; line-height: 1.15; }
.n-of { font-size: 10px; opacity: .45; font-weight: 400; }
.n-track { height: 5px; background: rgba(23,22,20,.16); border: 1px solid var(--ink); margin-top: 5px; }
.n-fill { height: 100%; background: var(--red); transition: width .25s linear; }

/* ---- main ---- */
.n-main { flex: 1; min-width: 0; overflow-y: auto; padding: 12px 13px 18px; }

/* ---- the fight ---- */
.n-districts { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 11px; }
.n-dist {
  background: #fff; border: 2px solid var(--ink); padding: 1px 8px;
  font-size: 10.5px; font-weight: 700; cursor: help;
}
.n-dist.on { background: var(--ink); color: var(--yellow); }
.n-dist.locked { background: transparent; border-style: dashed; opacity: .5; }
.n .n-dist.locked { cursor: help; }
.n-dist-need { margin-left: 6px; font-variant-numeric: tabular-nums; opacity: .75; }
.n-fight {
  background: #fff; border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink);
  padding: 10px 12px 11px; margin-bottom: 14px;
}
.n-fight.down { background: #ffeeeb; border-color: var(--red); box-shadow: 4px 4px 0 var(--red); }
.n-fight-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.n-hp { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
.n-hp-key { font-size: 9.5px; font-weight: 700; text-transform: uppercase; opacity: .55; width: 34px; flex-shrink: 0; }
.n-hp-num { font-size: 10.5px; font-variant-numeric: tabular-nums; width: 52px; text-align: right; flex-shrink: 0; }
.n-bar { flex: 1; height: 13px; border: 2px solid var(--ink); background: rgba(23,22,20,.08); overflow: hidden; }
.n-bar-fill { height: 100%; transition: width .1s linear; }
.n-bar-fill.foe { background: var(--red); }
.n-bar-fill.you { background: #38bcd8; }
.n-fight-stats {
  display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; padding-top: 7px;
  border-top: 2px solid var(--rule); font-size: 10.5px; opacity: .8;
}
.n-fight-stats b { font-variant-numeric: tabular-nums; }
.n-verdict { margin: 6px 0 0; font-size: 11px; opacity: .75; }
.n-verdict.bad { color: var(--red); opacity: 1; font-weight: 700; }

/* ---- slabs ---- */
.n-item {
  background: #fff; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: 8px 10px 9px; margin-bottom: 11px; cursor: pointer;
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-item:hover { background: #fffdf3; }
.n-item:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.n-item.off { background: rgba(255,255,255,.4); border-style: dashed; box-shadow: none; cursor: not-allowed; opacity: .7; }
.n-item.off:active { transform: none; }
.n-item.flat { cursor: default; }
.n-item.flat:active { transform: none; box-shadow: 3px 3px 0 var(--ink); }
.n-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.n-name {
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 18px; letter-spacing: .035em; text-transform: uppercase; line-height: 1.1; min-width: 0;
}
.n-top-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.n-count { background: var(--ink); color: var(--yellow); font-size: 11px; font-weight: 700; padding: 1px 7px; white-space: nowrap; }
.n-info {
  width: 19px; height: 19px; padding: 0; flex-shrink: 0;
  border: 2px solid var(--ink); background: #fff; color: var(--ink);
  font-size: 11px; font-weight: 800; line-height: 1; cursor: help;
}
.n-info:hover { background: var(--yellow); }
.n-item-bot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
.n-sub { font-size: 11px; opacity: .72; font-variant-numeric: tabular-nums; }
.n-price { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.n-price span { border: 2px solid var(--ink); padding: 0 6px; font-size: 10.5px; font-weight: 700; background: #fff; white-space: nowrap; }
.n-multi { background: var(--ink) !important; color: var(--yellow); }
.tag-cyan { background: #a9e2f0; }
.tag-steel { background: #d9dfe6; }
.tag-signal { background: #ffd96b; }
.tag-magenta { background: #f7aec8; }
.n-price .short { background: #ffd5cf; color: var(--red); }

.n-modes { display: flex; gap: 6px; margin-bottom: 11px; }
.n-mode { background: #fff; border: 2px solid var(--ink); padding: 1px 11px; font-size: 11px; font-weight: 700; }
.n-mode.on { background: var(--ink); color: var(--yellow); }

.n-flash {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--yellow); border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: 8px 10px; margin-bottom: 12px; font-size: 12px; font-weight: 700;
}
.n-x { background: var(--ink); color: #fff; border: none; padding: 2px 9px; font-size: 11px; font-weight: 700; }
.n-note { font-size: 12px; opacity: .72; margin: 0 0 12px; max-width: 58ch; }
.n-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; padding-top: 12px; border-top: 2px solid var(--rule); font-size: 11px; opacity: .75; }
.n-ghost { background: #fff; border: 2px solid var(--ink); padding: 3px 11px; font-size: 11px; font-weight: 700; }
.n-ghost.danger { background: var(--red); color: #fff; border-color: var(--red); }

/* ---- build queue ---- */
.n-queue { border: 2px dashed var(--ink); padding: 7px 9px 8px; margin-bottom: 12px; background: rgba(255,255,255,.4); }
.n-queue-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.n-queue-clear { background: none; border: none; font-size: 10px; text-decoration: underline; opacity: .6; padding: 0; }
.n-queue-empty { margin: 4px 0 0; font-size: 10.5px; opacity: .55; }
.n-queue-items { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.n-chip {
  background: #fff; border: 2px solid var(--ink); padding: 1px 6px 1px 8px;
  font-size: 10.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
}
.n-chip.next { background: var(--yellow); }
.n-chip-x { opacity: .55; font-weight: 400; }
.n-item.dim { background: rgba(255,255,255,.45); border-style: dashed; box-shadow: none; }
.n-item.dim:active { transform: translate(1px,1px); box-shadow: none; }
.n-eta { font-style: normal; opacity: .6; white-space: nowrap; }
.n-auto {
  align-self: center; background: var(--ink); color: var(--yellow);
  font-size: 9.5px; font-weight: 700; letter-spacing: .08em; padding: 1px 6px;
}

/* ---- tech tree ---- */
.n-branches { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap; }
.n-branch {
  flex: 1; min-width: 68px; background: #fff; border: 2px solid var(--ink);
  padding: 3px 6px 4px; font-size: 12px; font-weight: 700; line-height: 1.15;
}
.n-branch.on { background: var(--ink); color: var(--yellow); }
.n-branch-n { display: block; font-size: 9.5px; font-weight: 400; opacity: .6; font-variant-numeric: tabular-nums; }
.n-branch.on .n-branch-n { opacity: .75; }
.n-tree { margin-top: 2px; }
.n-tier { display: flex; gap: 9px; align-items: stretch; }
.n-spine { width: 20px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
.n-spine::after { content: ""; flex: 1; width: 3px; background: var(--ink); opacity: .22; }
.n-tier:last-child .n-spine::after { opacity: 0; }
.n-tier-num {
  width: 20px; height: 20px; flex-shrink: 0; background: var(--ink); color: var(--yellow);
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
.n-tier-nodes { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; }
.n-node {
  background: #fff; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: 7px 9px 8px; position: relative;
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-node::before {
  content: ""; position: absolute; left: -9px; top: 12px; width: 9px; height: 3px;
  background: var(--ink); opacity: .22;
}
.n-node.buyable { cursor: pointer; }
.n-node.buyable:hover { background: #fffdf3; }
.n-node.buyable:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }
.n-node.open:not(.buyable) { background: rgba(255,255,255,.5); box-shadow: none; }
.n-node.locked { background: transparent; border-style: dashed; box-shadow: none; opacity: .6; }
.n-node.done { background: var(--ink); color: var(--paper); box-shadow: 3px 3px 0 rgba(23,22,20,.25); }
.n-node.done .n-info { background: var(--ink); color: var(--paper); border-color: var(--paper); }
.n-node-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.n-node-name {
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 15px; letter-spacing: .03em; text-transform: uppercase; line-height: 1.1;
}
.n-node-eff { margin: 3px 0 0; font-size: 11px; opacity: .75; }
.n-node.done .n-node-eff { opacity: .8; }
.n-node-req { margin: 3px 0 0; font-size: 10px; font-weight: 700; color: var(--red); }
.n-node .n-price { margin-top: 6px; }
.n-tick { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .7; }

/* ---- patrol ---- */
.n-patrol {
  flex-shrink: 0; border: none; border-top: 4px solid var(--ink);
  background: var(--yellow); color: var(--ink); padding: 10px 14px 11px; text-align: left;
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  font-size: 27px; letter-spacing: .06em; text-transform: uppercase; line-height: 1;
}
.n-patrol:hover { background: #ffd04d; }
.n-patrol:active { background: #f0b51e; }
.n-patrol-sub {
  display: block; margin-top: 3px; opacity: .68;
  font-family: ui-monospace, Menlo, monospace; font-size: 11px; font-weight: 700;
  letter-spacing: 0; text-transform: none;
}

/* ---- tooltips ---- */
.n .tip-host {
  background: none; border: none; padding: 0; margin: 0;
  font: inherit; color: inherit; text-align: inherit; cursor: help;
  border-bottom: 1px dotted currentColor;
}
.n .tip {
  position: fixed; z-index: 60; padding: 9px 11px; pointer-events: none;
  background: #fffdf6; border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink);
  font-family: system-ui, -apple-system, sans-serif; font-size: 12.5px; line-height: 1.5;
  color: var(--ink);
}
.tip-title { display: block; font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--red); margin-bottom: 3px; }

@media (max-width: 460px) {
  .n-tab { font-size: 13px; padding: 7px 2px; letter-spacing: .02em; }
  .n-rail { width: 94px; }
  .n-val { font-size: 16px; }
  .n-main { padding: 10px 10px 16px; }
  .n-branch { font-size: 11px; min-width: 60px; }
  .n-node-name { font-size: 13.5px; }
  .n-name { font-size: 15px; }
  .n-patrol { font-size: 21px; padding: 9px 12px 10px; }
  .n-select-logo { font-size: 40px; }
  .n-hp-num { width: 44px; }
}
@media (prefers-reduced-motion: reduce) { .n * { transition: none !important; } }
`;
