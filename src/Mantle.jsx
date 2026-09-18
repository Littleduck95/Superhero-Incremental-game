import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ------------------------------------------------------------------ *
 *  MANTLE — pick a hero, hold a city, get stronger
 *
 *    REGION   buildings produce leads, salvage and funding. Two of
 *             them, opened by bosses, feed the fight instead
 *    STORAGE  every resource but XP has a ceiling, and lockups raise
 *             it. Income stops there; windfalls are allowed over it
 *    CREW     safehouses are beds and beds are why people stay. Five
 *             jobs, a payroll out of funding, and hands who leave if
 *             it goes unpaid
 *    MARKET   leads and salvage move for funding. Dumping sags the
 *             price, time walks it back, buying costs the spread
 *    FIGHT    an auto battler with four abilities on cooldowns and a
 *             boss at the end of every district. Gear sets your base
 *             stats, powers multiply them, abilities spend them well.
 *             Fights are the only source of XP
 *    POWERS   ranks bought with XP, multiplying region and combat
 *    WORKS    city projects paid for in slices, stacking forever
 *    RECORD   achievements, kept when the cowl changes hands
 *    TECH     a four-branch tree. Street makes the region richer and
 *             cheaper, Body opens the abilities and amplifies the
 *             fight, Mind amplifies the region's powers, and Ops
 *             unlocks the quality-of-life the game withholds at the
 *             start: bulk buying, the build queue, auto-patrol,
 *             auto-fire, auto-climb, overflow selling and longer
 *             offline time
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

/* Every district ends in a boss. `need` is how many fights you clear here
   before the boss shows; beating the boss opens the next district, pays
   the bounty, and holds the district for the rest of the career. */
const DISTRICTS = [
  { id: "flats", name: "The Flats", hp: 20, dps: 0.5, xp: 6, need: 10, foes: ["Corner Muggers", "Bag Snatcher", "Two Drunks"],
    boss: { name: "The Landlord", hp: 900, dps: 1.6, xp: 150, bounty: { salvage: 250, leads: 150 }, blurb: "Owns every building on the block and none of the repairs." } },
  { id: "docks", name: "Dockside", hp: 140, dps: 2.5, xp: 126, need: 15, foes: ["Wharf Crew", "Container Thieves", "Night Shift"],
    boss: { name: "The Harbourman", hp: 6500, dps: 8, xp: 3000, bounty: { funding: 2000, salvage: 1500 }, blurb: "Nothing comes ashore he hasn't weighed." } },
  { id: "railyards", name: "Rail Yards", hp: 1000, dps: 13, xp: 2700, need: 20, foes: ["Coupler Gang", "Freight Raiders", "Line Walkers"],
    boss: { name: "Switchback", hp: 68000, dps: 42, xp: 70000, bounty: { funding: 20000, salvage: 15000, leads: 15000 }, blurb: "Has never been on the platform you were told." } },
  { id: "midtown", name: "Midtown", hp: 7000, dps: 65, xp: 56000, need: 25, foes: ["Armoured Car Crew", "Glasshouse Jumpers", "Penthouse Muscle"],
    boss: { name: "The Broker", hp: 470000, dps: 210, xp: 1400000, bounty: { funding: 200000, salvage: 60000 }, blurb: "Sells the fight before it starts, both sides." } },
  { id: "spire", name: "Spire District", hp: 50000, dps: 330, xp: 1200000, need: 30, foes: ["Private Security", "Vault Runners", "Board Members"],
    boss: { name: "Mr. Ardent", hp: 3600000, dps: 1060, xp: 30000000, bounty: { funding: 2000000, leads: 400000 }, blurb: "Smiles the whole way through it." } },
  { id: "undercity", name: "The Undercity", hp: 360000, dps: 1700, xp: 26000000, need: 35, foes: ["Tunnel Pack", "Drowned Men", "Lamplighters"],
    boss: { name: "The Sump King", hp: 18000000, dps: 5400, xp: 650000000, bounty: { funding: 20000000, salvage: 5000000 }, blurb: "Everything the city flushes ends up loyal to him." } },
  { id: "aboveline", name: "Above the Line", hp: 2600000, dps: 8500, xp: 560000000, need: 40, foes: ["Orbital Mercs", "Halo Squad", "Debris Pirates"],
    boss: { name: "The Consortium", hp: 205000000, dps: 27000, xp: 14000000000, bounty: { funding: 150000000, leads: 30000000 }, blurb: "Twelve chairs, one vote, no minutes." } },
  { id: "breach", name: "The Breach", hp: 19000000, dps: 43000, xp: 12000000000, need: 45, foes: ["The Other Side", "A Walking Fault", "Static"],
    boss: { name: "Nothing With A Name", hp: 920000000, dps: 140000, xp: 300000000000, bounty: { funding: 1000000000, salvage: 300000000 }, blurb: "It was here first." } },
];

/* Abilities. Each is opened by a Body tech, recharges on a cooldown, and
   scales off the same stats the auto battle uses:
     hit    lands mag seconds of damage at once
     guard  incoming damage cut by mag for dur seconds
     heal   restores mag of your resolve
     boost  damage times mag for dur seconds
   Safehouses shorten the cooldowns; Training Floors raise mag and dur. */
const ABILITIES = [
  { id: "haymaker", name: "Haymaker", tech: "haymaker", kind: "hit", mag: 6, cd: 10, key: "1", blurb: "Everything you've got, once." },
  { id: "brace", name: "Brace", tech: "brace", kind: "guard", mag: 0.6, dur: 5, cd: 15, key: "2", blurb: "Plant your feet and let it come." },
  { id: "secondwind", name: "Second Wind", tech: "secondwind", kind: "heal", mag: 0.5, cd: 20, key: "3", blurb: "Not done yet." },
  { id: "surge", name: "Surge", tech: "surge", kind: "boost", mag: 2, dur: 6, cd: 25, key: "4", blurb: "Six seconds where nothing can keep up." },
];

const GEAR = [
  { id: "rig", name: "Knuckle Rig", stat: "power", per: 1.5, base: { salvage: 20 }, growth: 1.18, show: () => true, blurb: "Weighted, wrapped, illegal in eleven states." },
  { id: "padding", name: "Body Padding", stat: "resolve", per: 14, base: { salvage: 30 }, growth: 1.18, show: () => true, blurb: "Takes the hit so your ribs don't." },
  { id: "trophy", name: "Trophy Case", stat: "xp", per: 0.2, base: { funding: 300 }, growth: 1.25, show: (s) => s.own.watch >= 1, blurb: "You learn more when you keep what you beat." },
  { id: "exo", name: "Exo Frame", stat: "both", power: 16, resolve: 80, base: { funding: 1200, leads: 700 }, growth: 1.22, show: (s) => !!s.tech.servo, blurb: "Servo-assisted everything, including the parts that hurt." },
];

const TERRITORY = [
  { id: "perch", name: "Rooftop Perch", makes: "leads", rate: 0.5, base: { salvage: 12 }, growth: 1.15, show: () => true, blurb: "A clear sightline over four blocks." },
  { id: "lockup", name: "Lockup", makes: null, base: { salvage: 35, leads: 20 }, growth: 1.13, show: () => true, blurb: "Somewhere to put it all that nobody else has a key to." },
  { id: "yard", name: "Scrap Yard", makes: "salvage", rate: 0.45, base: { leads: 18 }, growth: 1.15, show: (s) => s.own.perch >= 1, blurb: "Wreckage comes to you instead of the other way round." },
  { id: "watch", name: "Block Watch", makes: "funding", rate: 0.35, base: { leads: 40, salvage: 70 }, growth: 1.15, show: (s) => s.own.yard >= 2, blurb: "The neighbourhood decides to chip in." },
  { id: "safehouse", name: "Safehouse", makes: null, base: { salvage: 150, leads: 100 }, growth: 1.2, show: (s) => !!s.bosses.flats, blurb: "Somewhere to get taped up and go back out." },
  { id: "informants", name: "Informant Network", makes: "leads", rate: 4, base: { funding: 800, salvage: 400 }, growth: 1.16, show: (s) => s.own.watch >= 3, blurb: "Forty people who owe you, and one who doesn't." },
  { id: "gym", name: "Training Floor", makes: null, base: { funding: 600, salvage: 400 }, growth: 1.2, show: (s) => !!s.bosses.docks, blurb: "Heavy bags, a ring, and nobody asking questions." },
  { id: "precinct", name: "Precinct Liaison", makes: "funding", rate: 3.5, base: { funding: 1500, leads: 900 }, growth: 1.17, show: (s) => s.own.informants >= 2, blurb: "A badge who picks up when you call." },
  { id: "tower", name: "Signal Tower", makes: null, base: { funding: 30000, salvage: 10000, leads: 7000 }, growth: 1.22, show: (s) => !!s.tech.uplink, blurb: "Each tower lifts everything you hold." },
];

/* ---------------------------- the crew ---------------------------- *
 *  Safehouses are beds; beds are the only reason anyone stays. Crew
 *  arrive on their own while there is room and the funding to pay
 *  them, and you decide what they do. Three jobs feed the region, two
 *  feed the fight. Idle crew do nothing but still eat.
 * ------------------------------------------------------------------ */
const JOBS = [
  { id: "beat", name: "Street Beat", makes: { leads: 0.8, salvage: 0.8 }, blurb: "Four blocks each, on foot, all night." },
  { id: "scavenge", name: "Scavenging", makes: { salvage: 2.4 }, blurb: "They strip a crash site down to the bolts." },
  { id: "outreach", name: "Outreach", makes: { funding: 1.8 }, blurb: "Someone has to shake the tin and smile." },
  { id: "sparring", name: "Sparring", combat: 0.04, blurb: "You hit harder when someone hits back all week." },
  { id: "intel", name: "Intel Desk", xp: 0.035, blurb: "They know who you fought before you do." },
];

/* ------------------------- city projects -------------------------- *
 *  Huge, part-payable works. Buy any slice of the next one, keep the
 *  progress, and every completion stacks forever. The city's answer to
 *  a wall of funding with nothing left to spend it on.
 * ------------------------------------------------------------------ */
const PROJECTS = [
  { id: "beacon", name: "The Beacon", base: { funding: 45000, salvage: 18000 }, growth: 1.9,
    gain: { region: 0.06 }, effect: "+6% to everything the region makes", blurb: "A light they can see from every roof in the city." },
  { id: "ward", name: "Trauma Ward", base: { funding: 60000, leads: 30000 }, growth: 1.9,
    gain: { resolve: 0.12 }, effect: "+12% resolve", blurb: "Open all night, no questions, no paperwork." },
  { id: "doctrine", name: "Strike Doctrine", base: { funding: 70000, salvage: 40000 }, growth: 1.9,
    gain: { power: 0.12 }, effect: "+12% power", blurb: "Everything you learned, written down for the next one." },
  { id: "spire", name: "Archive Spire", base: { funding: 120000, leads: 60000 }, growth: 1.92,
    gain: { xp: 0.08, cap: 0.2 }, effect: "+8% XP a kill, +20% storage", blurb: "Every file the city tried to lose, on one floor." },
  { id: "response", name: "Rapid Response Net", base: { funding: 200000, salvage: 90000 }, growth: 1.95,
    gain: { cd: 0.04 }, effect: "Abilities recharge 4% faster", blurb: "The call goes out before the glass finishes falling." },
];

/* --------------------------- black market -------------------------- *
 *  Leads and salvage move for funding. Every sale floods the market and
 *  the price sags; leave it alone and it drifts back up. Buying costs
 *  the spread, which is what makes dumping a full lockup a decision.
 * ------------------------------------------------------------------ */
const MARKET = [
  { id: "leads", value: 0.9 },
  { id: "salvage", value: 0.7 },
];

/* Permanent, and the only thing besides legacy that outlives a career. */
const ACHIEVEMENTS = [
  ...DISTRICTS.map((dist) => ({ id: "boss_" + dist.id, name: dist.boss.name, blurb: `Beat the boss of ${dist.name}.`, test: (s) => !!s.bosses[dist.id] })),
  { id: "lv10", name: "Known Quantity", blurb: "Reach level 10.", test: (s, d) => d.level >= 10 },
  { id: "lv25", name: "Front Page", blurb: "Reach level 25.", test: (s, d) => d.level >= 25 },
  { id: "lv50", name: "Household Name", blurb: "Reach level 50.", test: (s, d) => d.level >= 50 },
  { id: "build50", name: "Footprint", blurb: "Hold 50 buildings.", test: (s) => TERRITORY.reduce((n, t) => n + (s.own[t.id] || 0), 0) >= 50 },
  { id: "build250", name: "Landlord", blurb: "Hold 250 buildings.", test: (s) => TERRITORY.reduce((n, t) => n + (s.own[t.id] || 0), 0) >= 250 },
  { id: "crew10", name: "A Team", blurb: "Keep ten crew on the books.", test: (s) => s.crew.n >= 10 },
  { id: "crew40", name: "An Organisation", blurb: "Keep forty crew on the books.", test: (s) => s.crew.n >= 40 },
  { id: "abilities", name: "Full Kit", blurb: "Open all four abilities.", test: (s) => ABILITIES.every((a) => s.tech[a.tech]) },
  { id: "project1", name: "Groundbreaking", blurb: "Finish a city project.", test: (s) => PROJECTS.some((p) => (s.projects[p.id]?.done || 0) >= 1) },
  { id: "project10", name: "Skyline", blurb: "Finish ten city projects.", test: (s) => PROJECTS.reduce((n, p) => n + (s.projects[p.id]?.done || 0), 0) >= 10 },
  { id: "trade", name: "Fence", blurb: "Move a million funding through the market.", test: (s) => s.traded >= 1000000 },
  { id: "branch", name: "Specialist", blurb: "Finish a whole branch of the tree.", test: (s) => BRANCHES.some((b) => TECH.every((t) => t.branch !== b.id || s.tech[t.id])) },
  { id: "legacy1", name: "Succession", blurb: "Pass the cowl on once.", test: (s) => s.runs >= 1 },
  { id: "legacy5", name: "The Mantle", blurb: "Pass the cowl on five times.", test: (s) => s.runs >= 5 },
];

/* Live-play flavour: small windfalls and the odd hot streak. Deliberately
   never fired during offline catch-up, so they can't be farmed by leaving. */
const EVENTS = [
  { id: "tip", res: "leads", secs: 180, text: "A payphone rings once and stops. The address is good." },
  { id: "wreck", res: "salvage", secs: 180, text: "A chase ends in a wall. The wall wins, and you get the pieces." },
  { id: "benefactor", res: "funding", secs: 180, text: "An envelope, no name on it, and nothing asked for." },
  { id: "haul", res: "salvage", secs: 420, text: "A container comes off the boat marked as somebody else's." },
  { id: "grant", res: "funding", secs: 420, text: "The city council finds a line item with your name on it." },
  { id: "streak", boon: { mult: 1.6, dur: 120 }, text: "The whole district is calling it in at once. Ride it." },
  { id: "quiet", boon: { mult: 1.35, dur: 240 }, text: "A quiet night, and everyone gets twice as much done." },
];

/* ---------------------------- the tree ---------------------------- *
 *  branch + tier drive the layout; req drives the wiring.
 *  amp     doubles a power's per-rank value
 *  mult    multiplies a building (or "all" of them)
 *  cap     multiplies how much of everything you can hold
 *  ability opens one of the four abilities
 *  cost    is flat — tech is bought once
 * ------------------------------------------------------------------ */
const BRANCHES = [
  { id: "street", name: "Street", blurb: "The region, richer and cheaper." },
  { id: "body", name: "Body", blurb: "Abilities, and everything that makes the fight go your way." },
  { id: "mind", name: "Mind", blurb: "Amplifies the powers the region runs on. Cheaper ranks, faster recharge." },
  { id: "ops", name: "Ops", blurb: "Everything that saves you clicks: bulk buying, the queue, automation." },
];

const TECH = [
  /* ---- STREET: the old stuff, but better and cheaper ---- */
  { id: "scanners", branch: "street", tier: 1, name: "Police Scanners", req: [], cost: { salvage: 400, leads: 200 }, mult: { perch: 2 }, effect: "Rooftop perches produce twice as much." },
  { id: "rights", branch: "street", tier: 1, name: "Salvage Rights", req: [], cost: { leads: 500, salvage: 250 }, mult: { yard: 2 }, effect: "Scrap yards produce twice as much." },
  { id: "crates", branch: "street", tier: 1, name: "Packing Crates", req: [], cost: { salvage: 500, leads: 350 }, cap: 4, effect: "Lockups hold four times as much." },
  { id: "zoning", branch: "street", tier: 2, name: "Zoning Permits", req: ["scanners", "rights"], cost: { funding: 4000, salvage: 3000 }, mult: { all: 2 }, effect: "Every building produces twice as much." },
  { id: "bulk", branch: "street", tier: 2, name: "Bulk Contracts", req: ["rights"], cost: { funding: 3000, leads: 2000 }, cut: { terr: 0.85 }, effect: "Buildings cost 15% less." },
  { id: "fence", branch: "street", tier: 2, name: "Fence Contacts", req: ["rights"], cost: { leads: 1800, funding: 900 }, effect: "Opens the black market: leads and salvage move for funding." },
  { id: "recruit", branch: "street", tier: 2, name: "Recruitment Drive", req: ["scanners"], cost: { funding: 3000, leads: 2200 }, effect: "Half again as many beds in every safehouse." },
  { id: "drones", branch: "street", tier: 3, name: "Drone Relays", req: ["zoning"], cost: { leads: 40000, funding: 30000 }, mult: { perch: 3, informants: 2 }, effect: "Perches ×3 again, informants ×2." },
  { id: "union", branch: "street", tier: 3, name: "Union Contract", req: ["zoning"], cost: { salvage: 25000, funding: 30000 }, mult: { yard: 3 }, effect: "Scrap yards ×3 again." },
  { id: "projects", branch: "street", tier: 3, name: "Civic Projects", req: ["zoning"], cost: { funding: 35000, salvage: 18000 }, effect: "Opens city projects: part-payable works that stack forever." },
  { id: "vault", branch: "street", tier: 3, name: "Blast Vault", req: ["crates"], cost: { funding: 50000, salvage: 25000 }, cap: 8, effect: "Lockups hold eight times as much again." },
  { id: "civic", branch: "street", tier: 4, name: "Civic Trust", req: ["drones", "union"], cost: { funding: 300000 }, mult: { watch: 3, precinct: 2 }, effect: "Block watches ×3, liaisons ×2." },
  { id: "eminent", branch: "street", tier: 4, name: "Eminent Domain", req: ["bulk"], cost: { funding: 250000, salvage: 60000 }, cut: { terr: 0.8 }, effect: "Buildings cost another 20% less." },
  { id: "uplink", branch: "street", tier: 5, name: "Orbital Uplink", req: ["civic"], cost: { funding: 2500000, leads: 400000 }, effect: "Opens the Signal Tower." },
  { id: "caches", branch: "street", tier: 5, name: "Compressed Caches", req: ["uplink", "vault"], cost: { funding: 3000000, leads: 700000 }, cap: 12, effect: "Lockups hold twelve times as much again." },
  { id: "boost", branch: "street", tier: 6, name: "Signal Boost", req: ["uplink"], cost: { funding: 20000000, xp: 400000000 }, effect: "Signal towers give 20% each instead of 10%." },

  /* ---- BODY: the fight ---- */
  { id: "haymaker", branch: "body", tier: 1, name: "Haymaker", ability: "haymaker", req: [], cost: { xp: 60, salvage: 250 }, effect: "Ability: six seconds of damage in one hit." },
  { id: "ballistics", branch: "body", tier: 1, name: "Strike Analysis", amp: "impact", req: [], cost: { xp: 170, salvage: 600 } },
  { id: "conditioning", branch: "body", tier: 1, name: "Conditioning", amp: "endurance", req: [], cost: { xp: 230, salvage: 900 } },
  { id: "brace", branch: "body", tier: 2, name: "Brace", ability: "brace", req: ["conditioning"], cost: { xp: 500, salvage: 1500 }, effect: "Ability: take 60% less for five seconds." },
  { id: "plating", branch: "body", tier: 2, name: "Forged Plating", req: ["ballistics"], cost: { salvage: 4000, funding: 1500 }, cut: { gear: 0.75 }, effect: "Gear costs 25% less." },
  { id: "servo", branch: "body", tier: 2, name: "Servo Assist", req: ["conditioning"], cost: { funding: 8000, salvage: 4000 }, effect: "Opens the Exo Frame." },
  { id: "secondwind", branch: "body", tier: 3, name: "Second Wind", ability: "secondwind", req: ["brace"], cost: { xp: 25000, funding: 15000 }, effect: "Ability: heal half your resolve on the spot." },
  { id: "medicine", branch: "body", tier: 3, name: "Field Medicine", req: ["conditioning"], cost: { xp: 1500000, funding: 60000 }, effect: "A knockout costs 1.5 seconds instead of 5." },
  { id: "stims", branch: "body", tier: 3, name: "Combat Stims", req: ["servo"], cost: { xp: 3000000, funding: 90000 }, effect: "Power and resolve up by half." },
  { id: "surge", branch: "body", tier: 4, name: "Surge", ability: "surge", req: ["stims"], cost: { xp: 6000000, funding: 150000 }, effect: "Ability: double damage for six seconds." },
  { id: "threat", branch: "body", tier: 4, name: "Threat Assessment", req: ["stims", "medicine"], cost: { xp: 40000000, funding: 400000 }, effect: "Moves you to the best district you can win, and takes on bosses when the odds are good." },
  { id: "overclock", branch: "body", tier: 5, name: "Overclock", req: ["threat"], cost: { xp: 400000000, funding: 3000000 }, effect: "Power and resolve doubled." },

  /* ---- MIND: amplify the amplifiers ---- */
  { id: "kinetics", branch: "mind", tier: 1, name: "Kinetic Study", amp: "reflex", req: [], cost: { xp: 120, salvage: 400 } },
  { id: "optics", branch: "mind", tier: 1, name: "Optic Implant", amp: "perception", req: [], cost: { xp: 320, leads: 900 } },
  { id: "myofiber", branch: "mind", tier: 2, name: "Myofiber Weave", amp: "strength", req: ["optics"], cost: { xp: 600, salvage: 2200 } },
  { id: "media", branch: "mind", tier: 2, name: "Media Training", amp: "presence", req: ["kinetics"], cost: { xp: 900, funding: 2500 } },
  { id: "tempo", branch: "mind", tier: 2, name: "Tempo", req: ["kinetics"], cost: { xp: 1500, leads: 2500 }, effect: "Abilities recharge 25% faster, knockouts pass 25% sooner." },
  { id: "memory", branch: "mind", tier: 3, name: "Muscle Memory", req: ["kinetics", "optics"], cost: { xp: 900000, funding: 45000 }, cut: { rank: 0.8 }, effect: "Power ranks cost 20% less XP." },
  { id: "instincts", branch: "mind", tier: 3, name: "Combat Instinct", amp: "instinct", req: ["myofiber", "media"], cost: { xp: 2000000, funding: 70000 } },
  { id: "focus", branch: "mind", tier: 4, name: "Deep Focus", req: ["memory"], cost: { xp: 30000000, funding: 350000 }, cut: { rank: 0.75 }, effect: "Power ranks cost another 25% less." },
  { id: "cascade", branch: "mind", tier: 4, name: "Power Cascade", req: ["instincts"], cost: { xp: 60000000, funding: 600000 }, effect: "Every power rank adds 1% to the region and 0.5% to combat." },
  { id: "mantle", branch: "mind", tier: 5, name: "The Mantle Protocol", req: ["cascade", "overclock", "boost", "smart"], cost: { funding: 40000000, xp: 3000000000 }, effect: "Lets you pass the cowl to a new hero." },

  /* ---- OPS: quality of life, earned rather than given ---- */
  { id: "bulkorders", branch: "ops", tier: 1, name: "Bulk Orders", req: [], cost: { salvage: 300, leads: 300 }, effect: "Buy ten at a time." },
  { id: "notes", branch: "ops", tier: 1, name: "Field Notes", req: [], cost: { leads: 250, salvage: 250 }, effect: "Shows how long until you can afford anything." },
  { id: "logistics", branch: "ops", tier: 2, name: "Logistics", req: ["bulkorders"], cost: { funding: 2500, salvage: 2000 }, effect: "Buy the most you can afford at once." },
  { id: "standing", branch: "ops", tier: 2, name: "Standing Orders", req: ["notes"], cost: { funding: 3500, leads: 2500 }, effect: "The build queue. Tap anything you can't afford and it waits in line." },
  { id: "command", branch: "ops", tier: 2, name: "Chain of Command", req: ["bulkorders"], cost: { funding: 4500, salvage: 3500 }, effect: "Crew work half again as hard, and new hands take the busiest job on their own." },
  { id: "triggers", branch: "ops", tier: 3, name: "Reflex Triggers", req: ["standing"], cost: { funding: 50000, xp: 400000 }, effect: "Fires every ability the moment it recharges, even while you're away." },
  { id: "autopilot", branch: "ops", tier: 3, name: "Autopilot", req: ["standing"], cost: { funding: 80000, xp: 1200000 }, effect: "Patrols twice a second without you." },
  { id: "archive", branch: "ops", tier: 3, name: "Deep Archive", req: ["logistics"], cost: { funding: 60000, leads: 40000 }, effect: "Offline progress counts for 24 hours instead of 8." },
  { id: "network", branch: "ops", tier: 3, name: "Fence Network", req: ["logistics"], cost: { funding: 90000, leads: 50000 }, effect: "A full lockup sells its overflow instead of wasting it." },
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
  bossRageAt: 0.4,       /* below this share of health a boss... */
  bossRage: 1.5,         /* ...hits this much harder */
  heldBonus: 0.1,        /* region bonus per boss beaten */
  safehouseEach: 0.05,   /* cooldowns divided by 1 + this per safehouse */
  gymEach: 0.08,         /* ability magnitude and duration, per floor */
  bossSimSeconds: 600,
  capBase: { leads: 900, salvage: 900, funding: 500 },
  capEach: { leads: 2600, salvage: 2600, funding: 1300 },
  capHeld: 0.25,          /* storage per district held */
  capTower: 0.1,          /* storage per signal tower */
  bedsBase: 2,
  bedsPer: 3,             /* beds per safehouse */
  crewJoin: 75,           /* seconds for one to walk in, before renown */
  crewUpkeep: 0.8,        /* funding a second for the first hand... */
  crewUpkeepStep: 1.055,  /* ...times this for each one after */
  crewQuit: 45,           /* seconds unpaid before someone walks */
  marketSpread: 3,        /* buying costs this much more than selling pays */
  marketDip: 0.22,        /* worst a single dump can move the price */
  marketRecover: 0.006,   /* share of the gap back to par, a second */
  marketFloor: 0.25,
  overflowRate: 0.5,      /* Fence Network sells overflow at half price */
  eventEvery: 420,        /* mean seconds between live events */
  achieveBonus: 0.005,
  logKeep: 40,
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
const abilityById = (id) => ABILITIES.find((a) => a.id === id);

const xpFor = (level) => TUNE.levelBase * (Math.pow(TUNE.levelRatio, level - 1) - 1);
const levelOf = (total) =>
  Math.floor(Math.log(1 + Math.max(0, total) / TUNE.levelBase) / Math.log(TUNE.levelRatio)) + 1;
const legacyFor = (f) => Math.floor(Math.sqrt(f / TUNE.legacyDivisor));

const freshFight = () => ({ enemyHP: 0, heroHP: 0, ko: 0, boss: false, cd: {}, buff: {}, cast: [], recheck: 0 });

const freshCrew = () => ({ n: 0, grow: 0, unpaid: 0, jobs: JOBS.reduce((o, j) => ((o[j.id] = 0), o), {}) });

const freshState = (legacy = 0) => ({
  hero: null,
  res: { leads: 0, salvage: 0, funding: 0, xp: 0 },
  own: { perch: 0, lockup: 0, yard: 0, watch: 0, safehouse: 0, informants: 0, gym: 0, precinct: 0, tower: 0 },
  gear: { rig: 0, padding: 0, trophy: 0, exo: 0 },
  ranks: {},
  tech: {},
  queue: [],
  district: "flats",
  cleared: {},
  bosses: {},
  fight: freshFight(),
  crew: freshCrew(),
  market: { leads: 1, salvage: 1 },
  autosell: {},
  projects: {},
  boon: null,
  log: [],
  time: 0,
  totalXP: 0,
  legacy,
  careerFunding: 0,
  /* these five outlive the career: handing the cowl on keeps them */
  allTimeFunding: 0,
  achieved: {},
  traded: 0,
  runs: 0,
});

/* Old saves predate bosses, crew, storage and projects: fill the gaps, and
   keep open any district the old fight-count gate had already opened. */
function migrate(saved) {
  const fresh = freshState();
  const st = saved || {};
  const back = {
    ...fresh, ...st,
    res: { ...fresh.res, ...st.res },
    own: { ...fresh.own, ...st.own },
    gear: { ...fresh.gear, ...st.gear },
    fight: { ...freshFight(), ...st.fight },
    crew: { ...freshCrew(), ...st.crew, jobs: { ...freshCrew().jobs, ...(st.crew || {}).jobs } },
    market: { ...fresh.market, ...st.market },
    autosell: { ...st.autosell },
    projects: { ...st.projects },
    achieved: { ...st.achieved },
    log: Array.isArray(st.log) ? st.log : [],
    tech: { ...st.tech },
    bosses: { ...st.bosses },
  };
  /* a save from before storage existed would otherwise sit at zero cap
     with a lockup it never had the chance to buy */
  if (!st.own || st.own.lockup === undefined) {
    const built = TERRITORY.reduce((n, t) => n + (back.own[t.id] || 0), 0);
    back.own.lockup = Math.min(40, Math.ceil(built / 4));
  }
  if (!st.bosses) {
    if (back.tech.secondwind) { delete back.tech.secondwind; back.tech.conditioning = true; }
    DISTRICTS.forEach((dist) => {
      if ((back.cleared[dist.id] || 0) >= dist.need) back.bosses[dist.id] = true;
    });
    back.fight = freshFight();
  }
  return back;
}

const heroById = (id) => HEROES.find((h) => h.id === id) || null;
const powersFor = (hero) => (hero ? [...POWERS, hero.signature] : POWERS);
const distById = (id) => DISTRICTS.find((x) => x.id === id) || DISTRICTS[0];
const unlocked = (s, i) => i === 0 || !!s.bosses[DISTRICTS[i - 1].id];
const bossReady = (s, dist) => !s.bosses[dist.id] && (s.cleared[dist.id] || 0) >= dist.need;

const jobById = (id) => JOBS.find((j) => j.id === id);
const projectById = (id) => PROJECTS.find((p) => p.id === id);

/* Crew assignments are clamped on read, so a safehouse lost to a reset or
   a hand who walked can never leave more people working than exist. */
function crewSplit(s) {
  const jobs = {};
  let used = 0;
  const n = Math.max(0, Math.floor((s.crew && s.crew.n) || 0));
  for (const j of JOBS) {
    const want = Math.max(0, Math.floor(((s.crew && s.crew.jobs) || {})[j.id] || 0));
    const got = Math.min(want, n - used);
    jobs[j.id] = got;
    used += got;
  }
  return { jobs, n, idle: n - used };
}

function derive(s, opts = {}) {
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
  const held = DISTRICTS.filter((x) => s.bosses[x.id]).length;
  const towerEach = tech.boost ? 0.2 : 0.1;
  const levelMult = 1 + TUNE.levelBonus * (level - 1);

  /* city projects: every completion stacks, and they never come back down */
  const proj = { region: 0, resolve: 0, power: 0, xp: 0, cap: 0 };
  let projCd = 1, projDone = 0;
  for (const pr of PROJECTS) {
    const n = (s.projects[pr.id] || {}).done || 0;
    if (!n) continue;
    projDone += n;
    for (const k in pr.gain) {
      if (k === "cd") projCd *= Math.pow(1 - pr.gain.cd, n);
      else proj[k] += pr.gain[k] * n;
    }
  }

  /* achievements outlive the career; each one is worth a little of everything */
  const badges = ACHIEVEMENTS.reduce((n, a) => n + (s.achieved[a.id] ? 1 : 0), 0);
  const badgeMult = 1 + TUNE.achieveBonus * badges;

  const boon = s.boon && s.boon.left > 0 ? s.boon : null;

  const global =
    mult.global * levelMult *
    (1 + TUNE.legacyBonus * s.legacy) *
    (1 + towerEach * s.own.tower) *
    (1 + TUNE.heldBonus * held) *
    (1 + proj.region) * badgeMult *
    (boon ? boon.mult : 1) *
    (tech.cascade ? 1 + 0.01 * totalRanks : 1);

  /* ---- crew: beds decide how many, jobs decide what they are worth ---- */
  const split = crewSplit(s);
  const beds = Math.floor((TUNE.bedsBase + TUNE.bedsPer * (s.own.safehouse || 0)) * (tech.recruit ? 1.5 : 1));
  const crewMult = tech.command ? 1.5 : 1;
  const crewMakes = { leads: 0, salvage: 0, funding: 0 };
  let crewCombat = 0, crewXP = 0;
  for (const j of JOBS) {
    const n = split.jobs[j.id];
    if (!n) continue;
    if (j.makes) for (const k in j.makes) crewMakes[k] += j.makes[k] * n * crewMult;
    if (j.combat) crewCombat += j.combat * n * crewMult;
    if (j.xp) crewXP += j.xp * n * crewMult;
  }
  const upkeep = split.n > 0 ? TUNE.crewUpkeep * (Math.pow(TUNE.crewUpkeepStep, split.n) - 1) / (TUNE.crewUpkeepStep - 1) : 0;

  const gross = {
    leads: (s.own.perch * 0.5 * bMult.perch + s.own.informants * 4 * bMult.informants + crewMakes.leads) * mult.leads * (mods.leads || 1) * global,
    salvage: (s.own.yard * 0.45 * bMult.yard + crewMakes.salvage) * mult.salvage * (mods.salvage || 1) * global,
    funding: (s.own.watch * 0.35 * bMult.watch + s.own.precinct * 3.5 * bMult.precinct + crewMakes.funding) * mult.funding * (mods.funding || 1) * global,
    xp: 0,
  };

  /* ---- storage: lockups set the ceiling, the tree and the city raise it ---- */
  let capMult = (1 + TUNE.capHeld * held) * (1 + TUNE.capTower * (s.own.tower || 0)) * (1 + proj.cap) * (1 + TUNE.legacyBonus * s.legacy);
  for (const t of TECH) if (tech[t.id] && t.cap) capMult *= t.cap;
  const caps = {};
  for (const k of ["leads", "salvage", "funding"])
    caps[k] = Math.floor((TUNE.capBase[k] + TUNE.capEach[k] * (s.own.lockup || 0)) * capMult);
  caps.xp = Infinity;

  /* ---- the market: par is 1, dumping sags it, time walks it back ---- */
  const price = {};
  for (const m of MARKET) price[m.id] = m.value * Math.max(TUNE.marketFloor, (s.market || {})[m.id] || 1);

  /* Combat deliberately does NOT use `global`. Economy multipliers scale the
     region; gear, power ranks and the Body branch scale the hero. Letting
     global into both made the survival gate grow as global squared. The two
     boss-opened buildings are the one bridge, and they only touch abilities. */
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
    (1 + crewCombat) * badgeMult *
    (tech.cascade ? 1 + 0.005 * totalRanks : 1) *
    (tech.stims ? 1.5 : 1) *
    (tech.overclock ? 2 : 1);
  const power = (1 + addPower) * mult.power * fightMult * (1 + proj.power);
  const resolve = (TUNE.baseResolve + addResolve) * mult.resolve * (mods.resolve || 1) * fightMult * (1 + proj.resolve);
  const xpMult = (1 + xpBonus) * mult.xp * (1 + proj.xp + crewXP);

  /* abilities: the tree opens them, the two buildings and Tempo shape them */
  const cdMult = projCd * (tech.tempo ? 0.75 : 1) / (1 + TUNE.safehouseEach * (s.own.safehouse || 0));
  const abilMult = 1 + TUNE.gymEach * (s.own.gym || 0);
  const abilities = ABILITIES.filter((a) => tech[a.tech]).map((a) => {
    const cd = a.cd * cdMult;
    return {
      ...a, cd,
      dur: a.dur ? Math.min(a.dur * abilMult, cd * 0.9) : 0,
      amount: a.kind === "hit" ? a.mag * power * abilMult
        : a.kind === "heal" ? Math.min(resolve, a.mag * resolve * abilMult)
        : a.mag,
    };
  });
  const auto = !!tech.triggers || !!opts.auto;

  /* What auto-fire adds on average, for the readouts. The survival test
     stays on raw stats: bursts are lumpy and a fight shorter than a
     cooldown can't count on one. */
  let burst = 0, cover = 0;
  for (const a of abilities) {
    if (a.kind === "hit") burst += a.amount / a.cd;
    else if (a.kind === "boost") burst += power * (a.mag - 1) * a.dur / a.cd;
    else if (a.kind === "guard") cover += a.mag * a.dur / a.cd;
  }
  const sustain = auto ? power + burst : power;
  const intake = auto ? 1 - Math.min(0.9, cover) : 1;

  const dist = distById(s.district);
  const ttk = power > 0 ? dist.hp / power : Infinity;
  const damageTaken = dist.dps * ttk;
  const winnable = damageTaken < resolve;
  const ttkEff = dist.hp / sustain;
  const xpRate = winnable ? (dist.xp * xpMult) / ttkEff : 0;
  gross.xp = xpRate;

  const patrol = mult.patrol * (mods.patrol || 1) * levelMult * (1 + TUNE.legacyBonus * s.legacy);
  const floorXP = xpFor(level);
  const nextXP = xpFor(level + 1);

  return {
    hero, powers, mult, bMult, cut, level, levelMult, global, gross, totalRanks, towerEach, held,
    caps, capMult, price, proj, projCd, projDone, badges, badgeMult, boon,
    crew: split, beds, crewMult, crewMakes, crewCombat, crewXP, upkeep,
    patrol, power, resolve, xpMult, fightMult, dist, ttk, ttkEff, damageTaken, winnable, xpRate,
    abilities, auto, cdMult, abilMult, sustain, intake,
    ko: (tech.medicine ? TUNE.koFast : TUNE.koSeconds) * cdMult,
    healthLeft: Math.max(0, 1 - damageTaken / resolve),
    xpInto: s.totalXP - floorXP,
    xpNeed: nextXP - floorXP,
    xpPct: Math.min(100, ((s.totalXP - floorXP) / (nextXP - floorXP)) * 100),
    region: TERRITORY.reduce((n, t) => n + (s.own[t.id] || 0), 0),
    full: ["leads", "salvage", "funding"].filter((k) => s.res[k] >= caps[k] - 1e-9),
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

/* What `share` of the next copy of a project costs. Progress is kept, so
   a project can be paid for in any number of slices. */
function projectCost(pr, done, share, discount = 1) {
  const out = {};
  for (const k in pr.base) out[k] = Math.ceil(pr.base[k] * Math.pow(pr.growth, done) * share * discount);
  return out;
}

const projectAt = (s, pr) => s.projects[pr.id] || { done: 0, prog: 0 };

/* The most of a project you could pay for right now, as a share of the whole. */
function projectMax(s, pr, discount) {
  const at = projectAt(s, pr);
  const left = 1 - at.prog;
  let lo = 0, hi = left;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (canPay(projectCost(pr, at.done, mid, discount), s.res)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/* A sale floods the market: the bigger the dump relative to what you can
   hold, the further the price sags, and it walks back up on its own. */
const marketDip = (qty, cap) => 1 - TUNE.marketDip * (qty / (qty + Math.max(1, cap) * 0.25));
const canPay = (cost, res) => Object.keys(cost).every((k) => res[k] >= cost[k]);

function maxAffordable(item, own, res, discount) {
  let n = 0;
  while (n < 1000 && canPay(costOf(item, own, n + 1, discount), res)) n++;
  return n;
}

/* When auto-fire is on, would this ability be worth using right now? */
function wants(a, f, d) {
  if (a.kind === "hit") return f.enemyHP > 0;
  if (a.kind === "guard" || a.kind === "boost") return !(f.buff[a.id] > 0);
  if (a.kind === "heal") return f.heroHP <= d.resolve - a.amount + 1e-9;
  return false;
}

/* Resolves the auto battle for dt seconds — one partial swing or thousands
   of kills, so the live tick, the offline catch-up and the boss forecast
   share a code path. Abilities fire here too: tapped ones arrive in
   fight.cast, and Reflex Triggers fires the rest on its own. */
function combatStep(s, dt, d) {
  const dist = d.dist;
  const f = s.fight;
  let isBoss = !!f.boss && !!dist.boss;
  const boss = dist.boss;
  let { enemyHP, heroHP, ko } = f;
  const cd = { ...f.cd }, buff = { ...f.buff };
  let cast = f.cast && f.cast.length ? f.cast : null;
  const foeHP = () => (isBoss ? boss.hp : dist.hp);
  if (!(enemyHP > 0) || enemyHP > foeHP()) enemyHP = foeHP();
  if (!(heroHP > 0) || heroHP > d.resolve) heroHP = ko > 0 ? 0 : d.resolve;

  let xp = 0, kills = 0, bossWin = false, heroAtWin = 0, t = dt, guard = 0;
  const tick = (dt) => {
    for (const k in cd) { cd[k] -= dt; if (cd[k] <= 1e-9) delete cd[k]; }
    for (const k in buff) { buff[k] -= dt; if (buff[k] <= 1e-9) delete buff[k]; }
  };
  const fire = (a) => {
    if (a.kind === "hit") enemyHP -= a.amount;
    else if (a.kind === "heal") heroHP = Math.min(d.resolve, heroHP + a.amount);
    else buff[a.id] = a.dur;
    cd[a.id] = a.cd;
  };
  const win = () => {
    if (isBoss) { bossWin = true; heroAtWin = heroHP; isBoss = false; xp += boss.xp * d.xpMult; for (const k in buff) delete buff[k]; }
    else { kills++; xp += dist.xp * d.xpMult; }
    enemyHP = foeHP();
    heroHP = d.resolve;
  };

  while (t > 1e-9 && guard++ < 5000) {
    if (ko > 0) {
      const spend = Math.min(t, ko);
      ko -= spend; t -= spend; tick(spend);
      if (ko <= 1e-9) { ko = 0; heroHP = d.resolve; enemyHP = foeHP(); }
      continue;
    }

    for (const a of d.abilities) {
      if (cd[a.id] > 0) continue;
      const asked = cast && cast.includes(a.id);
      if (asked || (d.auto && wants(a, { enemyHP, heroHP, buff }, d))) fire(a);
    }
    cast = null;
    if (enemyHP <= 1e-9) { win(); continue; }

    /* A clean, winnable, ability-free cycle repeats exactly: batch it. */
    const quiet = !isBoss && !Object.keys(buff).length && !(d.auto && d.abilities.length);
    if (quiet && enemyHP === dist.hp && heroHP === d.resolve && d.winnable) {
      const n = Math.floor(t / d.ttk);
      if (n >= 2) { kills += n; xp += n * dist.xp * d.xpMult; t -= n * d.ttk; tick(n * d.ttk); continue; }
    }

    let pw = d.power, inc = isBoss ? boss.dps : dist.dps;
    for (const a of d.abilities) {
      if (!(buff[a.id] > 0)) continue;
      if (a.kind === "boost") pw *= a.mag;
      else if (a.kind === "guard") inc *= 1 - a.mag;
    }
    const rageLine = isBoss ? boss.hp * TUNE.bossRageAt : 0;
    const raging = isBoss && enemyHP <= rageLine;
    if (raging) inc *= TUNE.bossRage;

    const events = [t, pw > 0 ? enemyHP / pw : Infinity, inc > 0 ? heroHP / inc : Infinity];
    if (isBoss && !raging && pw > 0) events.push((enemyHP - rageLine) / pw);
    for (const k in buff) events.push(buff[k]);
    if (d.auto) for (const k in cd) events.push(cd[k]);
    const next = Math.max(0, Math.min(...events));

    enemyHP -= pw * next;
    heroHP -= inc * next;
    t -= next;
    tick(next);
    if (enemyHP <= 1e-9) win();
    else if (heroHP <= 1e-9) {
      heroHP = 0; ko = d.ko;
      if (isBoss) { isBoss = false; for (const k in buff) delete buff[k]; }
    }
  }
  return { fight: { ...f, enemyHP, heroHP, ko, boss: isBoss, cd, buff, cast: [] }, xp, kills, bossWin, heroAtWin };
}

const startBoss = (d) => ({ ...freshFight(), enemyHP: d.dist.boss.hp, heroHP: d.resolve, boss: true });

/* Plays the boss fight out with every ability fired on recharge. It is
   deterministic, so this is exactly what auto-fire would do, and the best
   a player tapping on time can do. */
function forecastBoss(s, d, auto = true) {
  if (!d.dist.boss) return { win: false, time: Infinity, left: 0 };
  const dd = auto === d.auto ? d : derive(s, { auto });
  let sim = { ...s, fight: startBoss(dd) };
  const slice = 0.5;
  for (let t = 0; t < TUNE.bossSimSeconds; t += slice) {
    const c = combatStep(sim, slice, dd);
    if (c.bossWin) return { win: true, time: t + slice, left: c.heroAtWin / dd.resolve };
    if (!c.fight.boss) return { win: false, time: t + slice, left: 1 - sim.fight.enemyHP / dd.dist.boss.hp };
    sim = { ...sim, fight: c.fight };
  }
  return { win: false, time: Infinity, left: 0 };
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

/* Income stops at the ceiling; windfalls — bounties, gifts, a sale — do
   not, so nothing you actually won is ever thrown away for want of a
   lockup. What income spills is either sold by the Fence Network or lost. */
function pour(res, caps, k, n, spill) {
  if (!(n > 0)) return;
  if (k === "xp") { res.xp += n; return; }
  const room = Math.max(0, caps[k] - res[k]);
  res[k] += Math.min(n, room);
  if (spill && n > room) spill[k] = (spill[k] || 0) + (n - room);
}

const logged = (list, t, text) => [...list, { t: Math.floor(t), text }].slice(-TUNE.logKeep);

function step(s, dt, opts = {}) {
  const d = derive(s, opts);
  const res = { ...s.res };
  const caps = d.caps;
  const spill = {};
  const note = [];
  for (const k of RES_IDS) if (k !== "xp") pour(res, caps, k, d.gross[k] * dt, spill);

  if (s.tech.autopilot) {
    const auto = d.patrol * TUNE.autopilotRate * dt;
    pour(res, caps, "leads", auto, spill);
    pour(res, caps, "salvage", auto, spill);
  }

  /* ---- crew: they turn up if there is a bed, and leave if unpaid ---- */
  let crew = s.crew, traded = s.traded;
  {
    const c = { ...s.crew, jobs: { ...s.crew.jobs } };
    if (c.n < d.beds) {
      c.grow += (dt * (1 + 0.15 * d.held)) / TUNE.crewJoin;
      while (c.grow >= 1 && c.n < d.beds) {
        c.grow -= 1;
        c.n += 1;
        /* A new hand always picks something up — an idle one still draws
           payroll, and quietly bleeding crew nobody assigned is a trap.
           Chain of Command puts them where the fewest are, keeping the
           outfit even; without it they follow the crowd, and Outreach
           takes the first one so the wages pay for themselves. */
        const pick = s.tech.command
          ? JOBS.reduce((a, b) => ((c.jobs[a.id] || 0) <= (c.jobs[b.id] || 0) ? a : b))
          : JOBS.reduce((a, b) => ((c.jobs[b.id] || 0) > (c.jobs[a.id] || 0) ? b : a), jobById("outreach"));
        c.jobs[pick.id] = (c.jobs[pick.id] || 0) + 1;
      }
      if (c.n >= d.beds) c.grow = 0;
    } else c.grow = 0;

    const owed = d.upkeep * dt;
    if (res.funding >= owed) {
      res.funding -= owed;
      c.unpaid = 0;
    } else {
      res.funding = 0;
      c.unpaid += dt;
      while (c.unpaid >= TUNE.crewQuit && c.n > 0) {
        c.unpaid -= TUNE.crewQuit;
        c.n -= 1;
        const busiest = JOBS.filter((j) => (c.jobs[j.id] || 0) > 0).sort((a, b) => c.jobs[b.id] - c.jobs[a.id])[0];
        if (busiest) c.jobs[busiest.id] -= 1;
        note.push("Payroll came up short. Somebody handed their key back.");
      }
    }
    crew = c;
  }

  /* ---- the market walks back to par, and sells the overflow if told to ---- */
  const market = { ...s.market };
  for (const m of MARKET) {
    const idx = market[m.id] ?? 1;
    if (idx !== 1) market[m.id] = 1 + (idx - 1) * Math.exp(-TUNE.marketRecover * dt);
    if (s.tech.network && spill[m.id] > 0 && s.autosell[m.id] !== false) {
      const paid = spill[m.id] * d.price[m.id] * TUNE.overflowRate;
      pour(res, caps, "funding", paid, null);
      traded += paid;
      spill[m.id] = 0;
    }
  }

  const c = combatStep(s, dt, d);
  res.xp += c.xp;

  const q = queueStep(s, res, d);
  const next = {
    ...s,
    res,
    crew,
    market,
    traded,
    fight: c.fight,
    time: (s.time || 0) + dt,
    cleared: c.kills ? { ...s.cleared, [s.district]: (s.cleared[s.district] || 0) + c.kills } : s.cleared,
    totalXP: s.totalXP + c.xp,
    careerFunding: s.careerFunding + d.gross.funding * dt,
    allTimeFunding: s.allTimeFunding + d.gross.funding * dt,
  };
  if (s.boon) {
    const left = s.boon.left - dt;
    next.boon = left > 0 ? { ...s.boon, left } : null;
  }
  if (c.bossWin) {
    next.bosses = { ...s.bosses, [d.dist.id]: true };
    for (const k in d.dist.boss.bounty) res[k] += d.dist.boss.bounty[k];
    note.push(`${d.dist.boss.name} is down. ${d.dist.name} is yours.`);
  }
  if (q) {
    next.queue = q.queue;
    if (q.key) next[q.key] = q.bucket;
  }
  /* Threat Assessment: climb when you can, and take the boss on when the
     forecast says it's won — checked a few times a minute, not every tick. */
  if ((s.tech.threat || opts.climb) && !next.fight.boss) {
    const best = bestDistrict(next, d);
    if (best !== next.district) {
      next.district = best;
      next.fight = freshFight();
    } else {
      const recheck = (next.fight.recheck || 0) - dt;
      if (recheck > 0) next.fight = { ...next.fight, recheck };
      else if (bossReady(next, d.dist) && next.fight.ko <= 0) {
        next.fight = forecastBoss(next, d, d.auto).win ? startBoss(d) : { ...next.fight, recheck: 15 };
      } else next.fight = { ...next.fight, recheck: 15 };
    }
  }

  /* Live-play only: a long offline catch-up runs in slices of minutes, and
     rolling an event per slice would turn leaving into a strategy. */
  if (dt <= 5 && !opts.quiet && Math.random() < dt / TUNE.eventEvery) {
    const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    if (e.boon) {
      next.boon = { id: e.id, mult: e.boon.mult, left: e.boon.dur };
      note.push(`${e.text} ×${e.boon.mult} region for ${Math.round(e.boon.dur)}s.`);
    } else {
      const gain = Math.max(caps[e.res] * 0.06, d.gross[e.res] * e.secs);
      next.res = { ...next.res, [e.res]: next.res[e.res] + gain };
      note.push(`${e.text} +${amt(gain)} ${nameOf(e.res).toLowerCase()}.`);
    }
  }

  /* Achievements are checked on the state we are about to hand back, and
     are kept when the cowl changes hands. */
  const lv = { level: levelOf(next.totalXP) };
  for (const a of ACHIEVEMENTS) {
    if (next.achieved[a.id]) continue;
    let hit = false;
    try { hit = !!a.test(next, lv); } catch { hit = false; }
    if (!hit) continue;
    next.achieved = { ...next.achieved, [a.id]: true };
    note.push(`Achievement: ${a.name}. +${(TUNE.achieveBonus * 100).toFixed(1)}% to everything, for good.`);
  }

  if (note.length) next.log = note.reduce((l, text) => logged(l, next.time, text), s.log || []);
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
const pct = (n) => (Math.abs(n) < 0.01 && n !== 0 ? (n * 100).toFixed(1) : (n * 100).toFixed(0)) + "%";
const nameOf = (id) => RESOURCES.find((r) => r.id === id)?.name ?? id;
const toneOf = (id) => RESOURCES.find((r) => r.id === id)?.tone ?? "plain";

/* Exposed for the balance script in scripts/. Not used by the UI. */
export const engine = {
  RESOURCES, HEROES, POWERS, DISTRICTS, ABILITIES, GEAR, TERRITORY, TECH, TUNE,
  JOBS, PROJECTS, MARKET, ACHIEVEMENTS,
  freshState, migrate, derive, step, costOf, powerCost, canPay, maxAffordable,
  unlocked, bossReady, forecastBoss, startBoss, bestDistrict, levelOf,
  crewSplit, projectCost, projectMax, projectAt, marketDip,
};

/* ============================ THE HOOK ============================ */

function useGame() {
  const [s, setS] = useState(() => freshState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("fight");
  const [branch, setBranch] = useState("street");
  const [rawMode, setMode] = useState(1);
  const [away, setAway] = useState(null);
  const [news, setNews] = useState(null);
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
        let back = migrate(saved.state);
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

  /* A boss went down: say so once, and say what it opened. */
  const seenRef = useRef(null);
  useEffect(() => {
    if (!ready) return;
    const prev = seenRef.current;
    seenRef.current = s.bosses;
    if (!prev || !s.hero) return;
    const i = DISTRICTS.findIndex((x) => s.bosses[x.id] && !prev[x.id]);
    if (i < 0) return;
    const dist = DISTRICTS[i];
    const opened = [];
    if (DISTRICTS[i + 1]) opened.push(`${DISTRICTS[i + 1].name} is open`);
    if (dist.id === "flats") opened.push("the Safehouse is in Region");
    if (dist.id === "docks") opened.push("the Training Floor is in Region");
    setNews(`${dist.boss.name} is down. ${opened.join(", ")}${opened.length ? ". " : ""}+${pct(TUNE.heldBonus)} region while you hold ${dist.name}.`);
  }, [ready, s.hero, s.bosses]);

  /* Buy modes are Ops tech, so clamp if the player prestiged out of them. */
  const modes = [1, ...(s.tech.bulkorders ? [10] : []), ...(s.tech.logistics ? ["max"] : [])];
  const mode = modes.includes(rawMode) ? rawMode : 1;

  /* ---- boss forecast, recomputed only when the inputs move ---- */
  const bossKey = [s.district, d.power.toFixed(3), d.resolve.toFixed(3), d.cdMult.toFixed(4), d.abilMult.toFixed(4), d.abilities.map((a) => a.id).join()].join("|");
  const forecast = useMemo(() => forecastBoss(s, d, true), [bossKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  /* hover-only tips, for buttons whose tap already does something */
  const hoverTip = (id, title, body) => ({
    onPointerEnter: (e) => e.pointerType === "mouse" && showTip(e, id, title, body, "hover"),
    onPointerLeave: (e) => e.pointerType === "mouse" && setTip(null),
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
  const overCap = (cost) => Object.keys(cost).some((k) => k !== "xp" && cost[k] > d.caps[k]);
  const etaLabel = (cost, ok) => (ok ? null : overCap(cost) ? "no room" : !s.tech.notes ? null : secs(eta(cost)));

  /* ---- tooltip copy ---- */
  const RES_TEXT = {
    leads: "Street tips and dispatch chatter. Perches and informants pull them in, and most of the region is paid for in leads and salvage.",
    salvage: "Wreckage stripped after a fight. The cheapest thing the city makes, and what your early gear is built from.",
    funding: "Cash. The expensive half of the region runs on it, and your career is scored on how much of it you take in.",
    xp: "Experience, and the only thing powers cost. It comes from winning fights and nowhere else. Every point you have ever earned counts toward your level, so spending it never slows you down.",
  };
  const resTip = (id) =>
    id === "xp"
      ? `${RES_TEXT.xp} ${d.winnable ? `${d.dist.name} is paying ${rate(d.xpRate)}/s${d.auto ? ", abilities included" : ""}.` : `You aren't clearing ${d.dist.name}, so nothing is coming in.`} Nothing caps XP.`
      : `${RES_TEXT[id]} Coming in at ${rate(d.gross[id])}/s, and you can hold ${amt(d.caps[id])}. ` +
        (s.res[id] >= d.caps[id] - 1e-9
          ? `You are full: income is spilling${s.tech.network && id !== "funding" && s.autosell[id] !== false ? ", though the Fence Network is selling it" : " and being lost"}. Buy a Lockup.`
          : `Lockups raise that; bounties and gifts can go over it.`);

  const levelTip = () =>
    `Level ${d.level}, off ${amt(s.totalXP)} XP earned this career. Each level above the first adds ${pct(TUNE.levelBonus)} to the region, so level alone has you at ${x(d.levelMult)}. ` +
    `${amt(Math.max(0, d.xpNeed - d.xpInto))} more XP to level ${d.level + 1}.`;

  const heroTip = () =>
    d.hero
      ? `${d.hero.epithet} ${d.hero.perk} ${d.hero.signature.name} can only be bought while you wear this cowl. Level, towers, research and the ${d.held} district${d.held === 1 ? "" : "s"} you hold have the region running at ${x(d.global)}.`
      : "";

  const fightTip = () =>
    `An auto battle. You deal ${rate(d.power)} damage a second and can absorb ${amt(d.resolve)} before you go down. ` +
    `${d.dist.name} has ${amt(d.dist.hp)} health and hits for ${rate(d.dist.dps)}/s, so a fight takes ${secs(d.ttk)} and costs ${amt(d.damageTaken)} health. ` +
    (d.winnable
      ? `You finish with ${pct(d.healthLeft)} left and heal between fights, so this district farms forever.`
      : `That's more than you have, so you go down at about ${pct(d.resolve / d.damageTaken)} of the way through. More Impact to finish sooner, more Endurance to last.`) +
    (d.abilities.length ? " Abilities recharge between fights and fire into the next one." : "");

  const distTip = (dist, i, open) =>
    open
      ? `${dist.foes.join(", ")}. ${amt(dist.hp)} health, hits for ${rate(dist.dps)}/s, pays ${amt(dist.xp)} XP a kill. You have cleared ${amt(s.cleared[dist.id] || 0)}${s.bosses[dist.id] ? ` and beaten ${dist.boss.name}` : ""}.`
      : `Locked. Beat ${DISTRICTS[i - 1].boss.name} in ${DISTRICTS[i - 1].name} to open it.`;

  const bossTip = () => {
    const b = d.dist.boss;
    const f = forecast;
    const gate = s.bosses[d.dist.id]
      ? "Beaten. This district is held: +" + pct(TUNE.heldBonus) + " to everything the region makes."
      : bossReady(s, d.dist)
        ? (f.win ? `With every ability fired on recharge you win in about ${secs(f.time)} with ${pct(f.left)} left.` : `Fired on recharge, your abilities get ${pct(f.left)} of the way through before you go down. More gear, ranks, or a Safehouse or two.`)
        : `Clear ${d.dist.need - d.cleared} more fights here and the boss comes out.`;
    return `${b.blurb} ${amt(b.hp)} health, hits for ${rate(b.dps)}/s, and at ${pct(TUNE.bossRageAt)} health hits ${TUNE.bossRage}× harder. Pays ${amt(b.xp * d.xpMult)} XP and a bounty of ${Object.keys(b.bounty).map((k) => `${amt(b.bounty[k])} ${nameOf(k).toLowerCase()}`).join(", ")}. Going down ends the attempt; you can try again for free. ${gate}`;
  };

  const abilityTip = (a) => {
    const what =
      a.kind === "hit" ? `lands ${amt(a.amount)} damage at once, ${a.mag} seconds of your power`
      : a.kind === "guard" ? `cuts incoming damage by ${pct(a.mag)} for ${a.dur.toFixed(1)}s`
      : a.kind === "heal" ? `heals ${amt(a.amount)} resolve on the spot`
      : `doubles your damage for ${a.dur.toFixed(1)}s`;
    return `${a.blurb} ${a.name} ${what}, then recharges for ${a.cd.toFixed(1)}s. Key ${a.key}. Safehouses shorten the recharge, Training Floors raise what it does${d.auto ? ", and Reflex Triggers fires it for you" : ""}.`;
  };

  const abilitiesTip = () =>
    d.abilities.map((a) => `${a.name} (${a.key}): ${a.kind === "hit" ? amt(a.amount) + " damage" : a.kind === "guard" ? "−" + pct(a.mag) + " damage taken for " + a.dur.toFixed(1) + "s" : a.kind === "heal" ? "heal " + amt(a.amount) : "×" + a.mag + " damage for " + a.dur.toFixed(1) + "s"}, ${a.cd.toFixed(1)}s recharge.`).join(" ") +
    (d.auto ? " Reflex Triggers fires them on recharge." : " Tap, or press the key. Reflex Triggers in Ops fires them for you.");

  const resMod = (d.hero?.mods || {}).resolve || 1;
  const gearTip = (gi) => {
    const n = s.gear[gi.id] || 0;
    const what =
      gi.stat === "power" ? `+${gi.per} base power each`
      : gi.stat === "resolve" ? `+${gi.per} base resolve each`
      : gi.stat === "xp" ? `+${pct(gi.per)} XP per kill each`
      : `+${gi.power} power and +${gi.resolve} resolve each`;
    return `${gi.blurb} ${what}. You own ${n}. Gear sets your base stats and power ranks multiply them, so the two compound. Region bonuses like levels and towers never touch combat.`;
  };

  const terrTip = (t) => {
    const own = s.own[t.id] || 0;
    if (t.id === "lockup")
      return `${t.blurb} Each one holds another ${amt(TUNE.capEach.leads * d.capMult)} leads and salvage and ${amt(TUNE.capEach.funding * d.capMult)} funding. ` +
        `Income stops dead at the ceiling — a bounty, a gift or a sale can go over it, but nothing you produce will. ${own} of them have you at ${amt(d.caps.funding)} funding.`;
    if (t.id === "tower") return `${t.blurb} Each one adds ${pct(d.towerEach)} to everything the region produces, and they stack.`;
    if (t.id === "safehouse") return `${t.blurb} Each one cuts ability recharge and knockout time by another ${pct(TUNE.safehouseEach)} of the base. ${own} of them have recharge at ${x(1 / (1 + TUNE.safehouseEach * own))}.`;
    if (t.id === "gym") return `${t.blurb} Each one adds ${pct(TUNE.gymEach)} to what every ability does: Haymaker damage, Second Wind healing, and how long Brace and Surge last. ${own} of them have abilities at ${x(d.abilMult)}.`;
    if (!t.makes) return `${t.blurb} You hold ${own}.`;
    const each = (t.id === "informants" ? 4 : t.rate) * d.bMult[t.id] * d.mult[t.makes] * ((d.hero?.mods || {})[t.makes] || 1) * d.global;
    return `${t.blurb} You hold ${own}, at ${rate(each * own)} ${nameOf(t.makes).toLowerCase()} a second. Tech has these at ${x(d.bMult[t.id])} and your powers at ${x(d.mult[t.makes])}. Each costs ${pct(t.growth - 1)} more than the last.`;
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
      ? ` ${techById(ampId).name} doubled this, so a rank is worth ${pct(per)} instead of ${pct(p.per)}.`
      : ampId ? ` ${techById(ampId).name} in the tree would make every rank of this worth double.` : "";
    return `${p.blurb} Each rank adds ${pct(per)} to ${target}. Rank ${rank} has you at ${x(1 + per * rank)}.${labLine}`;
  };

  const all = [...POWERS, ...HEROES.map((h) => h.signature)];
  const techEffect = (t) =>
    t.amp ? `Every rank of ${all.find((p) => p.id === t.amp)?.name} counts double` : t.effect;

  const techTip = (t) => {
    const opens = TECH.filter((o) => o.req.includes(t.id)).map((o) => o.name);
    const missing = t.req.filter((r) => !s.tech[r]).map((r) => techById(r).name);
    const a = t.ability && abilityById(t.ability);
    return (
      `${techEffect(t)}. ` +
      (a ? `${a.blurb} Recharges in ${a.cd}s. ` : "") +
      `Bought once and it holds for the rest of this career. ` +
      (missing.length ? `Still needs: ${missing.join(", ")}. ` : "") +
      (opens.length ? `Opens: ${opens.join(", ")}.` : "Nothing else is waiting on it.")
    );
  };

  const queueTip = () =>
    `Anything you can't afford goes in here when you tap it, and buys itself the moment the money lands. ` +
    (s.tech.smart
      ? `Smart Queue is running, so orders go to the back of the line instead of clearing — the queue cycles forever.`
      : `Each order clears once bought. Smart Queue in the Ops branch makes them repeat.`);

  const storageTip = () =>
    `Every lockup you hold raises the ceiling on leads, salvage and funding. Income stops dead at the ceiling — a bounty, a gift or a sale can go over it, but nothing you produce will. ` +
    `Holding districts, signal towers, the Archive Spire and the storage tree all widen it; you are at ${x(d.caps.funding / (TUNE.capBase.funding + TUNE.capEach.funding * (s.own.lockup || 0)))} on the base.`;

  const crewTip = () =>
    `People who work for you. Safehouses are beds and beds are the only reason anyone stays, so ${d.beds} is your ceiling; one more walks in every ${Math.round(TUNE.crewJoin / (1 + 0.15 * d.held))}s while there is room. ` +
    `Payroll runs at ${rate(d.upkeep)} funding a second and climbs steeply with the size of the outfit — miss it for ${TUNE.crewQuit}s and somebody hands their key back. ` +
    `New hands put themselves to work on the way in${s.tech.command ? ", on whichever job has the fewest" : ", following whoever is busiest"}. ` +
    (d.crew.idle ? `${d.crew.idle} of them are standing around doing nothing.` : `All ${d.crew.n} are working.`);

  const jobTip = (j) => {
    const n = d.crew.jobs[j.id] || 0;
    const what = j.makes
      ? Object.keys(j.makes).map((k) => `${rate(j.makes[k] * d.crewMult * d.mult[k] * ((d.hero?.mods || {})[k] || 1) * d.global)} ${nameOf(k).toLowerCase()}/s`).join(" and ")
      : j.combat ? `+${pct(j.combat * d.crewMult)} power and resolve`
      : `+${pct(j.xp * d.crewMult)} XP a kill`;
    return `${j.blurb} Each hand on this is worth ${what}. ${n} assigned${s.tech.command ? ", and Chain of Command has them working half again as hard" : ""}.`;
  };

  const marketTip = (id) =>
    `${nameOf(id)} moves at ${rate(d.price[id])} funding each, ${pct((s.market[id] ?? 1))} of par. ` +
    `Dumping a pile floods the market and the price sags; leave it alone and it walks back to par on its own. Buying back costs ${TUNE.marketSpread}× what selling pays, which is the whole reason a fence has a house. ` +
    (s.tech.network ? `Fence Network is ${s.autosell[id] === false ? "off for this one" : "selling the overflow at half price"}.` : `Fence Network in Ops would sell your overflow for you.`);

  const projectTip = (pr) => {
    const at = projectAt(s, pr);
    return `${pr.blurb} Every one finished is ${pr.effect.toLowerCase()}, and it never comes back down. ` +
      `${at.done} finished, ${pct(at.prog)} of the way into the next. Pay any slice you like — progress is kept, and the next one costs ${pct(pr.growth - 1)} more than the last.`;
  };

  const achieveTip = () =>
    `Every one is worth +${pct(TUNE.achieveBonus)} to the region and to the fight, and they are the one thing besides legacy that survives passing the cowl on. ${d.badges} of ${ACHIEVEMENTS.length} so far, running at ${x(d.badgeMult)}.`;

  const legacyTip = () =>
    `Left behind by every hero before you. Each point adds ${pct(TUNE.legacyBonus)} to the region and to combat, and never goes away. Passing the cowl is the only way to earn it, and the only thing it doesn't burn.`;

  /* ---- actions ---- */
  const choose = (id) => setS((p) => ({ ...p, hero: id }));
  const setDistrict = (id) => setS((p) => (p.district === id ? p : { ...p, district: id, fight: freshFight() }));

  const patrol = () =>
    setS((p) => {
      const gain = derive(p).patrol;
      return { ...p, res: { ...p.res, leads: p.res.leads + gain, salvage: p.res.salvage + gain } };
    });

  const cast = (id) =>
    setS((p) => {
      const f = p.fight;
      if (f.ko > 0 || f.cd[id] > 0 || f.cast.includes(id)) return p;
      if (!ABILITIES.some((a) => a.id === id && p.tech[a.tech])) return p;
      return { ...p, fight: { ...f, cast: [...f.cast, id] } };
    });

  const challenge = () =>
    setS((p) => {
      const dd = derive(p);
      if (p.fight.boss || !bossReady(p, dd.dist)) return p;
      return { ...p, fight: startBoss(dd) };
    });
  const retreat = () => setS((p) => (p.fight.boss ? { ...p, fight: freshFight() } : p));

  /* 1–4 fire abilities from the keyboard on the fight tab */
  useEffect(() => {
    if (!ready || tab !== "fight") return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = ABILITIES.find((a) => a.key === e.key);
      if (a) cast(a.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, tab]);

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

  /* ---- crew ---- */
  const assign = (jobId, n) =>
    setS((p) => {
      const split = crewSplit(p);
      const have = split.jobs[jobId] || 0;
      const want = n === "max" ? have + split.idle : n === "none" ? 0 : Math.max(0, Math.min(have + n, have + split.idle));
      if (want === have) return p;
      return { ...p, crew: { ...p.crew, jobs: { ...split.jobs, [jobId]: want } } };
    });
  const spreadCrew = () =>
    setS((p) => {
      const split = crewSplit(p);
      const each = Math.floor(split.n / JOBS.length);
      const jobs = {};
      JOBS.forEach((j, i) => (jobs[j.id] = each + (i < split.n % JOBS.length ? 1 : 0)));
      return { ...p, crew: { ...p.crew, jobs } };
    });
  const clearCrew = () => setS((p) => ({ ...p, crew: { ...p.crew, jobs: freshCrew().jobs } }));

  /* ---- market ---- */
  const sell = (id, share) =>
    setS((p) => {
      const dd = derive(p);
      const price = dd.price[id];
      const room = Math.max(0, dd.caps.funding - p.res.funding);
      const qty = Math.min(p.res[id] * share, price > 0 ? room / price : 0);
      if (!(qty > 0.5)) return p;
      const paid = qty * price;
      return {
        ...p,
        res: { ...p.res, [id]: p.res[id] - qty, funding: p.res.funding + paid },
        market: { ...p.market, [id]: Math.max(TUNE.marketFloor, (p.market[id] ?? 1) * marketDip(qty, dd.caps[id])) },
        traded: p.traded + paid,
      };
    });

  const acquire = (id, share) =>
    setS((p) => {
      const dd = derive(p);
      const unit = dd.price[id] * TUNE.marketSpread;
      const room = Math.max(0, dd.caps[id] - p.res[id]);
      const qty = Math.min(room, unit > 0 ? (p.res.funding * share) / unit : 0);
      if (!(qty > 0.5)) return p;
      const spent = qty * unit;
      return {
        ...p,
        res: { ...p.res, [id]: p.res[id] + qty, funding: p.res.funding - spent },
        traded: p.traded + spent,
      };
    });

  const toggleSell = (id) =>
    setS((p) => ({ ...p, autosell: { ...p.autosell, [id]: p.autosell[id] === false } }));

  /* ---- city projects ---- */
  const fund = (pr, share) =>
    setS((p) => {
      const dd = derive(p);
      const at = projectAt(p, pr);
      const want = share === "max" ? projectMax(p, pr, dd.cut.tech) : Math.min(share, 1 - at.prog);
      if (!(want > 1e-4)) return p;
      const cost = projectCost(pr, at.done, want, dd.cut.tech);
      if (!canPay(cost, p.res)) return p;
      const res = { ...p.res };
      for (const k in cost) res[k] -= cost[k];
      const prog = at.prog + want;
      const finished = prog >= 1 - 1e-6;
      return {
        ...p,
        res,
        projects: { ...p.projects, [pr.id]: finished ? { done: at.done + 1, prog: 0 } : { done: at.done, prog } },
        log: finished ? logged(p.log, p.time, `${pr.name} is finished. ${pr.effect}, for good.`) : p.log,
      };
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
    setS((p) => ({
      ...freshState(p.legacy + gain),
      allTimeFunding: p.allTimeFunding,
      achieved: p.achieved,
      traded: p.traded,
      runs: (p.runs || 0) + 1,
      log: logged(p.log, 0, `The cowl changes hands. +${gain} legacy carried into the next one.`),
    }));
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
  const priceTerr = priceIn("own", "terr");
  const priceGear = priceIn("gear", "gear");

  const yieldOf = (t) =>
    t.id === "lockup" ? `+${amt(TUNE.capEach.leads * d.capMult)} leads & salvage, +${amt(TUNE.capEach.funding * d.capMult)} funding held`
    : t.id === "tower" ? `+${pct(d.towerEach)} region each`
    : t.id === "safehouse" ? `recharge ${x(1 / (1 + TUNE.safehouseEach * (s.own.safehouse || 0)))} · −${pct(TUNE.safehouseEach)} each`
    : t.id === "gym" ? `abilities ${x(d.abilMult)} · +${pct(TUNE.gymEach)} each`
    : !t.makes ? "held"
    : `${rate((t.id === "informants" ? 4 : t.rate) * d.bMult[t.id] * d.mult[t.makes] * ((d.hero?.mods || {})[t.makes] || 1) * d.global)} ${nameOf(t.makes).toLowerCase()}/s each`;

  const gearLine = (gi) =>
    gi.stat === "power" ? `+${rate(gi.per * d.mult.power * d.fightMult)} power each`
    : gi.stat === "resolve" ? `+${amt(gi.per * d.mult.resolve * resMod * d.fightMult)} resolve each`
    : gi.stat === "xp" ? `+${pct(gi.per)} xp/kill each`
    : `+${rate(gi.power * d.mult.power * d.fightMult)} power, +${amt(gi.resolve * d.mult.resolve * resMod * d.fightMult)} resolve each`;

  const queued = (kind, id) => s.queue.filter((q) => q.kind === kind && q.id === id).length;
  const branchTech = TECH.filter((t) => t.branch === branch);
  const branchDone = (b) => TECH.filter((t) => t.branch === b && s.tech[t.id]).length;
  const branchTotal = (b) => TECH.filter((t) => t.branch === b).length;
  const techState = (t) =>
    s.tech[t.id] ? "done" : t.req.every((r) => s.tech[r]) ? "open" : "locked";
  const canBuyTech = (t) => techState(t) === "open" && canPay(costOf(t, 0, 1, d.cut.tech), s.res);
  const shownTerritory = TERRITORY.filter((t) => t.show(s));
  const shownGear = GEAR.filter((gi) => gi.show(s));

  /* what each tab has waiting: shown as a badge so nobody has to go look */
  const bossUp = bossReady(s, d.dist) && !s.fight.boss;
  const todo = {
    fight: bossUp ? "boss" : shownGear.filter((gi) => priceGear(gi).ok).length,
    region: d.full.length ? "!" : shownTerritory.filter((t) => priceTerr(t).ok).length,
    crew: d.crew.idle,
    powers: d.powers.filter((p) => canPay(powerCost(p, s.ranks[p.id] || 0, d.cut.rank), s.res)).length,
    tech: TECH.filter(canBuyTech).length,
    projects: PROJECTS.filter((pr) => canPay(projectCost(pr, projectAt(s, pr).done, 0.01, d.cut.tech), s.res)).length,
    legacy: 0,
  };

  /* tabs earn their place: crew appears with the first safehouse, projects
     with the tech that opens them */
  const tabs = [
    ["fight", "Fight"],
    ["region", "Region"],
    ...(s.own.safehouse > 0 ? [["crew", "Crew"]] : []),
    ["powers", "Powers"],
    ["tech", "Tech"],
    ...(s.tech.projects ? [["projects", "Works"]] : []),
    ["legacy", "Legacy"],
  ];

  return {
    s, d, ready, tab: tabs.some(([id]) => id === tab) ? tab : "fight", setTab, branch, setBranch,
    mode, setMode, modes, todo, tabs, forecast, bossUp,
    away, setAway, news, setNews, armed, setArmed, saveNote, tip, setTip, tipProps, hoverTip, TIP_W,
    resTip, levelTip, heroTip, fightTip, distTip, bossTip, abilityTip, abilitiesTip, gearTip, terrTip, powerTip,
    techTip, techEffect, queueTip, legacyTip, etaLabel, storageTip, crewTip, jobTip, marketTip, projectTip, achieveTip,
    choose, setDistrict, patrol, cast, challenge, retreat, claim, equip, train, research, handOver, wipe,
    assign, spreadCrew, clearCrew, sell, acquire, toggleSell, fund,
    projectPrice: (pr, share) => projectCost(pr, projectAt(s, pr).done, share, d.cut.tech),
    projectAt: (pr) => projectAt(s, pr),
    projectMax: (pr) => projectMax(s, pr, d.cut.tech),
    enqueue, dequeue, clearQueue, queued,
    priceTerr, priceGear,
    yieldOf, gearLine, techCost: (t) => costOf(t, 0, 1, d.cut.tech), techState, canBuyTech,
    branchTech, branchDone, branchTotal,
    foe: d.dist.foes[(s.cleared[d.dist.id] || 0) % d.dist.foes.length],
    shownTerritory, shownGear,
    pendingLegacy: legacyFor(s.careerFunding),
  };
}

/* ============================== SHELL ============================= */

function Price({ cost, res }) {
  return Object.keys(cost).map((k) => (
    <span key={k} className={"tag-" + toneOf(k) + (res[k] >= cost[k] ? "" : " short")}>
      {amt(cost[k])} {nameOf(k).toLowerCase()}
    </span>
  ));
}

function Slab({ label, count, countLabel, sub, cost, res, ok, dim, note, onBuy, tip, multi, flat, tag }) {
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
        <span className="n-name">{tag && <span className="n-tag">{tag}</span>}{label}</span>
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
            {multi && <span className="n-multi">{multi}</span>}
            <Price cost={cost} res={res} />
          </span>
        )}
      </div>
    </div>
  );
}

/* A one-line section header; the buy-mode switch rides on the right. */
function Section({ label, sub, g, modes }) {
  return (
    <div className="n-sec">
      <span className="n-sec-l">{label}</span>
      {sub && <span className="n-sec-s">{sub}</span>}
      {modes && g.modes.length > 1 && (
        <span className="n-modes">
          {g.modes.map((m) => (
            <button key={m} className={"n-mode " + (g.mode === m ? "on" : "")} onClick={() => g.setMode(m)}>
              {m === "max" ? "max" : "×" + m}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

function HeroSelect({ g }) {
  return (
    <div className="n-select">
      <h1 className="n-select-logo">Mantle</h1>
      <p className="n-select-sub">
        {g.s.legacy > 0
          ? `${g.s.legacy} legacy carried over. Whoever you pick starts ${pct(TUNE.legacyBonus * g.s.legacy)} ahead of where the last one did.`
          : "One city, one cowl. Choose who wears it."}
      </p>
      <div className="n-heroes">
        {HEROES.map((h) => (
          <button key={h.id} className="n-hero" onClick={() => g.choose(h.id)}>
            <span className="n-hero-name">{h.name}</span>
            <span className="n-hero-epithet">{h.epithet}</span>
            <span className="n-hero-perk">{h.perk}</span>
            <span className="n-hero-sig">Signature — {h.signature.name}: {h.signature.blurb}</span>
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
      <button className="n-key tip-host" {...g.tipProps("queue", "Build queue", g.queueTip())}>
        Queue{s.queue.length > 0 && ` ${s.queue.length}`}
      </button>
      {s.queue.length === 0 ? (
        <span className="n-queue-empty">tap what you can't afford and it waits here</span>
      ) : (
        <span className="n-queue-items">
          {s.queue.map((q, i) => {
            const item = (q.kind === "gear" ? GEAR : TERRITORY).find((x) => x.id === q.id);
            return (
              <button key={i} className={"n-chip " + (i === 0 ? "next" : "")} onClick={() => g.dequeue(i)}>
                {item ? item.name : q.id}<span className="n-chip-x">×</span>
              </button>
            );
          })}
          <button className="n-queue-clear" onClick={g.clearQueue}>clear</button>
        </span>
      )}
    </div>
  );
}

function Abilities({ g }) {
  const { s, d } = g;
  if (!d.abilities.length) return null;
  const down = s.fight.ko > 0;
  return (
    <div className="n-abils">
      {d.abilities.map((a) => {
        const cd = s.fight.cd[a.id] || 0;
        const on = s.fight.buff[a.id] || 0;
        const pending = s.fight.cast.includes(a.id);
        const ready = !down && cd <= 0 && !pending;
        const fill = cd > 0 ? 1 - cd / a.cd : 1;
        return (
          <button
            key={a.id}
            className={"n-abil " + (on > 0 ? "on" : ready ? "ready" : "cool")}
            disabled={!ready}
            onClick={() => g.cast(a.id)}
            aria-label={`${a.name}, ${ready ? "ready" : "recharging"}`}
            {...g.hoverTip("a-" + a.id, a.name, g.abilityTip(a))}
          >
            <span className="n-abil-fill" style={{ width: pct(fill) }} />
            <span className="n-abil-key">{a.key}</span>
            <span className="n-abil-name">{a.name}</span>
            <span className="n-abil-sub">
              {on > 0 ? `${on.toFixed(1)}s on` : cd > 0 ? `${cd.toFixed(1)}s` : a.kind === "hit" ? amt(a.amount) : a.kind === "heal" ? "+" + amt(a.amount) : a.kind === "guard" ? "−" + pct(a.mag) : "×" + a.mag}
            </span>
          </button>
        );
      })}
      <button className="n-info n-abils-info" {...g.tipProps("abils", "Abilities", g.abilitiesTip())}>?</button>
    </div>
  );
}

function Fight({ g }) {
  const { s, d } = g;
  const inBoss = s.fight.boss;
  const boss = d.dist.boss;
  const foeMax = inBoss ? boss.hp : d.dist.hp;
  const enemyPct = Math.max(0, Math.min(100, (s.fight.enemyHP / foeMax) * 100));
  const heroPct = Math.max(0, Math.min(100, (s.fight.heroHP / d.resolve) * 100));
  const down = s.fight.ko > 0;
  const raging = inBoss && s.fight.enemyHP <= boss.hp * TUNE.bossRageAt;
  const beaten = !!s.bosses[d.dist.id];
  const ready = bossReady(s, d.dist);
  const f = g.forecast;

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
              className={"n-dist " + (s.district === dist.id ? "on " : "") + (open ? "" : "locked ") + (s.bosses[dist.id] ? "held" : "")}
              {...tp}
              onClick={(e) => { tp.onClick(e); if (open) g.setDistrict(dist.id); }}
            >
              {dist.name}
              {!open && <span className="n-dist-need">locked</span>}
            </button>
          );
        })}
        {s.tech.threat && <span className="n-auto">auto</span>}
      </div>

      <div className={"n-fight " + (down ? "down " : "") + (inBoss ? "boss" : "")}>
        <div className="n-fight-top">
          <span className="n-name">
            {inBoss && <span className="n-tag">boss</span>}
            {down ? "Knocked out" : inBoss ? boss.name : g.foe}
          </span>
          <span className="n-top-right">
            {inBoss ? (
              <button className="n-mini" onClick={g.retreat}>retreat</button>
            ) : (
              <span className="n-count">{amt(d.cleared)} cleared</span>
            )}
            <button className="n-info" {...g.tipProps("fight", "The fight", g.fightTip())}>?</button>
          </span>
        </div>
        <div className="n-hp">
          <span className="n-hp-key">Them</span>
          <div className="n-bar">
            <div className={"n-bar-fill foe " + (raging ? "rage" : "")} style={{ width: enemyPct + "%" }} />
            {inBoss && <span className="n-bar-mark" style={{ left: pct(TUNE.bossRageAt) }} />}
          </div>
          <span className="n-hp-num">{amt(s.fight.enemyHP)}</span>
        </div>
        <div className="n-hp">
          <span className="n-hp-key">You</span>
          <div className="n-bar"><div className="n-bar-fill you" style={{ width: heroPct + "%" }} /></div>
          <span className="n-hp-num">{amt(s.fight.heroHP)}</span>
        </div>

        <Abilities g={g} />

        <div className="n-line">
          <span><b>{rate(d.power)}</b> power</span>
          <span><b>{amt(d.resolve)}</b> resolve</span>
          {!inBoss && <span><b>{amt(d.dist.xp * d.xpMult)}</b> xp/kill</span>}
          {!inBoss && d.winnable && <span><b>{secs(d.ttk)}</b> a fight</span>}
          {!inBoss && d.winnable && <span><b>{pct(d.healthLeft)}</b> left</span>}
          {!inBoss && d.winnable && <span><b>{rate(d.xpRate)}</b> xp/s</span>}
          {inBoss && <span><b>{rate(boss.dps * (raging ? TUNE.bossRage : 1))}</b> {raging ? "dps, raging" : "dps"}</span>}
          {inBoss && <span><b>{amt(boss.xp * d.xpMult)}</b> xp on the win</span>}
        </div>
        {down ? (
          <p className="n-verdict bad">Up again in {s.fight.ko.toFixed(1)}s.{inBoss ? "" : " Bosses reset when you drop; the district doesn't."}</p>
        ) : inBoss ? (
          <p className="n-verdict">{raging ? `Raging: hits ${TUNE.bossRage}× harder from here.` : `Turns nasty at ${pct(TUNE.bossRageAt)} health.`} Fire abilities as they light up.</p>
        ) : !d.winnable ? (
          <p className="n-verdict bad">
            You go down {pct(d.resolve / d.damageTaken)} of the way through. More Impact to end it sooner, more Endurance to last.
          </p>
        ) : null}
      </div>

      {!inBoss && (
        <Slab
          tag="boss"
          label={boss.name}
          flat={beaten || !ready}
          countLabel={beaten ? "beaten" : `${amt(d.cleared)}/${d.dist.need}`}
          count={1}
          sub={
            beaten ? `Held. +${pct(TUNE.heldBonus)} region.`
            : !ready ? `Clear ${d.dist.need - d.cleared} more fights and it comes out.`
            : f.win ? `Tap to fight. Forecast: win in ${secs(f.time)} with ${pct(f.left)} left.`
            : `Tap to fight. Forecast: down at ${pct(f.left)}. Gear, ranks, or a Safehouse.`
          }
          res={s.res}
          ok={ready}
          dim={ready && !f.win}
          onBuy={g.challenge}
          tip={g.tipProps("boss", boss.name, g.bossTip())}
        />
      )}

      <Section label="Gear" sub="base stats · powers multiply them" g={g} modes />
      <div className="n-list">
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
              note={q ? ` · queued ×${q}` : g.etaLabel(p.cost, p.ok) ? ` · ${g.etaLabel(p.cost, p.ok)}` : null}
              cost={p.cost}
              res={s.res}
              ok={p.ok || canQ}
              dim={!p.ok}
              multi={g.mode === "max" ? "×" + Math.max(1, p.max) : g.mode > 1 ? "×" + g.mode : null}
              onBuy={() => (p.ok ? g.equip(gi) : g.enqueue("gear", gi.id))}
              tip={g.tipProps("g-" + gi.id, gi.name, g.gearTip(gi))}
            />
          );
        })}
      </div>
    </>
  );
}

/* The crew: beds, payroll, and five jobs to split them between. */
function Crew({ g }) {
  const { s, d } = g;
  const full = d.crew.n >= d.beds;
  const short = d.upkeep > d.gross.funding;
  return (
    <>
      <Section label="Crew" sub={`${d.crew.n}/${d.beds} beds · ${d.crew.idle} idle`} g={g} />
      <Slab
        flat
        label="The Outfit"
        count={d.crew.n}
        countLabel={`${d.crew.n} on the books`}
        sub={
          (full
            ? `Every bed is taken. Another Safehouse is the only way to make room.`
            : `One more walks in every ${Math.round(TUNE.crewJoin / (1 + 0.15 * d.held))}s.`) +
          ` · payroll ${rate(d.upkeep)} funding/s`
        }
        res={s.res}
        ok
        tip={g.tipProps("crew", "Crew", g.crewTip())}
      />
      {short && (
        <p className="n-verdict bad">
          Payroll wants {rate(d.upkeep)}/s against {rate(d.gross.funding)}/s coming in. Put more of them on
          Outreach, or start handing keys back.
        </p>
      )}
      <div className="n-sec">
        <span className="n-sec-l">Assignments</span>
        <span className="n-sec-s">{d.crew.idle} idle · idle hands still cost payroll</span>
        <span className="n-modes">
          <button className="n-mode" onClick={g.spreadCrew}>split evenly</button>
          <button className="n-mode" onClick={g.clearCrew}>stand down</button>
        </span>
      </div>
      <div className="n-list">
        {JOBS.map((j) => {
          const n = d.crew.jobs[j.id] || 0;
          const what = j.makes
            ? Object.keys(j.makes).map((k) => `${rate(j.makes[k] * d.crewMult * d.mult[k] * ((d.hero?.mods || {})[k] || 1) * d.global)} ${nameOf(k).toLowerCase()}/s`).join(" · ")
            : j.combat ? `+${pct(j.combat * d.crewMult)} power & resolve`
            : `+${pct(j.xp * d.crewMult)} xp/kill`;
          return (
            <div className="n-item flat n-job" key={j.id}>
              <div className="n-item-top">
                <span className="n-name">{j.name}</span>
                <span className="n-top-right">
                  <span className="n-count">{n}</span>
                  <button className="n-info" {...g.tipProps("j-" + j.id, j.name, g.jobTip(j))}>?</button>
                </span>
              </div>
              <div className="n-item-bot">
                <span className="n-sub">{what} each</span>
                <span className="n-crew-btns">
                  <button className="n-mode" disabled={!n} onClick={() => g.assign(j.id, -1)}>−</button>
                  <button className="n-mode" disabled={!d.crew.idle} onClick={() => g.assign(j.id, 1)}>+</button>
                  <button className="n-mode" disabled={!d.crew.idle} onClick={() => g.assign(j.id, "max")}>all</button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* The black market: dump what you are drowning in, buy what you are short of. */
function Market({ g }) {
  const { s, d } = g;
  if (!s.tech.fence) return null;
  return (
    <>
      <Section label="Black Market" sub="dumping sags the price · it walks back on its own" g={g} />
      <div className="n-list">
        {MARKET.map((m) => {
          const idx = s.market[m.id] ?? 1;
          const stock = s.res[m.id];
          return (
            <div className="n-item flat" key={m.id}>
              <div className="n-item-top">
                <span className="n-name">{nameOf(m.id)}</span>
                <span className="n-top-right">
                  <span className="n-count">{rate(d.price[m.id])} each</span>
                  <button className="n-info" {...g.tipProps("m-" + m.id, nameOf(m.id), g.marketTip(m.id))}>?</button>
                </span>
              </div>
              <div className="n-item-bot">
                <span className="n-sub">
                  {pct(idx)} of par · buy at {rate(d.price[m.id] * TUNE.marketSpread)}
                  {s.tech.network && (
                    <button className={"n-toggle " + (s.autosell[m.id] === false ? "" : "on")} onClick={() => g.toggleSell(m.id)}>
                      auto-sell {s.autosell[m.id] === false ? "off" : "on"}
                    </button>
                  )}
                </span>
                <span className="n-crew-btns">
                  <button className="n-mode" disabled={!(stock > 1)} onClick={() => g.sell(m.id, 0.25)}>sell ¼</button>
                  <button className="n-mode" disabled={!(stock > 1)} onClick={() => g.sell(m.id, 1)}>sell all</button>
                  <button className="n-mode" disabled={!(s.res.funding > 1)} onClick={() => g.acquire(m.id, 0.25)}>buy ¼</button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* City projects: pay any slice, keep the progress, stack the bonus forever. */
function Works({ g }) {
  const { s, d } = g;
  const shares = [
    ["1%", 0.01], ["10%", 0.1], ["25%", 0.25], ["max", "max"],
  ];
  return (
    <>
      <p className="n-note">
        Works too big to buy in one go. Pay whatever slice you can afford — the progress is kept, and
        every one you finish stacks for the rest of the career. {d.projDone} finished so far.
      </p>
      <div className="n-list">
        {PROJECTS.map((pr) => {
          const at = g.projectAt(pr);
          const max = g.projectMax(pr);
          const one = g.projectPrice(pr, 0.01);
          return (
            <div className="n-item flat n-work" key={pr.id}>
              <div className="n-item-top">
                <span className="n-name">{pr.name}</span>
                <span className="n-top-right">
                  <span className="n-count">{at.done ? `×${at.done}` : "new"}</span>
                  <button className="n-info" {...g.tipProps("pr-" + pr.id, pr.name, g.projectTip(pr))}>?</button>
                </span>
              </div>
              <p className="n-node-eff">{pr.effect}{at.done ? `, ${at.done} time${at.done === 1 ? "" : "s"} over` : ""}</p>
              <div className="n-track work"><div className="n-fill" style={{ width: pct(at.prog) }} /></div>
              <div className="n-item-bot">
                <span className="n-sub">{pct(at.prog)} built · 1% costs <Price cost={one} res={s.res} /></span>
                <span className="n-crew-btns">
                  {shares.map(([label, share]) => (
                    <button
                      key={label}
                      className="n-mode"
                      disabled={share === "max" ? !(max > 1e-4) : !canPay(g.projectPrice(pr, Math.min(share, 1 - at.prog)), s.res)}
                      onClick={() => g.fund(pr, share)}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* A rolling record of everything the city did while you were looking elsewhere. */
function Log({ g }) {
  const [open, setOpen] = useState(false);
  const log = g.s.log || [];
  if (!log.length) return null;
  const shown = open ? [...log].reverse() : log.slice(-1);
  return (
    <div className={"n-log " + (open ? "open" : "")}>
      <button className="n-log-key" onClick={() => setOpen(!open)}>
        Log <span className="n-log-caret">{open ? "▾" : "▸"}</span>
      </button>
      <div className="n-log-lines">
        {shown.map((l, i) => (
          <p className="n-log-line" key={log.length - i}>
            <span className="n-log-t">{duration(l.t)}</span>
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/* The tech tree: branch chips, then tiers hanging off a trunk. */
function Tree({ g }) {
  const { s } = g;
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
                      <span className="n-node-name">{t.ability && <span className="n-tag">ability</span>}{t.name}</span>
                      <span className="n-top-right">
                        {state === "done" && <span className="n-tick">done</span>}
                        <button className="n-info" {...g.tipProps("t-" + t.id, t.name, g.techTip(t))}>?</button>
                      </span>
                    </div>
                    <p className="n-node-eff">{g.techEffect(t)}</p>
                    {state === "locked" && <p className="n-node-req">needs {missing.join(", ")}</p>}
                    {state !== "done" && (
                      <span className="n-price">
                        <Price cost={cost} res={s.res} />
                        {g.etaLabel(cost, buyable) && state === "open" && (
                          <em className="n-eta">{g.etaLabel(cost, buyable)}</em>
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

  return (
    <div className="n">
      <style>{CSS}</style>

      <header className="n-top">
        <nav className="n-tabs" role="tablist">
          {g.tabs.map(
            ([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={g.tab === id}
                className={"n-tab " + (g.tab === id ? "on" : "")}
                onClick={() => g.setTab(id)}
              >
                {label}
                {g.todo[id] ? (
                  <span className={"n-badge " + (typeof g.todo[id] === "string" ? "hot" : "")}>
                    {typeof g.todo[id] === "string" ? "!" : g.todo[id]}
                  </span>
                ) : null}
              </button>
            )
          )}
        </nav>
      </header>

      <div className="n-body">
        <aside className="n-rail">
          <div className="n-stat n-who">
            <button className="n-key tip-host" {...tipProps("hero", d.hero.name, g.heroTip())}>
              {d.hero.name}
            </button>
            <div className="n-val"><span className="n-lv">Lv</span> {d.level}</div>
            <div className="n-track"><div className="n-fill" style={{ width: d.xpPct + "%" }} /></div>
            <button className="n-key tip-host n-lvkey" {...tipProps("level", "Level", g.levelTip())}>
              region {x(d.global)}
            </button>
            {d.boon && <div className="n-boon">streak ×{d.boon.mult} · {Math.ceil(d.boon.left)}s</div>}
          </div>
          {RESOURCES.map((r) => {
            const cap = d.caps[r.id];
            const full = isFinite(cap) && s.res[r.id] >= cap - 1e-9;
            return (
              <div key={r.id} className={"n-stat tone-" + r.tone + (full ? " full" : "")}>
                <button className="n-key tip-host" {...tipProps("res-" + r.id, r.name, g.resTip(r.id))}>
                  {r.name}
                </button>
                <div className="n-val">{amt(s.res[r.id])}</div>
                <div className={"n-flow " + (r.id === "xp" && !d.winnable ? "neg" : "")}>+{rate(d.gross[r.id])}/s</div>
                {isFinite(cap) && (
                  <>
                    <div className="n-track thin"><div className="n-fill" style={{ width: pct(Math.min(1, s.res[r.id] / cap)) }} /></div>
                    <div className="n-cap">{full ? "FULL " : "/"}{amt(cap)}</div>
                  </>
                )}
              </div>
            );
          })}
        </aside>

        <main className="n-main">
          {g.away && (
            <div className="n-flash">
              <span>Gone {duration(g.away.gap)} — {amt(g.away.funding)} funding, {amt(g.away.xp)} xp.</span>
              <button className="n-x" onClick={() => g.setAway(null)}>OK</button>
            </div>
          )}
          {g.news && (
            <div className="n-flash">
              <span>{g.news}</span>
              <button className="n-x" onClick={() => g.setNews(null)}>OK</button>
            </div>
          )}

          <Log g={g} />

          {(g.tab === "region" || g.tab === "fight") && <Queue g={g} />}

          {g.tab === "fight" && <Fight g={g} />}

          {g.tab === "region" && (
            <>
              <Section label="Buildings" sub={`${d.region} held · region ${x(d.global)}`} g={g} modes />
              <div className="n-list">
                {g.shownTerritory.map((t) => {
                  const p = g.priceTerr(t);
                  const q = g.queued("terr", t.id);
                  const canQ = !!s.tech.standing && !p.ok;
                  return (
                    <Slab
                      key={t.id}
                      label={t.name}
                      count={p.own}
                      sub={g.yieldOf(t)}
                      note={q ? ` · queued ×${q}` : g.etaLabel(p.cost, p.ok) ? ` · ${g.etaLabel(p.cost, p.ok)}` : null}
                      cost={p.cost}
                      res={s.res}
                      ok={p.ok || canQ}
                      dim={!p.ok}
                      multi={g.mode === "max" ? "×" + Math.max(1, p.max) : modeTag}
                      onBuy={() => (p.ok ? g.claim(t) : g.enqueue("terr", t.id))}
                      tip={tipProps("tr-" + t.id, t.name, g.terrTip(t))}
                    />
                  );
                })}
              </div>
            </>
          )}

          {g.tab === "region" && <Market g={g} />}

          {g.tab === "crew" && <Crew g={g} />}

          {g.tab === "projects" && <Works g={g} />}

          {g.tab === "powers" && (
            <>
              <Section label="Powers" sub="ranks cost XP · your level never drops" g={g} />
              <div className="n-list">
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
                    p.target === "xp" ? "xp/kill" : nameOf(p.target).toLowerCase();
                  return (
                    <Slab
                      key={p.id}
                      label={p.name}
                      count={rank}
                      countLabel={"rank " + rank}
                      sub={`+${pct(per)} ${target} per rank${amped ? " (doubled)" : ""} · now ${x(1 + per * rank)}`}
                      note={g.etaLabel(cost, canPay(cost, s.res)) ? ` · ${g.etaLabel(cost, canPay(cost, s.res))}` : null}
                      cost={cost}
                      res={s.res}
                      ok={canPay(cost, s.res)}
                      onBuy={() => g.train(p)}
                      tip={tipProps("pw-" + p.id, p.name, g.powerTip(p))}
                    />
                  );
                })}
              </div>
            </>
          )}

          {g.tab === "tech" && <Tree g={g} />}

          {g.tab === "legacy" && (
            <>
              <p className="n-note">
                The cowl outlives whoever is under it. Pass it on and the region, the gear, the
                powers, the bosses and the whole tree go. You pick a new hero, and they start ahead of where you did.
              </p>
              <Slab
                flat
                label="Legacy"
                count={s.legacy}
                sub={`+${pct(TUNE.legacyBonus)} to everything each · ${amt(s.careerFunding)} funding this career`}
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
              <Section label="Record" sub={`${d.badges}/${ACHIEVEMENTS.length} · +${pct(TUNE.achieveBonus)} each, kept forever`} g={g} />
              <p className="n-note">
                <button className="n-key tip-host" {...tipProps("badges", "The record", g.achieveTip())}>
                  everything at {x(d.badgeMult)}
                </button>
              </p>
              <div className="n-badges">
                {ACHIEVEMENTS.map((a) => (
                  <span key={a.id} className={"n-badge-card " + (s.achieved[a.id] ? "got" : "")} title={a.blurb}>
                    <b>{a.name}</b>
                    {a.blurb}
                  </span>
                ))}
              </div>

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
        Patrol
        <span className="n-patrol-sub">
          +{amt(d.patrol)} leads, +{amt(d.patrol)} salvage
          {s.tech.autopilot && ` · autopilot ${TUNE.autopilotRate}/s`}
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
  --paper: #f2ece0; --ink: #171614; --yellow: #ffc72c; --red: #e8402a; --cyan: #38bcd8;
  --rule: rgba(23,22,20,.18);
  --head: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
  height: 100vh; min-height: 520px;
  display: flex; flex-direction: column;
  background-color: var(--paper);
  background-image: radial-gradient(rgba(23,22,20,.10) 1px, transparent 1.15px);
  background-size: 5px 5px;
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12.5px; line-height: 1.4; -webkit-font-smoothing: antialiased;
}
.n *, .n *::before, .n *::after { box-sizing: border-box; }
.n button { font: inherit; cursor: pointer; }
.n :focus-visible { outline: 3px solid var(--red); outline-offset: -1px; }
.boot { margin: auto; opacity: .6; }

/* ---- hero select ---- */
.n-select { flex: 1; overflow-y: auto; padding: 26px 16px 40px; }
.n-select-logo {
  font-family: var(--head);
  font-size: 54px; line-height: .95; letter-spacing: .03em; text-transform: uppercase;
  text-align: center; margin: 0; color: var(--yellow);
  -webkit-text-stroke: 2px var(--ink); text-shadow: 4px 4px 0 var(--ink);
}
.n-select-sub { text-align: center; font-size: 12.5px; margin: 14px auto 22px; max-width: 46ch; opacity: .8; }
.n-heroes { display: grid; gap: 12px; max-width: 640px; margin: 0 auto; }
.n-hero {
  display: block; text-align: left; width: 100%; background: #fff;
  border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: 10px 12px 12px; color: var(--ink);
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-hero:hover { background: #fffdf3; }
.n-hero:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }
.n-hero-name { display: block; font-family: var(--head); font-size: 23px; letter-spacing: .04em; text-transform: uppercase; line-height: 1.05; }
.n-hero-epithet { display: block; font-size: 12px; opacity: .7; margin-top: 2px; }
.n-hero-perk { display: inline-block; margin-top: 7px; background: var(--yellow); border: 2px solid var(--ink); padding: 0 6px; font-size: 11px; font-weight: 700; }
.n-hero-sig { display: block; margin-top: 6px; font-size: 11px; opacity: .75; }

/* ---- top bar: five tabs, full width ---- */
.n-top { flex-shrink: 0; background: var(--ink); }
.n-tabs { display: flex; }
.n-tab {
  flex: 1; background: none; border: none; color: #9c968a; position: relative;
  font-family: var(--head); font-size: 15px; letter-spacing: .05em; text-transform: uppercase; padding: 6px 4px 5px;
}
.n-tab:hover { color: var(--paper); }
.n-tab.on { background: var(--yellow); color: var(--ink); }
.n-badge {
  display: inline-block; margin-left: 5px; background: #4a4640; color: var(--paper);
  font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; font-weight: 700;
  min-width: 15px; padding: 0 4px; line-height: 15px; vertical-align: 2px; letter-spacing: 0; text-align: center;
}
.n-badge.hot { background: var(--red); color: #fff; }
.n-tab.on .n-badge { background: var(--ink); color: var(--yellow); }

/* ---- rail ---- */
.n-body { flex: 1; display: flex; min-height: 0; }
.n-rail { width: 104px; flex-shrink: 0; overflow-y: auto; border-right: 2px solid var(--ink); background: rgba(23,22,20,.045); }
.n-stat { padding: 5px 7px 6px; border-bottom: 1px solid var(--rule); border-left: 4px solid transparent; }
.n-stat.n-who { border-left-color: var(--red); background: rgba(232,64,42,.07); }
.n-who .n-key { font-size: 10.5px; opacity: 1; letter-spacing: .03em; }
.n-lv { font-size: 9.5px; opacity: .5; font-weight: 400; }
.n-lvkey { display: block; margin-top: 3px; font-size: 9px; opacity: .6; letter-spacing: 0; }
.n-stat.tone-cyan { border-left-color: var(--cyan); }
.n-stat.tone-steel { border-left-color: #97a3b0; }
.n-stat.tone-signal { border-left-color: var(--yellow); }
.n-stat.tone-magenta { border-left-color: #e8558f; }
.n-key { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .62; text-align: left; }
.n-flow { font-size: 9px; opacity: .55; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.n-flow.neg { color: var(--red); opacity: 1; }
.n-val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.03em; line-height: 1.15; margin-top: 1px; }
.n-track { height: 4px; background: rgba(23,22,20,.16); border: 1px solid var(--ink); margin-top: 4px; }
.n-fill { height: 100%; background: var(--red); transition: width .25s linear; }

/* ---- main ---- */
.n-main { flex: 1; min-width: 0; overflow-y: auto; padding: 10px 12px 16px; }
.n-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 7px; margin-bottom: 10px; }
.n-sec { display: flex; align-items: baseline; gap: 8px; margin: 4px 0 7px; flex-wrap: wrap; }
.n-sec-l { font-family: var(--head); font-size: 14px; letter-spacing: .06em; text-transform: uppercase; }
.n-sec-s { font-size: 10.5px; opacity: .6; flex: 1; min-width: 0; }
.n-modes { display: flex; gap: 4px; margin-left: auto; }
.n-mode { background: #fff; border: 1.5px solid var(--ink); padding: 0 8px; font-size: 10.5px; font-weight: 700; line-height: 17px; }
.n-mode.on { background: var(--ink); color: var(--yellow); }

/* ---- the fight ---- */
.n-districts { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.n-dist { background: #fff; border: 1.5px solid var(--ink); padding: 1px 7px; font-size: 10.5px; font-weight: 700; cursor: help; line-height: 17px; }
.n-dist.on { background: var(--ink); color: var(--yellow); }
.n-dist.held::after { content: "✓"; margin-left: 4px; opacity: .6; }
.n-dist.locked { background: transparent; border-style: dashed; opacity: .5; }
.n-dist-need { margin-left: 5px; font-weight: 400; opacity: .7; font-size: 9.5px; }
.n-fight { background: #fff; border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); padding: 8px 10px 9px; margin-bottom: 10px; }
.n-fight.down { background: #ffeeeb; border-color: var(--red); box-shadow: 3px 3px 0 var(--red); }
.n-fight.boss { border-color: var(--red); box-shadow: 3px 3px 0 var(--red); }
.n-fight-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.n-hp { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.n-hp-key { font-size: 9px; font-weight: 700; text-transform: uppercase; opacity: .55; width: 30px; flex-shrink: 0; }
.n-hp-num { font-size: 10px; font-variant-numeric: tabular-nums; width: 46px; text-align: right; flex-shrink: 0; }
.n-bar { flex: 1; height: 11px; border: 1.5px solid var(--ink); background: rgba(23,22,20,.08); overflow: hidden; position: relative; }
.n-bar-fill { height: 100%; transition: width .1s linear; }
.n-bar-fill.foe { background: var(--red); }
.n-bar-fill.foe.rage { background: #8f1e10; }
.n-bar-fill.you { background: var(--cyan); }
.n-bar-mark { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink); opacity: .5; }
.n-line { display: flex; flex-wrap: wrap; gap: 3px 10px; margin-top: 7px; padding-top: 6px; border-top: 1.5px solid var(--rule); font-size: 10.5px; opacity: .8; }
.n-line b { font-variant-numeric: tabular-nums; }
.n-verdict { margin: 5px 0 0; font-size: 10.5px; opacity: .75; }
.n-verdict.bad { color: var(--red); opacity: 1; font-weight: 700; }
.n-mini { background: #fff; border: 1.5px solid var(--ink); padding: 0 7px; font-size: 10px; font-weight: 700; line-height: 16px; }
.n-mini:hover { background: var(--yellow); }
.n-tag {
  display: inline-block; vertical-align: 2px; margin-right: 6px; background: var(--red); color: #fff;
  font-family: ui-monospace, Menlo, monospace; font-size: 8.5px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; padding: 0 4px; line-height: 13px;
}

/* ---- abilities ---- */
.n-abils { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; align-items: stretch; }
.n-abil {
  position: relative; overflow: hidden; text-align: left; padding: 4px 7px 5px 7px;
  background: #fff; border: 1.5px solid var(--ink); color: var(--ink); min-height: 38px;
  flex: 1 1 110px; max-width: 190px;
  display: flex; flex-direction: column; justify-content: center;
}
.n-abil-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--yellow); opacity: .45; transition: width .1s linear; }
.n-abil.ready .n-abil-fill { opacity: .9; }
.n-abil.ready { cursor: pointer; }
.n-abil.ready:hover .n-abil-fill { opacity: 1; }
.n-abil.ready:active { transform: translate(1px,1px); }
.n-abil.cool { cursor: default; border-style: dashed; }
.n-abil.on { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.n-abil.on .n-abil-fill { display: none; }
.n-abil-key { position: absolute; right: 4px; top: 2px; font-size: 8.5px; opacity: .5; }
.n-abil-name { position: relative; font-family: var(--head); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; line-height: 1.1; }
.n-abil-sub { position: relative; font-size: 9.5px; opacity: .7; font-variant-numeric: tabular-nums; margin-top: 2px; }
.n-abils-info { align-self: center; margin-left: auto; }

/* ---- slabs ---- */
.n-item {
  background: #fff; border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink);
  padding: 6px 9px 7px; cursor: pointer;
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-item:hover { background: #fffdf3; }
.n-item:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.n-item.off { background: rgba(255,255,255,.4); border-style: dashed; box-shadow: none; cursor: not-allowed; opacity: .7; }
.n-item.off:active { transform: none; }
.n-item.flat { cursor: default; margin-bottom: 10px; }
.n-item.flat:active { transform: none; box-shadow: 2px 2px 0 var(--ink); }
.n-item.flat.off { opacity: .85; }
.n-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.n-name { font-family: var(--head); font-size: 15px; letter-spacing: .035em; text-transform: uppercase; line-height: 1.1; min-width: 0; }
.n-top-right { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.n-count { background: var(--ink); color: var(--yellow); font-size: 10px; font-weight: 700; padding: 0 6px; line-height: 16px; white-space: nowrap; }
.n-info {
  width: 16px; height: 16px; padding: 0; flex-shrink: 0;
  border: 1.5px solid var(--ink); background: #fff; color: var(--ink);
  font-size: 10px; font-weight: 800; line-height: 1; cursor: help; opacity: .6;
}
.n-info:hover { background: var(--yellow); opacity: 1; }
.n-item-bot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 3px; flex-wrap: wrap; }
.n-sub { font-size: 10.5px; opacity: .72; font-variant-numeric: tabular-nums; }
.n-price { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.n-price span { border: 1.5px solid var(--ink); padding: 0 5px; font-size: 10px; font-weight: 700; background: #fff; white-space: nowrap; line-height: 16px; }
.n-multi { background: var(--ink) !important; color: var(--yellow); }
.tag-cyan { background: #a9e2f0; }
.tag-steel { background: #d9dfe6; }
.tag-signal { background: #ffd96b; }
.tag-magenta { background: #f7aec8; }
.n-price .short { background: #ffd5cf; color: var(--red); }

.n-flash {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--yellow); border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink);
  padding: 6px 9px; margin-bottom: 10px; font-size: 11.5px; font-weight: 700;
}
.n-x { background: var(--ink); color: #fff; border: none; padding: 2px 9px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.n-note { font-size: 11.5px; opacity: .72; margin: 0 0 10px; max-width: 64ch; }
.n-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; padding-top: 10px; border-top: 1.5px solid var(--rule); font-size: 11px; opacity: .75; }
.n-ghost { background: #fff; border: 1.5px solid var(--ink); padding: 2px 10px; font-size: 11px; font-weight: 700; }
.n-ghost.danger { background: var(--red); color: #fff; border-color: var(--red); }

/* ---- build queue: one line ---- */
.n-queue { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border: 1.5px dashed var(--ink); padding: 4px 8px; margin-bottom: 9px; background: rgba(255,255,255,.4); }
.n-queue .n-key { display: inline; }
.n-queue-clear { background: none; border: none; font-size: 10px; text-decoration: underline; opacity: .6; padding: 0; }
.n-queue-empty { font-size: 10px; opacity: .55; }
.n-queue-items { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.n-chip { background: #fff; border: 1.5px solid var(--ink); padding: 0 5px 0 7px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; line-height: 16px; }
.n-chip.next { background: var(--yellow); }
.n-chip-x { opacity: .55; font-weight: 400; }
.n-item.dim { background: rgba(255,255,255,.45); border-style: dashed; box-shadow: none; }
.n-item.dim:active { transform: translate(1px,1px); box-shadow: none; }
.n-eta { font-style: normal; opacity: .6; white-space: nowrap; }
.n-auto { align-self: center; background: var(--ink); color: var(--yellow); font-size: 9px; font-weight: 700; letter-spacing: .08em; padding: 0 5px; line-height: 16px; }

/* ---- tech tree ---- */
.n-branches { display: flex; gap: 4px; margin-bottom: 7px; flex-wrap: wrap; }
.n-branch { flex: 1; min-width: 64px; background: #fff; border: 1.5px solid var(--ink); padding: 2px 6px 3px; font-size: 11.5px; font-weight: 700; line-height: 1.15; }
.n-branch.on { background: var(--ink); color: var(--yellow); }
.n-branch-n { display: block; font-size: 9px; font-weight: 400; opacity: .6; font-variant-numeric: tabular-nums; }
.n-branch.on .n-branch-n { opacity: .75; }
.n-tree { margin-top: 2px; }
.n-tier { display: flex; gap: 8px; align-items: stretch; }
.n-spine { width: 18px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
.n-spine::after { content: ""; flex: 1; width: 2px; background: var(--ink); opacity: .22; }
.n-tier:last-child .n-spine::after { opacity: 0; }
.n-tier-num { width: 18px; height: 18px; flex-shrink: 0; background: var(--ink); color: var(--yellow); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.n-tier-nodes { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px; padding-bottom: 7px; }
.n-node {
  background: #fff; border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink);
  padding: 5px 8px 6px; position: relative;
  transition: transform .05s ease, box-shadow .05s ease, background .1s ease;
}
.n-node::before { content: ""; position: absolute; left: -8px; top: 11px; width: 8px; height: 2px; background: var(--ink); opacity: .22; }
.n-node.buyable { cursor: pointer; }
.n-node.buyable:hover { background: #fffdf3; }
.n-node.buyable:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.n-node.open:not(.buyable) { background: rgba(255,255,255,.5); box-shadow: none; }
.n-node.locked { background: transparent; border-style: dashed; box-shadow: none; opacity: .6; }
.n-node.done { background: var(--ink); color: var(--paper); box-shadow: 2px 2px 0 rgba(23,22,20,.25); }
.n-node.done .n-info { background: var(--ink); color: var(--paper); border-color: var(--paper); }
.n-node.done .n-tag { background: var(--yellow); color: var(--ink); }
.n-node-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.n-node-name { font-family: var(--head); font-size: 13.5px; letter-spacing: .03em; text-transform: uppercase; line-height: 1.1; }
.n-node-eff { margin: 2px 0 0; font-size: 10.5px; opacity: .75; }
.n-node.done .n-node-eff { opacity: .8; }
.n-node-req { margin: 2px 0 0; font-size: 9.5px; font-weight: 700; color: var(--red); }
.n-node .n-price { margin-top: 5px; }
.n-tick { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .7; }

/* ---- storage, crew, market, works, log ---- */
.n-track.thin { height: 3px; margin-top: 3px; }
.n-track.work { height: 6px; margin: 5px 0 1px; }
.n-boon { margin-top: 3px; background: var(--yellow); border: 1.5px solid var(--ink); font-size: 8.5px; font-weight: 700; text-align: center; line-height: 14px; }
.n-cap { font-size: 8.5px; opacity: .45; font-variant-numeric: tabular-nums; margin-top: 1px; }
.n-stat.full .n-cap { opacity: 1; color: var(--red); font-weight: 700; }
.n-stat.full .n-fill { background: var(--red); }
.n-crew-btns { display: flex; gap: 3px; flex-wrap: wrap; }
.n-crew-btns .n-mode { min-width: 22px; }
.n-mode:disabled { opacity: .35; cursor: not-allowed; }
.n-job .n-item-bot, .n-work .n-item-bot { margin-top: 5px; }
.n-toggle { margin-left: 7px; background: #fff; border: 1.5px solid var(--ink); padding: 0 5px; font-size: 9.5px; font-weight: 700; line-height: 15px; }
.n-toggle.on { background: var(--yellow); }
.n-work .n-sub { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.n-work .n-sub span { border: 1.5px solid var(--ink); padding: 0 5px; font-size: 10px; font-weight: 700; line-height: 16px; }
.n-log { border: 1.5px dashed var(--ink); background: rgba(255,255,255,.4); padding: 3px 8px 4px; margin-bottom: 9px; display: flex; gap: 8px; align-items: flex-start; }
.n-log-key { background: none; border: none; padding: 0; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .62; flex-shrink: 0; line-height: 15px; }
.n-log-caret { opacity: .6; }
.n-log-lines { flex: 1; min-width: 0; max-height: 132px; overflow-y: auto; }
.n-log-line { margin: 0; font-size: 10.5px; opacity: .8; line-height: 1.35; }
.n-log:not(.open) .n-log-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.n-log-t { display: inline-block; min-width: 42px; padding-right: 7px; opacity: .45; font-variant-numeric: tabular-nums; }
.n-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 5px; margin-bottom: 10px; }
.n-badge-card { border: 1.5px dashed var(--ink); padding: 3px 7px 4px; font-size: 10px; opacity: .5; line-height: 1.3; }
.n-badge-card b { display: block; font-family: var(--head); font-size: 12px; letter-spacing: .03em; text-transform: uppercase; font-weight: 400; }
.n-badge-card.got { border-style: solid; background: #fff; box-shadow: 2px 2px 0 var(--ink); opacity: 1; }

/* ---- patrol ---- */
.n-patrol {
  flex-shrink: 0; border: none; border-top: 3px solid var(--ink);
  background: var(--yellow); color: var(--ink); padding: 7px 14px 8px; text-align: left;
  font-family: var(--head); font-size: 20px; letter-spacing: .06em; text-transform: uppercase; line-height: 1;
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
}
.n-patrol:hover { background: #ffd04d; }
.n-patrol:active { background: #f0b51e; }
.n-patrol-sub { opacity: .68; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0; text-transform: none; }

/* ---- tooltips ---- */
.n .tip-host { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; text-align: inherit; cursor: help; border-bottom: 1px dotted currentColor; }
.n .tip {
  position: fixed; z-index: 60; padding: 8px 10px; pointer-events: none;
  background: #fffdf6; border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.5; color: var(--ink);
}
.tip-title { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--red); margin-bottom: 2px; }

@media (max-width: 460px) {
  .n-tab { font-size: 12.5px; padding: 6px 2px 5px; letter-spacing: .02em; }
  .n-badge { margin-left: 3px; min-width: 13px; font-size: 8.5px; line-height: 13px; }
  .n-rail { width: 86px; }
  .n-val { font-size: 14px; }
  .n-main { padding: 8px 9px 14px; }
  .n-list { grid-template-columns: 1fr; }
  .n-tier-nodes { grid-template-columns: 1fr; }
  .n-branch { font-size: 11px; min-width: 56px; }
  .n-node-name { font-size: 12.5px; }
  .n-name { font-size: 14px; }
  .n-patrol { font-size: 17px; padding: 7px 12px 8px; }
  .n-select-logo { font-size: 40px; }
  .n-hp-num { width: 40px; }
  .n-abil { flex-basis: 45%; max-width: none; }
  .n-abils-info { display: none; }
  .n-badges { grid-template-columns: 1fr; }
  .n-cap { font-size: 8px; }
  .n-sec-s { display: none; }
  .n-queue-empty { display: none; }
}
@media (prefers-reduced-motion: reduce) { .n * { transition: none !important; } }
`;
