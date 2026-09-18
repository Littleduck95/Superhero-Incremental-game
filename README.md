# Mantle

A superhero incremental game: pick a hero, hold a city, get stronger.

- **Region** — buildings produce leads, salvage and funding. Two of them,
  the Safehouse and the Training Floor, are opened by bosses and feed the
  fight instead: shorter recharges and stronger abilities.
- **Fight** — an auto battler. Gear sets your base stats, powers multiply
  them, and four abilities on cooldowns (Haymaker, Brace, Second Wind, Surge)
  spend them well; tap them or press 1–4. Every district ends in a boss that
  turns nasty at 40% health. Beating it opens the next district, pays an XP
  jackpot and a bounty, and holds the district for +10% region output. Fights
  are the only source of XP.
- **Powers** — ranks bought with XP, multiplying region output and combat.
- **Tech** — a four-branch tree. Street makes the region richer and cheaper,
  Body opens the abilities and amplifies the fight, Mind amplifies the powers
  the region runs on and speeds recharge, and Ops unlocks the quality-of-life
  the game withholds at the start: bulk buying, the build queue, auto-patrol,
  auto-fire (Reflex Triggers), auto-climb (Threat Assessment, which also takes
  bosses on when the forecast says they're won) and longer offline time.

## Running it

```
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` writes a static bundle to `dist/`.

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
- `scripts/balance.mjs` — the balance bot above.

Progress saves every 10 seconds and when the tab is hidden. Offline progress is
credited on load, capped at 8 hours (24 with the Archive tech). Saves from
before bosses existed load fine: any district the old fight-count gate had
opened counts as held.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages
on every push to `main`. Pages must be set to build from **GitHub Actions**
(Settings → Pages → Source), not from a branch: serving the repository root
directly gives a blank page, because `index.html` points at `src/main.jsx`,
which is JSX a browser cannot execute. Only the compiled `dist/` output is
servable. `base: "./"` in `vite.config.js` keeps asset paths relative so the
build works under the `/Superhero-Incremental-game/` subpath.
