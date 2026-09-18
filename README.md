# Mantle

A superhero incremental game: pick a hero, hold a city, get stronger.

- **Region** — buildings produce leads, salvage and funding. Two of them,
  the Safehouse and the Training Floor, are opened by bosses and feed the
  fight instead: shorter recharges and stronger abilities.
- **Storage** — leads, salvage and funding all have a ceiling, and the
  Lockup is what raises it. Income stops dead at the ceiling; windfalls —
  boss bounties, gifts, a sale — are allowed over it. Nothing caps XP.
  Storage is the real limit on how long you can leave the game running,
  so buy room before you close the tab.
- **Crew** — safehouses are beds, beds are the only reason anyone stays,
  and people walk in on their own while there is room. Five jobs: three
  feed the region, Sparring feeds power and resolve, and the Intel Desk
  raises XP a kill. Payroll comes out of funding every second and climbs
  steeply with the size of the outfit; miss it long enough and somebody
  hands their key back.
- **Black market** — leads and salvage move for funding. Dumping a pile
  floods the market and the price sags, then walks back to par on its own;
  buying back costs three times what selling pays. The Fence Network sells
  what a full lockup would otherwise waste.
- **Works** — city projects too big to buy in one go. Pay any slice you can
  afford, keep the progress, and every one you finish stacks for the rest of
  the career: region output, resolve, power, XP, storage, recharge.
- **Fight** — an auto battler. Gear sets your base stats, powers multiply
  them, and four abilities on cooldowns (Haymaker, Brace, Second Wind, Surge)
  spend them well; tap them or press 1–4. Every district ends in a boss that
  turns nasty at 40% health. Beating it opens the next district, pays an XP
  jackpot and a bounty, and holds the district for +10% region output. Fights
  are the only source of XP.
- **Powers** — ranks bought with XP, multiplying region output and combat.
- **Record** — achievements, each worth a little of everything, and the one
  thing besides legacy that survives passing the cowl on.
- **Bounties** — the board opens with the first boss. Three contracts a day,
  rolled at local midnight and scaled to your numbers when they roll; the
  rewards are windfalls and go over the ceiling. Filling any one keeps the
  day streak alive — +1% region per consecutive day up to +10%, kept through
  passing the cowl on, gone if you skip a day — and clearing all three is
  ×1.5 region for ten minutes. The tab also holds the **Stakeout**, a timing
  minigame on a cooldown: start it, watch the marker sweep, move in when it
  crosses the drop. Inside the window pays leads and funding, dead centre
  pays triple, a miss pays nothing and comes back sooner.
- **Flashpoints** — every few minutes of live play, something is happening
  *right now*: a banner with a twenty-second countdown. Respond in time for
  a windfall several times the size of a passive event, or read about what
  you missed in the log. Like events, they never fire while you're away, so
  leaving a tab open is not a strategy.
- **Momentum** — chained Patrol taps build a multiplier, +5% a tap up to
  ×2.5, dropped the moment you stop for a breath. Autopilot never touches
  it; it's there for hands that want something to do.
- **Tech** — a four-branch tree. Street makes the region richer and cheaper,
  Body opens the abilities and amplifies the fight, Mind amplifies the powers
  the region runs on and speeds recharge, and Ops unlocks the quality-of-life
  the game withholds at the start: bulk buying, the build queue, auto-patrol,
  auto-fire (Reflex Triggers), auto-climb (Threat Assessment, which also takes
  bosses on when the forecast says they're won), overflow selling and longer
  offline time.

## Running it

```
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` writes a static bundle to `dist/`.

## Checking it still works

```
node scripts/sanity.mjs
```

Asserts the things that are easy to break and hard to notice: that a save
from before crew, storage and projects existed still loads, that income
stops at the ceiling while windfalls go over it, that unpaid crew leave
instead of wedging the loop, that offline catch-up can't farm random
events or flashpoints, that the bounty board rolls, pays, streaks and
lapses on the right days, and that every tech requirement points at a
node that exists. It exits non-zero on the first thing that is wrong.

## Checking the balance

```
node scripts/balance.mjs [hours] [hero] [patrolRate]
```

A greedy bot plays a career one second at a time, buying whatever is cheapest
in seconds of income, auto-firing abilities and challenging bosses when the
forecast says they're won. It prints when each boss appears, what the forecast
said at that moment, and when it fell. `BOSS_HP=1.5 BOSS_DPS=1.2 BOSS_XP=0.5`
scale every boss for tuning runs. The bot is a ceiling on a human, not a
promise, but if it can't beat a boss nobody can.

## Layout

- `src/Mantle.jsx` — the whole game: content tables, simulation, UI and CSS.
  It came out of a Claude chat as a single-file artifact. It also exports
  `engine` for the balance script; the UI does not use that export.
- `src/main.jsx` — mounts it, and provides a `window.storage` shim backed by
  `localStorage`. The artifact runtime supplies that store itself; without the
  shim the game runs but reports that it cannot save.
- `scripts/engine.mjs` — bundles `Mantle.jsx` with React stubbed out and
  hands back the exported `engine`, so the scripts below can drive the game
  from node without a DOM.
- `scripts/balance.mjs` — the balance bot above.
- `scripts/sanity.mjs` — the assertions above.

Progress saves every 10 seconds and when the tab is hidden. Offline progress is
credited on load, capped at 8 hours (24 with the Archive tech) and capped again
by your storage — a lockup or two is worth more overnight than another perch.
Random events only fire during live play, so leaving is never the better way to
farm them.

Old saves load fine. Saves from before bosses existed count any district the old
fight-count gate had opened as held; saves from before storage existed are handed
enough lockups to hold what they already produce, so nobody comes back to a full
city and no way to empty it.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages
on every push to `main`. Pages must be set to build from **GitHub Actions**
(Settings → Pages → Source), not from a branch: serving the repository root
directly gives a blank page, because `index.html` points at `src/main.jsx`,
which is JSX a browser cannot execute. Only the compiled `dist/` output is
servable. `base: "./"` in `vite.config.js` keeps asset paths relative so the
build works under the `/Superhero-Incremental-game/` subpath.
