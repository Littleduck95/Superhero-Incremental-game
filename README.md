# Mantle

A superhero incremental game: pick a hero, hold a city, get stronger.

- **Region** — buildings produce leads, salvage and funding.
- **Fight** — an auto battler. Gear wins fights; fights are the only source of XP.
- **Powers** — ranks bought with XP, multiplying region output and combat.
- **Tech** — a four-branch tree. Street makes the region richer and cheaper, Body
  and Mind amplify what you already own, and Ops unlocks the quality-of-life the
  game withholds at the start: bulk buying, the build queue, auto-patrol,
  auto-climb and longer offline time.

## Running it

```
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` writes a static bundle to `dist/`.

## Layout

- `src/Mantle.jsx` — the whole game: content tables, simulation, UI and CSS. It
  came out of a Claude chat as a single-file artifact and is kept verbatim.
- `src/main.jsx` — mounts it, and provides a `window.storage` shim backed by
  `localStorage`. The artifact runtime supplies that store itself; without the
  shim the game runs but reports that it cannot save.

Progress saves every 10 seconds and when the tab is hidden. Offline progress is
credited on load, capped at 8 hours (24 with the Archive tech).

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages
on every push to `main`. Pages must be set to build from **GitHub Actions**
(Settings → Pages → Source), not from a branch: serving the repository root
directly gives a blank page, because `index.html` points at `src/main.jsx`,
which is JSX a browser cannot execute. Only the compiled `dist/` output is
servable. `base: "./"` in `vite.config.js` keeps asset paths relative so the
build works under the `/Superhero-Incremental-game/` subpath.
