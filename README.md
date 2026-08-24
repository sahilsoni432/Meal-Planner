# Recipe Finder & Meal Planner

A recipe discovery and weekly meal planning application built with **Svelte 5**,
**SvelteKit**, and a **StencilJS** component library that is published to npm and consumed
from the registry.

| Deliverable | Link |
|---|---|
| GitHub repository | https://github.com/sahilsoni432/Meal-Planner |
| npm package | https://www.npmjs.com/package/recipe-planner-ui |
| Deployed application | https://browniebites-app.vercel.app |
| SvelteKit source | [`web/`](web/) |
| Stencil source | [`recipe-ui/`](recipe-ui/) |

---

## What it does

- **Discovery** — browse by category, search by name, filter by category or cuisine. Search
  and filter state lives in the URL, so any view is shareable and survives a reload.
- **Details** — full ingredients and instructions for any recipe.
- **Management** — create, edit, and delete your own recipes, with validation on both the
  server and the client.
- **Favorites** — save recipes from the API and your own into one list.
- **Weekly planner** — assign recipes to days, drag them between days or use the move
  control, remove them.
- **Veg Only mode** — a header switch that filters every listing to vegetarian recipes.
  The preference persists in its own cookie, so it survives navigation and reload, and each
  page says how many items it is holding back rather than appearing to have lost them.
  Nothing is deleted: switching it off restores the full view.
- **Light and dark themes** — a header button, remembered in its own cookie and applied
  server-side so the first paint is already in the chosen palette.
- **About** — a guided tour at `/about`: four numbered steps through the app, the features
  worth knowing about, and the questions people ask first.

Recipe data comes from [TheMealDB](https://www.themealdb.com/api.php) public API.

### Design

The interface uses a warm palette — cream paper, espresso ink, a caramel highlight — with
`Fraunces` for display headings and `Plus Jakarta Sans` for the interface. The tokens live
in the **published package** (`recipe-ui/src/global/tokens.css`) and are mirrored in
`web/src/app.css` so that server-rendered HTML is styled before the component bundle loads.
The library is the source of truth; the app overrides nothing.

**Dark mode** is a second full palette — carbon black through dark grey — selected by a
switch in the header. Only the *semantic* token tier is redefined, so no component contains
a light/dark branch: the theme swaps underneath them. Three things deliberately do not
invert, because they carry meaning rather than decoration: the favorite heart stays red,
the Veg Only green stays green, and the danger red stays red. Each is re-picked for
contrast against a dark ground rather than re-hued.

The choice is stored in its own cookie and applied to `<html>` in `hooks.server.ts`, so the
correct palette is in the first byte of HTML — there is no flash of the wrong theme on
load. The reasoning is in [ARCHITECTURE.md](ARCHITECTURE.md#decision-log).

Every animation is wrapped in `prefers-reduced-motion`, and the drag-and-drop in the
planner is an enhancement over a `<select>` that remains the keyboard and touch path.

**One caveat on Veg Only.** TheMealDB has no vegetarian field, so for API recipes the flag
is derived from the category — which classifies the category, not the dish. Recipes you
write yourself are asked directly and stored. The reasoning is in
[ARCHITECTURE.md](ARCHITECTURE.md#veg-only-a-second-cookie-and-a-derived-flag).

---

## Prerequisites

- **Node.js 20 or newer** (developed against 24.19 LTS)
- **npm 10 or newer**
- **Git**

---

## Setup

The repository contains **two independent npm projects**. This is deliberate: the
assignment requires the application to consume the *published* package rather than import
from source, so npm workspaces are not used — they would link the library as a local
symlink and defeat that requirement.

Each project therefore has its own `node_modules` and its own lockfile, and needs its own
`npm install`.

```bash
git clone https://github.com/sahilsoni432/Meal-Planner.git
cd Meal-Planner
```

**1. Build the component library** (optional — the app installs it from npm, so this is
only needed to work on the components themselves):

```bash
cd recipe-ui
npm install
npm run build
```

**2. Run the application:**

```bash
cd web
npm install
npm run dev
```

The app starts at **http://localhost:5173**.

---

## Scripts

### `web/` — the SvelteKit application

| Script | Purpose |
|---|---|
| `npm run dev` | Development server at http://localhost:5173 |
| `npm run build` | Production build (Vercel adapter) |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Type-check the whole project with `svelte-check` |
| `npm run format` | Format with Prettier |
| `npm run lint` | Check formatting |

To produce a production build on Windows, set `ADAPTER=node` — see
[Known limitations](#known-limitations).

### `recipe-ui/` — the Stencil component library

| Script | Purpose |
|---|---|
| `npm start` | Dev server with a live component demo at http://localhost:3333 |
| `npm run build` | Production build into `dist/` and `loader/` |
| `npm run generate` | Scaffold a new component |

`npm start` serves `src/index.html`, a plain HTML page that exercises every component and
logs every event. It uses no framework, which is what demonstrates that the components are
framework-agnostic.

---

## The published package

The component library is published to npm as
[**recipe-planner-ui**](https://www.npmjs.com/package/recipe-planner-ui), currently at
**v1.6.2**. It is framework-agnostic: the components are standard custom elements and need
no Svelte, React, or build step to run.

- **`rp-recipe-card`** — recipe summary tile with a favorite toggle and an `actions` slot
- **`rp-search-bar`** — search input that emits on submit rather than on every keystroke
- **`rp-filter-menu`** — collapsible filter tray with its own search field
- **`rp-filter-chips`** — single-select chip row for a short list of options
- **`rp-select`** — styled dropdown, a replacement for the unstylable native `<select>`
- **`rp-ingredient-list`** — measure-and-name ingredient table
- **`rp-day-slot`** — one day of the weekly plan, with drag-and-drop between days
- **`rp-modal`** — dialog with a focus trap and Escape handling

Versioning follows semver: **patch** for a fix with no API change, **minor** for a new
component or optional prop, **major** for a renamed or removed tag, prop, event, or slot.

### Verifying that the app consumes the published package

```bash
cd web
npm ls recipe-planner-ui
```

The dependency resolves to a **registry tarball**, not a local path:

```
web@0.0.1
`-- recipe-planner-ui@1.6.2
```

`web/package.json` names a semver range (`"recipe-planner-ui": "^1.6.2"`), never a `file:`
or `link:` specifier, and `web/package-lock.json` records
`"resolved": "https://registry.npmjs.org/recipe-planner-ui/-/recipe-planner-ui-1.6.2.tgz"`.

### Working on the library locally

Because the app installs from the registry, a change to `recipe-ui/` is not visible to
`web/` until it is published. During development, use the library's own dev server
(`npm start` in `recipe-ui/`) — it renders every component in isolation and is faster than
a publish cycle. `npm link` is deliberately avoided so that no symlink can ever
contaminate the proof above.

---

## Deployment

Live at **https://browniebites-app.vercel.app**, on **Vercel** with
`@sveltejs/adapter-vercel`.

Vercel project settings:

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | SvelteKit |
| Build Command | `npm run build` (default) |
| Install Command | `npm install` (default) |

No environment variables are required. TheMealDB's public test key is used, and there is no
authentication.

Nothing in the codebase refers to the deployment URL — no absolute links, no canonical tag,
no CORS allowlist — so the domain is set entirely in **Settings → Domains** and renaming it
needs no code change. Only this file names the address, which is why it is the one place to
update when it changes.

Note that the previously generated `.vercel.app` domain stops resolving once the project is
renamed; it is not kept as a redirect. Any link to the old address has to be updated.

---

## Architecture

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the layer model, component contracts,
data-flow walkthroughs, and the decision log.

The short version:

```
recipe-ui/   Stencil    framework-agnostic visual primitives, published to npm
web/         SvelteKit  routing, data loading, mutations, composition
```

A Stencil component never fetches, never knows a route, and never knows what a "recipe" is
beyond primitive props. Anything that needs application context is a Svelte component.

---

## Assumptions

1. **No authentication.** There are no user accounts; anyone can add, edit, and delete
   recipes. State is per-visitor rather than global — see the next assumption. Adding
   accounts would mean a user table and a per-user store, which is beyond the assignment's
   scope.

2. **Persistence is a cookie, and state is per-visitor.** Favorites, your recipes, and the
   meal plan live in an `httpOnly` cookie rather than a database. Two people opening the
   deployed link therefore keep their own data instead of overwriting each other's. All
   persistence goes through two functions (`read`/`write` in `$lib/server/store.ts`), so
   replacing it with a database is a single-file change.

3. **Storage is capped at roughly 4KB.** That is the browser's cookie limit — comfortably
   enough for favorites, a week of meals, and a handful of custom recipes, but a save that
   would not fit is refused with a message rather than silently dropped. See
   [Known limitations](#known-limitations).

4. **Only user-created recipes are editable.** Recipes from TheMealDB are read-only, which
   is why `/my-recipes` lists only your own.

5. **The planner renders on the client.** `/planner` sets `ssr = false` deliberately; the
   reasoning is in ARCHITECTURE.md.

6. **No test framework.** The assignment does not ask for one, and the dependency budget
   was kept deliberately small. Verification was done by driving the running application
   over HTTP — including with JavaScript disabled — as described below.

---

## Known limitations

**Storage is capped at about 4KB, and is per-browser.** State lives in a cookie, so it
survives redeploys and cold starts, but it does not follow you to another browser or
device, and clearing site data clears it. Roughly ten to fifteen custom recipes fit
alongside a full week of meals; beyond that a save is refused with a message asking you to
remove something first, rather than failing silently.

This replaced a JSON file on disk, which returned a 500 on every write once deployed —
Vercel's filesystem is read-only. A cookie needs no external service and no signup, which
suits a demo; a real deployment would put `read`/`write` in front of a database instead.

**Building on Windows requires `ADAPTER=node`.** `@sveltejs/adapter-vercel` creates a
symlink in its final step, which Windows blocks without Developer Mode or elevated
privileges. This affects local builds only — Vercel builds on Linux and is unaffected. To
verify a production build on Windows:

```bash
cd web
ADAPTER=node npm run build          # PowerShell: $env:ADAPTER="node"; npm run build
ORIGIN=http://localhost:4173 PORT=4173 node build/index.js
```

`ORIGIN` is required by `adapter-node` for SvelteKit's CSRF origin check to pass. Vercel
sets the equivalent automatically.

**Search matches recipe names only.** TheMealDB's `search.php` searches titles, not
ingredients or instructions, so "chicken" finds chicken dishes but "paprika" finds nothing
even though recipes use it. This is upstream behaviour.

---

## Verification

Everything below was checked against the **production build**, not just the dev server.

| Check | Result |
|---|---|
| `npm run check` in `web/` | 0 errors, 0 warnings, 356 files |
| Recipe CRUD, validation, favorites over plain form posts | 19/19 |
| Planner assign / move / remove, including rejected input | 9/9 |
| Published package entry points, ESM and CommonJS | 13/13 |
| `npm ls recipe-planner-ui` resolves to a registry version | confirmed, not a symlink |
| No `src/` in the published tarball | confirmed |

**JavaScript disabled.** Every mutation is a form action, so creating, editing, deleting,
favoriting, and planning all work without client-side JavaScript. This was verified by
driving the application over plain form posts with no client script involved — the same
path a browser with JavaScript disabled takes.

---

## License

MIT
