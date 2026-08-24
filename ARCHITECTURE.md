# Architecture

How the application is put together, and the reasoning behind the decisions that shaped it.

---

## 1. System overview

A recipe discovery and weekly meal planning application, built as two npm packages:

- **`recipe-ui/`** — a StencilJS component library published to npm as `recipe-planner-ui`.
  Framework-agnostic custom elements with no knowledge of routing, fetching, or the domain.
- **`web/`** — a SvelteKit application that installs the library **from the registry** and
  composes it into pages.

Recipe data comes from [TheMealDB](https://www.themealdb.com/api.php), a free public API
requiring no key. All requests are made server-side, so the browser never talks to it
directly and no upstream URL is exposed in client code.

The two packages are deliberately not an npm workspace. Workspaces would hoist the library
into the root `node_modules` as a symlink to the local folder, and the requirement to
consume a published package would be unmet in substance while appearing to be met. `npm
link` is avoided for the same reason. The cost is two `npm install` runs.

### Layer model

```
┌─────────────────────────────────────────────────────────────┐
│  recipe-ui/          Stencil — published to npm             │
│  Framework-agnostic visual primitives. No fetch, no routes, │
│  no knowledge of what a "recipe" is beyond primitive props. │
└─────────────────────────────────────────────────────────────┘
                            ▲  consumed as a registry dependency
┌─────────────────────────────────────────────────────────────┐
│  web/src/lib/        Svelte — composition                   │
│  Binds application data to the primitives. Owns local UI    │
│  state. Knows about routes and the domain model.            │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  web/src/routes/     SvelteKit — application shell          │
│  Routing, data loading, mutations, rendering strategy.      │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  web/src/lib/server/ Data access                            │
│  TheMealDB client and the store. Never imported by client   │
│  code — enforced by SvelteKit at build time.                │
└─────────────────────────────────────────────────────────────┘
```

**The boundary rule.** A Stencil component must work in a bare `.html` file with no
application context. If it needs to know about the API, the current user, or a route, it is
a Svelte component instead. `recipe-ui/src/index.html` enforces this in practice: every
component is demonstrated there with no framework present.

---

## 2. Routes and rendering

| Route | Renders | Purpose |
|---|---|---|
| `/` | SSR | Discovery: browse, search, filter by category or cuisine |
| `/recipes/[id]` | SSR | Full recipe with ingredients and instructions |
| `/favorites` | SSR | Saved recipes from both sources |
| `/my-recipes` | SSR | Recipes the user has written |
| `/my-recipes/new`, `/my-recipes/[id]/edit` | SSR | Create and edit forms |
| `/about` | SSR | Static content and an FAQ |
| `/planner` | client only | The weekly plan |

Everything is server-rendered except the planner. Stencil has no Svelte SSR target, so
custom elements render as empty tags on the server and populate once JavaScript loads. For
a grid of cards that is tolerable — the package ships `:not(:defined)` sizing rules that
reserve space and prevent layout shift. The planner is the worst case: seven day slots each
taking an **array property**, plus a modal. Arrays cannot survive as stringified
attributes, so server-rendered markup would be wrong rather than merely unstyled. The page
has no SEO value, so `ssr = false` costs nothing and removes the problem.

`/about` has no load function at all, and its FAQ uses native `<details>` rather than a
scripted accordion: it opens without JavaScript, is keyboard operable and correctly
announced with no ARIA of our own, and find-in-page expands a closed section for free.

---

## 3. Data model

### Namespaced ids

```
api:52772     a TheMealDB idMeal
usr:a475be8d  a user-created recipe
```

`isLocal(id)` and `rawId(id)` are the only helpers this needs, and the consequence is
large: favorites is a flat `string[]` holding both kinds, the planner stores whatever ids
it is given, and the discovery grid concatenates local and API results with no schema
conflict. This single decision removes parallel data paths throughout the application.

### Normalizing TheMealDB

The API returns ingredients as forty flat fields — `strIngredient1..20` and
`strMeasure1..20`. The normalizer collapses them into an array and skips empty slots rather
than stopping at the first one, because the API leaves gaps mid-sequence: a recipe may fill
slots 1–7 and 9.

`filter.php` returns only id, name, thumbnail, and area — no category, no instructions. So
listings are typed `RecipeSummary` rather than `Recipe`, and the active filter supplies the
category. Calling `lookup.php` per card would mean one request per grid item.

An unknown id returns `meals: null` with a 200 rather than a 404, so the missing case is
translated into a real 404 in the load function.

---

## 4. State and persistence

| State | Home | Why |
|---|---|---|
| Search query, category, cuisine | **URL search params** | Shareable, reload-proof, drives the server load |
| Favorites, recipes, plan | **Server store** via `load` + form actions | Single source of truth |
| Modal open, selected day, ingredient rows | **`$state`** in the owning component | Nothing else needs it |
| Theme, Veg Only | **Their own cookies** | Readable by both server and client |
| Toast notifications | **Context + a `$state` class** | Crosses an unrelated component boundary |

### The store

`$lib/server/store.ts` is the entire persistence surface:

```ts
read(cookies: Cookies): Store
write(cookies: Cookies, mutate: (store: Store) => void): Store
```

State lives in an `httpOnly` cookie. The first implementation wrote a JSON file, which
worked locally and returned a 500 on every write once deployed — the host filesystem is
read-only, so `writeFile` throws `EROFS`. Favoriting, saving a recipe, and changing the
plan all failed on the live site.

A cookie fixes that with no external service and no account to create, and it has a
property the file never did: state is **per-visitor**, so two people opening the deployed
link keep their own data instead of overwriting each other's.

The cost is a hard size cap of about 4KB, and two things follow from it:

- The serialized form is compact — short keys, and recipes stored positionally rather than
  as objects, which is roughly 40% smaller for the same data.
- `write` throws `StoreFullError` when the result would not fit, leaving the previous state
  intact. Callers turn that into a field error with the user's input echoed back, so a save
  that does not fit is refused visibly rather than dropped silently.

There is no module-level cache. One Node process serves every visitor, so module-scoped
mutable state would leak one user's data into another user's request; reading per request
from `event.cookies` makes that impossible by construction.

### Theme and Veg Only

Both preferences use their own cookie rather than the store. The store cookie is `httpOnly`
and already near its cap, and a display preference has no business spending those bytes.
Being script-readable lets each toggle re-run the loads without a form POST, while the
server still sees the value on the first request — which is what keeps the first paint from
flashing the wrong theme.

A server load's use of `cookies.get()` is invisible to SvelteKit's dependency tracking, so
each module exports a dependency key that its readers register with `depends()`. Without
it, `invalidateAll()` would not re-run those loads.

### The one store, and why it exists

Favoriting happens on a card deep inside a grid, but the confirmation message appears in
the layout — components with no parent-child relationship to pass a prop through. Server
data cannot express it (it is never persisted) and the URL should not (`?toast=saved` would
survive sharing and reload, which is wrong for a notification).

It is created in the layout rather than exported as a singleton. A module-level
`export const toasts = new ToastQueue()` is instantiated once per Node process, and one
process serves every visitor — one user's notifications would appear in another user's
page. `createToasts()` calls `setContext`, which creates one instance per render.

Nothing else uses a store: favorites, recipes, and the plan are server-owned and re-fetched
through `load`, filters live in the URL, and modal state is owned by one component. Adding
a store for any of them would introduce a second source of truth.

---

## 5. Data flow

The full round trip for favoriting a recipe, which is the clearest illustration of how the
layers connect:

```
1. User clicks the heart inside <rp-recipe-card>           (Stencil)
2. Component emits rpFavoriteToggle { recipeId, favorite } (Stencil → DOM event)
3. RecipeGrid's onrpFavoriteToggle handler fires           (Svelte)
4. Handler calls form.requestSubmit() on a sibling form    (Svelte)
5. POST /?/toggleFavorite with use:enhance                 (SvelteKit form action)
6. Action calls write(), toggling the id in favorites      (server store)
7. use:enhance triggers invalidateAll()                    (SvelteKit)
8. Layout load re-reads favorites from the store           (server)
9. New favorites array flows back down as a prop           (Svelte → Stencil)
10. Toast pushed to the context store, rendered in layout  (Svelte)
```

**Why step 4 exists.** The card's favorite button lives *inside* a custom element, so it
cannot be a `<form>` submit button — the form is outside the element's subtree. The handler
submits a sibling form instead. Without JavaScript the custom element never upgrades, and a
fallback `<button>` inside that same form posts the identical action. One server-side code
path serves both.

---

## 6. Component library

Published as [`recipe-planner-ui`](https://www.npmjs.com/package/recipe-planner-ui).

| Component | Props | Events | Slots |
|---|---|---|---|
| `rp-recipe-card` | `recipeId`, `recipeTitle`, `image`, `category`, `area`, `minutes`, `href`, `hrefLabel`, `favorite` | `rpFavoriteToggle` | default, `actions` |
| `rp-search-bar` | `value`, `placeholder`, `label` | `rpSearch`, `rpClear` | — |
| `rp-filter-menu` | `options[]`, `selected`, `label`, `searchPlaceholder`, `searchable`, `open` | `rpFilterChange`, `rpMenuToggle` | — |
| `rp-filter-chips` | `options[]`, `selected`, `label` | `rpFilterChange` | — |
| `rp-select` | `options[]`, `value`, `label`, `placeholder`, `open`, `disabled`, `compact` | `rpSelectChange` | — |
| `rp-ingredient-list` | `items[]` | — | `heading`, default |
| `rp-day-slot` | `day`, `dayLabel`, `meals[]`, `days[]`, `dayLabels` | `rpAddMeal`, `rpRemoveMeal`, `rpMoveMeal` | default |
| `rp-modal` | `open`, `heading` | `rpClose` | default, `footer` |

All eight use `scoped: true` rather than `shadow: true`. Shadow DOM gives real
encapsulation but blocks the host application's CSS; because these components are not
server-rendered, the application needs its global stylesheet to reach them before
hydration. Every event is `bubbles: true, composed: true` so it crosses the boundary.

### Integration notes

Scalar props are written as **kebab-case attributes** (`recipe-title`, not `recipeTitle`).
Svelte sets properties on a custom element only once it has upgraded; during SSR it writes
attributes, and HTML lowercases `recipeTitle` to `recipetitle`, which matches nothing.

Arrays and objects have no attribute form at all, so they are assigned as **DOM properties**
through an attachment that runs on the real element in the browser. Written as attributes
they would stringify to `[object Object]`, or comma-join in a way that is lossy for a value
containing a comma — such as the cuisine "Antiguan, Barbudan".

Boolean props are omitted rather than set to `"false"`: Stencil reads a boolean from
attribute presence, so any non-empty string is true.

Components are registered from `dist/components` rather than the package's loader. The
loader fetches per-component chunks relative to where it was served; Vite bundles it into
the app's chunk directory without those chunks, so nothing upgrades and every tag renders
as an empty box.

### Design decisions

**Search emits on submit, not on keystroke.** Per-keystroke events would race the
consumer's own navigation — each triggers a server round trip, and a slow response can land
after the user has typed more.

**`rp-select` replaces the native `<select>`.** The browser draws the open list through the
operating system, so it keeps platform typography regardless of the page stylesheet, and on
a phone it breaks out of a dialog entirely.

**`rp-filter-menu` replaced a chip row.** With around thirty categories and cuisines, chips
filled the top of the page before any content appeared. The menu collapses the same
single-select behaviour behind one pill and adds a search field of its own.

**The move control is a select *and* drag-and-drop.** Dragging is the better interaction
where it works; the select is what makes the planner operable by keyboard and on touch.
Both emit the same `rpMoveMeal`, so a consumer handles one event.

---

## 7. Accessibility and responsive design

**Semantic markup.** Landmarks (`<header>`, `<main>`, `<nav aria-label>`), one `<h1>` per
page, and an ordered list for instruction steps. The FAQ is `<details>`/`<summary>`.
Breadcrumbs use `aria-current="page"`, and navigation marks the active route the same way.

**Keyboard.** Every interaction is reachable without a pointer. The modal traps focus,
closes on Escape, and restores focus to whatever opened it. `rp-select` and
`rp-filter-menu` handle arrow keys, Enter, and Escape, and close on an outside click. The
planner's move control exists so meals can be rescheduled without dragging.

**Screen readers.** Icon-only buttons carry `aria-label`; decorative SVGs are
`aria-hidden`. The favorite button exposes `aria-pressed`. Form fields use real `<label>`
elements and `aria-invalid` with the error text tied to the field it describes.

**Progressive enhancement.** Every mutation is a real `<form>` posting to a form action.
With JavaScript disabled, favoriting, creating, editing, and deleting all still work — the
303 redirect is what the browser follows. `use:enhance` upgrades the same paths in place.

**Theme.** Two palettes authored as semantic tokens (`--rp-color-surface`,
`--rp-color-text`), not a CSS filter over one palette — a filter inverts photographs along
with the interface. The server reads the theme cookie and stamps `data-theme` on `<html>`
in the first byte of HTML, so there is no flash of the wrong palette.

**Responsive.** One page measure shared across routes. The planner steps from seven columns
to four, then two, then one; the recipe grid is `auto-fill` with a minimum track width. The
navigation collapses to a menu below the width where the pills stop fitting, and only one
of the two is in the accessible tree at a time. Motion is disabled under
`prefers-reduced-motion`.

**Touch.** Drag-and-drop has a pointer-events implementation for touch alongside the native
HTML5 one for mouse. Native drag on Android fires from a long press, which conflicts with
the pointer path and leaves a drag that cannot be dropped, so it is disabled there.

---

## 8. Versioning and extension

The library follows semver: **patch** for a fix with no API change, **minor** for a new
component or optional prop, **major** for a renamed or removed tag, prop, event, or slot.
Every release so far has been a patch or a minor — no breaking change has been needed,
because new capability has consistently arrived as optional props on existing components.

Seams for anything built on top of this:

- **Authentication** — put the user on `event.locals` in `hooks.server.ts` and key the
  store by user id. The store's two-function surface is where that change lands.
- **A real database** — replace the body of `read`/`write`. No route changes.
- **More components** — a new component is a minor version. The published type
  declarations flow into `web/src/app.d.ts` automatically.
- **Ingredient search** — TheMealDB has a `filter.php?i=` endpoint the discovery page does
  not currently use.
