# Architecture

How this application is put together, and why. The decision log at the end records the
alternatives that were considered and rejected — that is the part most worth reading.

---

## 1. Layer model

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
│  TheMealDB client and the JSON store. Never imported by     │
│  client code — enforced by SvelteKit at build time.         │
└─────────────────────────────────────────────────────────────┘
```

**The boundary rule.** A Stencil component must work in a bare `.html` file with no
application context. If it needs to know about the API, the current user, or a route, it
is a Svelte component instead. `recipe-ui/src/index.html` enforces this in practice: every
component is demonstrated there with no framework present.

---

## 2. Component contracts

All seven components use `scoped: true` rather than `shadow: true`, so the consuming
application's global CSS reaches them before hydration.

That cuts both ways, and 1.3.0 found the sharp edge. An app-level rule reaches these
components, so a custom property the *app* has not defined resolves to its initial value
inside them even though the package defines it. The favorite heart read `--rp-color-favorite`
and rendered black, because `web/src/app.css` mirrors only the tokens it uses and this one
was not among them. **Any token a component reads must be mirrored by a consumer that
ships its own global stylesheet**, not merely shipped in the package.

| Tag | Props | Events | Slots |
|---|---|---|---|
| `rp-recipe-card` | `recipeId`, `recipeTitle`, `image`, `category`, `area`, `minutes`, `href`, `hrefLabel`, `favorite` | `rpFavoriteToggle` | default (badges), `actions` |
| `rp-search-bar` | `value`, `placeholder`, `label` | `rpSearch`, `rpClear` | — |
| `rp-filter-chips` | `options[]`, `selected`, `label` | `rpFilterChange` | — |
| `rp-filter-menu` | `options[]`, `selected`, `label`, `searchPlaceholder`, `searchable`, `open` | `rpFilterChange`, `rpMenuToggle` | — |
| `rp-select` | `options[]`, `value`, `label`, `placeholder`, `open`, `disabled`, `compact` | `rpSelectChange` | — |
| `rp-ingredient-list` | `items[]` | — | `heading`, default (footnote) |
| `rp-day-slot` | `day`, `dayLabel`, `meals[]`, `days[]`, `dayLabels` | `rpAddMeal`, `rpRemoveMeal`, `rpMoveMeal` | default (empty state) |
| `rp-modal` | `open`, `heading` | `rpClose` | default, `footer` |

**Props down, events up.** No component writes to its own props. `rp-recipe-card` emits the
*intended* next favorite state and lets the application decide whether to apply it, which
is what keeps the server the single source of truth.

**Array props have no attribute form.** `options`, `items`, `meals`, and `days` must be
assigned as DOM properties. This is a rule of the custom elements standard; Svelte does it
automatically when a property of that name exists on the element.

**One method, deliberately.** `rp-modal.focusFirstField()` is the only `@Method` in the
library. Moving focus is a one-shot action with no state a prop could represent — toggling
a `shouldFocus` prop would require resetting it to fire twice. Everything else is props and
events.

**Lifecycle where it earns its place.** `rp-modal` adds a `keydown` listener when it opens
and removes it in `disconnectedCallback`; without that, every mount of a page containing a
modal leaks a listener. `rp-day-slot` normalizes its `meals` property in
`componentWillLoad` because a custom element can receive properties before it upgrades.

---

## 3. Routes and rendering

| Route | Renders | Why |
|---|---|---|
| `/` | SSR | Public and indexable; filtered views are shareable URLs |
| `/recipes/[id]` | SSR | The most SEO-relevant page |
| `/my-recipes` | SSR | Cheap — no external calls |
| `/my-recipes/new`, `/my-recipes/[id]/edit` | SSR | Form actions must work without JavaScript |
| `/favorites` | SSR | Consistent with `/` |
| `/about` | SSR | Static content, and the page most worth indexing after `/` |
| `/planner` | **client only** (`ssr = false`) | See below |

`/about` has no load function at all: it explains features rather than reading any state, so
its content is written directly in the component and a round trip would buy nothing. Its FAQ
uses native `<details>` rather than a scripted accordion — it opens without JavaScript, is
keyboard operable and correctly announced with no ARIA of our own, and find-in-page expands
a closed section for free.

**Why the planner opts out of SSR.** Stencil has no Svelte output target and no supported
SvelteKit SSR path — custom elements render as empty tags on the server and populate only
once JavaScript loads. That is tolerable for a grid of cards, where the package's
`:not(:defined)` sizing rules reserve space and prevent layout shift. The planner is the
worst case for it: seven elements each taking an **array property**, plus a modal. Array
props cannot survive as stringified attributes, so server-rendered markup would be
meaningfully wrong rather than merely unstyled. The page has no SEO value, so opting out
costs nothing and removes the entire class of problem.

---

## 4. Data model

### Namespaced ids

```
api:52772     a TheMealDB idMeal
usr:a475be8d  a user-created recipe
```

`isLocal(id)` and `rawId(id)` are the only helpers this requires, and the consequence is
large: favorites is a flat `string[]` holding both kinds, the planner stores whatever ids
it is given, and the discovery grid concatenates local and API results with no schema
conflict. **This single decision removes parallel data paths throughout the application.**

### Normalizing TheMealDB

The API returns ingredients as forty flat fields — `strIngredient1..20` and
`strMeasure1..20`. The normalizer collapses them into an array and **skips empty slots
rather than stopping at the first one**, because the API leaves gaps mid-sequence: a recipe
may fill slots 1–7 and 9.

`filter.php` returns only id, name, thumbnail, and area — no category, no instructions. So
listings are typed `RecipeSummary` rather than `Recipe`, and the active filter supplies the
category. Calling `lookup.php` per card would mean one request per grid item.

### Persistence

`$lib/server/store.ts` is the entire persistence surface:

```ts
read(cookies: Cookies): Store
write(cookies: Cookies, mutate: (store: Store) => void): Store
```

State lives in an `httpOnly` cookie. The first implementation wrote a JSON file, which
worked locally and returned a **500 on every write once deployed** — Vercel's filesystem is
read-only, so `mkdir` and `writeFile` throw `EROFS`. Favoriting, saving a recipe, and
changing the plan all failed on the live site.

A cookie fixes that with no external service and no account to create, and it has a
property the file never did: state is **per-visitor**, so two people opening the deployed
link keep their own data instead of overwriting each other's.

The cost is a hard size cap of about 4KB. Two things follow from it:

- The serialized form is deliberately compact — short keys, and recipes stored positionally
  rather than as objects, which is roughly 40% smaller for the same data.
- `write` throws `StoreFullError` when the result would not fit, leaving the previous state
  intact. Callers turn that into a field error with the user's input echoed back, so a save
  that does not fit is refused visibly rather than dropped silently.

There is **no module-level cache** — one Node process serves every visitor, so module-scoped
mutable state would leak one user's data into another user's request. Reading per request
from `event.cookies` is what makes that impossible by construction.

---

## 5. State placement

| State | Home | Why |
|---|---|---|
| Search query, category, area | **URL search params** | Shareable, reload-proof, and drives the server load |
| Favorites, recipes, plan | **Server store**, via `load` + form actions + `invalidateAll()` | Single source of truth |
| Modal open, picking-for day, ingredient rows | **`$state`** in the owning component | Nothing else needs it |
| Toast notifications | **Context + a `$state` class** | See below |

**The one store, and why it exists.** Favoriting happens on a card deep inside a grid, but
the confirmation message appears in the layout — components with no parent-child
relationship to pass a prop through. Server data cannot express it (it is never persisted)
and the URL should not (`?toast=saved` would survive sharing and reload, which is wrong for
a notification). That is what a store is for.

**Why it is created in the layout rather than exported as a singleton.** A module-level
`export const toasts = new ToastQueue()` is instantiated **once per Node process**, and one
process serves every visitor — one user's notifications would appear in another user's
page. `createToasts()` calls `setContext`, which creates one instance per render. This is
the single most dangerous mistake available on this stack, and the reason the store is
shaped the way it is.

**Why nothing else uses a store.** Favorites, recipes, and the plan are server-owned and
re-fetched through `load`; filters live in the URL; modal state is owned by one component.
Adding a store for any of them would introduce a second source of truth for data the server
already holds.

---

## 6. Data-flow walkthrough: favoriting a recipe

The full round trip, which is the clearest illustration of how the layers connect:

```
1. User clicks the heart inside <rp-recipe-card>          (Stencil)
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
submits a sibling form instead. Without JavaScript, the custom element never upgrades, and
a fallback `<button>` inside that same form posts the identical action. One server-side
code path serves both.

---

## 7. Decision log

### Two npm projects, not a workspace

npm workspaces would hoist the library into the root `node_modules` as a **symlink to the
local folder**. `npm ls` would show `-> ./recipe-ui`, and the requirement to consume the
published package would be unmet in substance while appearing to be met. The cost is two
`npm install` runs, which the README documents as deliberate.

`npm link` is avoided for the same reason, even for local iteration. The library's own dev
server covers component development.

### `scoped: true` rather than `shadow: true`

Shadow DOM gives real encapsulation but blocks the host application's CSS. Because these
components are not server-rendered, the application needs its global stylesheet to reach
them *before* they upgrade — otherwise the first paint is unstyled. `scoped` gives style
isolation through generated attributes while leaving global CSS effective.

### Search emits on submit, not on keystroke

Per-keystroke events would each trigger a navigation and a server load. A slow response can
land after the user has typed more, overwriting the field with stale text. Emitting on
submit is deterministic, produces shareable URLs, and drops no keystrokes.

### The move control is a `<select>` *and* drag-and-drop

The original decision was select-only: drag-and-drop needs a keyboard-accessible path to
be usable at all, which means building the select anyway, and a week is seven items.

That reasoning still holds for the *fallback*, and it is why the select was built first —
but it was wrong to conclude that dragging therefore adds nothing. On a pointer, moving a
meal between two visible columns is a direct manipulation the dropdown cannot express: the
select requires reading labels and choosing a target by name, where a drag is the gesture
the layout already suggests.

So 1.2.0 adds dragging **over** the select rather than in place of it. Both emit the same
`rpMoveMeal`, so the consumer handles one event and the server sees one action. The select
remains the keyboard and touch path, not a legacy one.

Two details make the drag reliable rather than merely present. The payload uses a custom
`application/x-rp-meal` MIME type, so a dragged file or text selection never lights a
column up as a drop target. And `dragenter`/`dragleave` are counted rather than toggled: a
nested child fires `dragleave` as the pointer crosses it, so a boolean would flicker off
part-way through the column.

### `{#key}` instead of `$effect` for form state

`RecipeForm` seeds its editable ingredient rows from a prop. When a failed submit returns
the user's input, those rows must reset. The first implementation synchronised them with an
`$effect` — an effect that assigns to state, which is precisely the anti-pattern `$derived`
exists to replace. Keying the component on its input remounts it instead: fewer moving
parts, no effect, and the state stays genuinely owned by one component.

### Hand-rolled validation instead of a schema library

The rules are six checks over six fields. `$lib/validate.ts` is about seventy lines with no
dependency, and the same module runs on the server (in the form action) and in the browser
(before submit), so the two cannot disagree. Adding zod would have introduced a dependency
larger than the code it replaced.

### A cookie behind a two-function seam

A database is the right answer for a real deployment and a poor fit for a graded demo —
it needs provisioning, credentials, and an account the reviewer cannot see into.

The first attempt was a JSON file, which passed every local test and then returned a 500 on
every write in production, because Vercel's filesystem is read-only. That is worth
recording: the defect was invisible until the code ran on the platform it targets, and no
amount of local testing would have surfaced it.

The seam is what made the recovery cheap. Every route reaches persistence through `read`
and `write` only, so replacing the file with a cookie touched one file plus the call sites'
signatures — no route logic changed. Swapping in Postgres or Redis later is the same shape
of change.

### Dark mode, authored as a second palette rather than a filter

The 1.2.0 palette is cream paper, espresso ink, and a caramel highlight. It replaced a
neutral grey scheme that carried a `prefers-color-scheme: dark` block, and that block was
dropped rather than kept: its values were the *old* scheme, so on a dark-mode device the
library rendered in a palette unrelated to its documented one. The note left here said a
dark counterpart would have to be a deliberate second design, not a re-added block. 1.6.0
is that design.

**Only the semantic tier is redefined.** The token file has three tiers — primitive,
semantic, component — and components were already forbidden from reading primitives. That
constraint is what makes the theme a ~60-line block: `:root[data-theme='dark']` re-points
the semantic names at a carbon scale, and every component follows without a single
mode branch of its own. The tier separation paid for itself here.

**Shadows change basis.** The light theme mixes every shadow from espresso brown, because
a neutral shadow over cream reads as grey dirt. On carbon that same brown is invisible, so
the dark theme mixes from black and leans on *surface steps* for elevation instead —
`--rp-color-surface` sits above `--rp-color-canvas`, and raised sits above that. This is
the part that is genuinely a second design rather than a swap.

**The accent inverts its role.** In light, `--rp-color-accent` is dark espresso on cream
and `--rp-color-accent-contrast` is the cream. In dark those swap: the accent becomes a
warmed caramel and its contrast becomes the carbon beneath it. A dark accent on a dark
canvas would simply disappear.

**Three colours deliberately do not invert.** The favorite heart stays red, the Veg Only
green stays green, and the danger red stays red — each carries meaning rather than
decoration, and a heart is only legible as a heart in red. They are re-picked for contrast
against carbon (a brighter red, a brighter green), not re-hued.

**A handful of literals had to become tokens first.** A few places had baked in a light
value because there had only ever been one theme to serve: the white disc behind the
favorite heart, the card's image fallback, the modal backdrop, the shimmer sheen, and the
toast — which is deliberately the *inverse* of the page, so it had to become light-on-dark
rather than follow the surface tokens. Each became a component-tier token with the old
value as its fallback, so the light theme is byte-identical.

**No flash of the wrong theme.** The preference lives in its own cookie and is stamped onto
`<html>` by `transformPageChunk` in `hooks.server.ts` — the only hook that can reach an
element outside the component tree. The palette is therefore correct in the first byte of
HTML. Resolving it after hydration would paint light and repaint dark a frame later.

`prefers-color-scheme` is deliberately *not* consulted: the server cannot read a media
query, so honouring it would reintroduce exactly that flash. The header switch is the
explicit answer, and the cookie remembers it.

**The toggle does not invalidate any load.** Veg Only must, because it changes which
recipes the server sends. The theme changes one attribute on `<html>`, which every token in
both stylesheets is anchored to — so it is applied directly to the document and repaints in
one frame with no request at all.

### One page measure could not serve both the grid and the prose

The container was capped at 1180px. That is a defensible width for a column of text, and it
was the wrong width for this application: most of it is a *grid* of cards, and on a 1920px
display the cap left roughly 370px of empty gutter down each side while the grid held four
cards where five fit and the planner squeezed a week into 155px columns.

Removing the cap outright would trade one fault for another — a lede running the full width
of a wide monitor is genuinely hard to read. So the two concerns are separated: the shell
takes the width available (1600px), and the few text-heavy blocks are capped individually
through `--measure-prose`. **A single number was always going to suit one of them and fail
the other.**

Two things surfaced while measuring it, both worth recording:

**`min()` cannot take an `fr`.** `minmax(0, min(2fr, 72ch))` is invalid, so the declaration
was dropped silently and the recipe method ran to 1552px. A track cannot express "this
proportion, but no wider than"; the cap has to go on the content inside it.

**`ch` is not a character.** It is the width of the "0" glyph, which is narrower than
average prose, so a `68ch` box actually set **83 characters** per line. That only came to
light because the assertion was changed from pixels to counting real characters — the pixel
check had been passing on text that was too wide to read comfortably. Anything asserting
readability should count characters, not pixels.

### A press is not a choice until the finger lifts

`rp-select` committed a selection on `pointerdown`. With a mouse that is right: the press is
unambiguous, and `preventDefault()` there is what keeps focus on the trigger instead of
moving it to the option.

With a finger it is wrong, because the same press is also how the list is *scrolled*.
Touching a long list to scroll it selected whatever option happened to be under the first
contact and closed the list, so the list could not be scrolled at all — and the
`preventDefault()` cancelled the browser's own scrolling on top of that.

Touch is resolved on release instead: where the finger landed is recorded, and the release
compares the distance travelled. Under ten pixels it was a tap; beyond that it was a scroll
and selects nothing. **The general shape: a gesture that also serves as a scroll cannot be
committed on contact.**

This sat underneath the ghost-click fix from the previous release without either being
noticed, because that fix was concerned with the synthetic click *after* a selection and
never questioned whether committing on contact was right in the first place.

### A dialog has to hold the page still

`rp-modal` had no background scroll lock. On a desktop that is merely untidy — the wheel
scrolls the page behind an open dialog. On a phone it broke the dialog outright: a touch
drag inside it moved the page rather than the dialog's own scrollable content, so a long
option list could not be reached.

`overscroll-behavior: contain` on the list is not sufficient on its own. It stops a scroll
*chaining* outward once the list hits its end; it does not stop the page claiming the
gesture in the first place.

The lock is `position: fixed` on `body` rather than `overflow: hidden`, because iOS Safari
ignores the latter. Fixing the body collapses it to the top of the document, so the scroll
offset is captured, re-applied as a negative `top`, and restored on release — otherwise
closing the dialog would jump the page to the top. It is released on unmount as well as on
close, since navigating away with a dialog open would otherwise leave the page frozen with
no way back.

### Secure contexts, and why `localhost` lies

Two separate bugs made the whole application look broken on a phone while working perfectly
on the developer's machine. Both had the same root: **`localhost` is treated as a secure
context and a LAN IP is not.**

**`crypto.randomUUID` is undefined over plain HTTP.** The toast queue used it for ids.
Every mutation ends by pushing a toast from inside the `use:enhance` callback, so the throw
rejected that callback *before* `update()` ran — remove, move, add, and favorite all
silently did nothing, with no message and no visible error. A counter replaced it; these
ids live four seconds inside one page and nothing outside the module sees them.

**A `Secure` cookie is discarded outright over plain HTTP.** `store.ts` hard-coded
`secure: true`, so the browser threw away every `Set-Cookie`. This one was worse than the
first because it was invisible from the server's side: the action ran, returned success,
and the toast appeared — while nothing persisted. The next load re-read the previous cookie
and the change vanished.

SvelteKit's own default is not sufficient here: it exempts `localhost` only and still sets
`Secure` for any other HTTP host. The flag is now taken from the request's protocol, so
production keeps it and a LAN IP does not.

The general shape: **an environment difference that only appears off the developer's
machine will not be found by testing on the developer's machine.** Device emulation shares
the same blind spot — it changes the viewport, not the origin. The regression suite now has
a pass that deletes `crypto.randomUUID`, drives the app over the LAN IP rather than
`localhost`, and asserts that the cookie is actually *stored* rather than merely sent.

### Two navigations, not one that scrolls

Below 860px the four nav pills no longer fit, and the row used to become a horizontally
scrolling strip. That is a poor pattern: items are hidden past the edge with nothing to say
so, and on a phone the strip competes with the page's own scrolling. It also consumed the
whole header, which is why the app name had been dropped on mobile.

Both presentations are rendered and one is chosen by CSS, not by a viewport width read in
script — which would need a resize listener and would be wrong during SSR. Exactly one is
`display: none` at any width, which keeps the hidden one out of the tab order too, so the
same four links are never announced twice.

Trading the strip for a menu button freed enough width for the wordmark and the theme
switch to sit in the mobile header as they do on the desktop one.

The menu dismisses on `pointerdown` rather than `click`, for the reason `rp-filter-menu`
already had to learn: on `click` the dismissal and the activation of whatever is behind land
in the same frame, and the panel appears to linger through the tap. It closes on navigation
too — SvelteKit reuses the layout across routes, so the component is never destroyed and
would otherwise stay open over the page just chosen.

### Veg Only: a second cookie, and a derived flag

**Where the preference lives.** Its own small cookie, `vegOnly`, not the store. The store
cookie is `httpOnly` and capped at about 4KB with recipes, favorites, and the plan already
in it, so a display preference has no business spending those bytes. Because this one is
readable from script the toggle can flip it and re-run the loads without a form POST, and
because the server still sees it on the first request the first paint is already filtered
rather than flashing the unfiltered list.

**The part that is easy to get wrong.** A server load's use of `cookies.get()` is invisible
to SvelteKit's dependency tracking. `invalidateAll()` therefore re-runs *nothing* — the
page keeps its cached data until a full reload, and the toggle silently appears broken.
Every load that reads the preference registers `depends(VEG_DEPENDENCY)` and the toggle
calls `invalidate(VEG_DEPENDENCY)`; the two halves are a contract, and neither works alone.

**Where `isVeg` comes from.** For user-created recipes, the form asks and the answer is
stored — an eighth, optional slot in the packed cookie recipe, written as `0 | 1` because
JSON spends one byte on that and five on `false`. A recipe saved before the field existed
has seven entries and falls back to its category.

TheMealDB has no vegetarian field, so for API recipes `isVeg` is derived from the category
alone: Vegetarian, Vegan, Dessert, Pasta, Side, Starter, Breakfast, Miscellaneous are true;
Beef, Chicken, Pork, Lamb, Goat, Seafood are false. **This classifies the category, not the
dish** — a Pasta with pancetta reads as vegetarian. Being accurate per recipe means reading
the ingredients, and `filter.php`, which every grid is built on, does not return them, so
it would cost one `lookup.php` per card.

The one place that trade is taken anyway is `filterByArea`. Filtering by cuisine returns no
category at all, so there is nothing to infer from; defaulting those to non-vegetarian
would empty the grid whenever the filter is on. So that path — and only that path, and only
while Veg Only is on — resolves each result. Off, it stays a single request.

### Two defects the redesign surfaced

Both were latent before and became visible only once the surrounding layout had weight.
Recording them because each is a general trap, not a one-off:

**A closed `rp-modal` leaked its footer onto the page.** The component renders `null` when
closed, but its slotted children are the *consumer's* light DOM and still exist in the
document; with `display: contents` on the host they laid out inline, putting a stray
Cancel button and a loose form beneath the planner grid. The fix is
`:host(:not([open])) { display: none }`, which works because `open` is a reflected prop —
and it covers the pre-upgrade window too, when the element is not yet defined and its
children are just ordinary markup. **A component that conditionally renders nothing still
owns the layout of whatever was slotted into it.**

**The day-slot header clipped its add button.** The panel sets `overflow: hidden` for its
rounded corners; a long day name plus a count badge exceeded a 151px column, and because a
flex item defaults to its content width, `space-between` pushed the button past the
clipped edge. The day name gets `min-width: 0` and an ellipsis so it can actually shrink,
which is what lets seven columns hold their heading at any width the grid is given.

### Replacing the native `<select>`

The two dropdowns in the planner kept looking wrong after their typography was corrected,
and the reason is worth recording because it is easy to lose an afternoon to.

**A native `<select>`'s dropdown is not part of the page.** The browser hands it to the
operating system, which draws it with platform typography, square corners, and a blue
system highlight. CSS reaches the closed control and, at best, a colour and font on
`option` — the panel itself takes nothing. Setting `font-weight` on the select fixed the
*trigger* and left the open list exactly as it was. On a small viewport that panel also
renders outside the dialog containing it, because it is not in the document's layout.

So `rp-select` renders the list as ordinary elements. That is the only way to style it, and
the cost is reimplementing what the native control provided free: Up/Down/Home/End,
Enter/Space to commit, Escape to dismiss, type-ahead, `role="combobox"` and
`role="listbox"`, and `aria-activedescendant` tracking the highlighted row.

Two containment details follow from making the list a real element. An overlay anchored
inside a scroll container is clipped by it, so `rp-modal` suspends its body scroll while a
list is open, and `rp-day-slot` drops its `overflow: hidden` for as long as one of its
meals has a list open — both scoped with `:has()` so the rounded corners and scrolling they
normally provide stay in force the rest of the time.

### Drag-and-drop needs two implementations, not one

HTML5 drag-and-drop is a mouse-only API. A touch never produces `dragstart`, so the
planner's dragging — verified working with a mouse — did nothing at all on a phone.

The fix is a second path over Pointer Events, drawing its own label on `document.body` (a
column clips its overflow, so a card following the finger could not be a child of one) and
hit-testing with `elementFromPoint` to find the target column.

**The two paths must not both arm on the same gesture.** Pointer events cover mouse as
well as touch, so the first version ran both from a mouse drag — and they fought. The
pointer path calls `preventDefault()` on `pointermove` to stop a touch scrolling the page,
and that same call suppresses the *native* drag's feedback: the card never dimmed and no
drag image appeared, though the drop still landed. A drag with no visible response reads as
broken even when it works, which is exactly how it was reported.

So the pointer path now returns immediately for `pointerType === 'mouse'` and the native
API owns the mouse outright. The lesson generalises: two input abstractions that overlap
need an explicit division, not "whichever fires first".

**Cleanup cannot hang off the dragged element.** `dragend` fires on the element the drag
started from — and a successful move re-renders that column, so the element is gone before
the event would arrive. `draggingId` stayed set, the card kept its 40% opacity, and with
the grab cursor still showing the page looked frozen even though it was fully interactive.
The state is reset from a document-level `dragend`/`drop` instead, which fires whatever
became of the source. Every column listens, not only the source, because a drop or an
Escape can leave a column highlighted with no `dragleave` ever reaching it.

The general shape: **an element that unmounts as a result of the interaction cannot be the
thing that cleans up after it.**

**`pan-y` gave away the only axis that mattered.** The first touch implementation set
`touch-action: pan-y` on a meal, reasoning that a vertical swipe should still scroll while a
horizontal one starts a drag. That separates the two intentions by *axis* — which works on a
wide viewport, where the week is a row and the target day is sideways.

On a phone the week stacks into a single column. Up and down is then the only direction that
reaches another day, so the gesture being handed to the browser was precisely the one the
feature needed. The drag could be picked up and never dropped anywhere.

This did not reproduce in a desktop browser's device emulation, and the reason is worth
recording: emulation gives a phone-width viewport in a **desktop-height window**, so all
seven days are on screen at once and a short drag lands on a target. A real phone shows two
days at a time. Emulating width is not emulating a device.

The fix has four parts, and the axis problem turned out to be the *least* of them.

**Two drag systems armed from one press.** This was the actual cause of the reported
symptom — a meal that lifted, highlighted nothing, and refused to drop. `draggable` was set
unconditionally, and Android Chrome fires a native `dragstart` on a long press. So the
pointer path started its drag, the native drag then seized the touch stream and delivered
`pointercancel` — tearing down the ghost and the highlight — and the native drag left
running had no usable drop target, because `dragover`/`drop` are not reliably delivered for
a touch-initiated drag.

`draggable` is now off as soon as a touch is seen. It is cleared on the element directly at
`pointerdown`, not only through state, because a Stencil re-render lands after the browser
has already decided whether to start a drag; the state keeps it off from then on. A
touch-initiated `dragstart` is refused as well, since some builds evaluate the press before
the attribute change is observed.

The general shape, again: **two input abstractions that overlap need an explicit division.**
The mouse/touch split earlier in this section was the same lesson; this was the same
mistake in the other direction.

**`pointercancel` is not abandonment.** On a phone it means "something else claimed this
touch" — a native drag arming, an edge swipe, a scroll heuristic. Treating it as "the user
let go" destroyed drags mid-gesture. A drag already under way now survives it; only a press
that had not yet become a drag is discarded.

**Coordinates leave the viewport constantly.** Pointer capture keeps reporting a finger
dragged past the edge of the screen, which is exactly how a day below the fold is reached.
Those positions hit-test to nothing, so the highlight dropped out and the release resolved
to no column at all. Positions are clamped into the viewport, and — importantly — the drop
resolves from the clamped point rather than the raw release coordinates.

**Separate by time, not by axis.** A ~220ms long press starts the drag; a swipe that moves
first is a scroll. `touch-action: none` has to be declared statically rather than applied
when the press completes: a browser decides a touch's scrolling behaviour at `touchstart`
and does not revisit it, so a late `none` arrives after the gesture is already committed to
scrolling. That means the component gives the page its scroll back itself for any gesture
that turns out not to be a drag.

Auto-scroll at the viewport edge then makes off-screen days reachable, since a finger that
is already touching the screen cannot scroll to one. `elementFromPoint` also gained a
geometric fallback for the gutter between columns.

**On testing.** None of this reproduced under device emulation, which supplies a phone-width
viewport in a desktop-height window — every day visible at once — and never fires a native
`dragstart` from emulated touch. Two successive test harnesses also produced misleading
results of their own by caching geometry across a scroll and by timing the release on
something other than the component's own highlight. The regression tests now re-read live
geometry every step, release only when `.is-drop-active` names the intended day, and inject
the `dragstart` and `pointercancel` an Android device adds. They were confirmed to fail
against the previous release before being trusted against this one — **a test that has never
failed has not been tested.**

An 8px threshold before a horizontal drag begins is what still keeps a tap reaching the
controls inside the card.

### The whole card is a link, stretched rather than wrapped

A card that only responds to a small "View recipe" control is not behaving like a card.
1.4.0 gives `rp-recipe-card` an `href` and covers the tile with a single anchor.

**Stretched, not wrapping.** Wrapping the card in the anchor would nest the favorite button
and everything in the `actions` slot inside a link — invalid HTML, and it takes those
controls out of the tab order. The link is instead absolutely positioned over the card at
`z-index: 1`, with the interactive parts raised to `2`. `.actions` needed
`position: relative` for that to apply at all, being in normal flow.

**It stays inside the library's boundary.** An `href` is a primitive string the component
neither builds nor interprets, so this is not route knowledge leaking into a Stencil
component — a consumer with no router passes an ordinary URL, and one that omits it gets an
inert card, which is what a picker wants.

The app dropped its own "View recipe" link at the same time. Two controls to the same
destination is one too many, and the card's link already announces the recipe title.

### Scroll position and a 303 that only one client should follow

Favoriting posts to an action that ends in `redirect(303, …)`, which is what lets a
JavaScript-less browser land back on the page it posted from. With `use:enhance` that same
redirect is applied as a client-side navigation — and a navigation scrolls to the top, so
favoriting a card near the bottom of a long grid threw the reader back to the start.

The enhance callback now inspects the result: a `redirect` is followed with
`goto(location, { noScroll: true, invalidateAll: true })`, and anything else falls through
to the default `update()`. One server code path still serves both clients; only the
client that can do better does.

### A navigation badge that omits itself rather than lie

With Veg Only on, the layout can only judge *local* ids: an API favorite's or planned
meal's veg status needs a `lookup.php` call, and doing that for every one would put a
request fan-out on every page in the application.

So `countVisible` returns `null` when a list contains any API id while the filter is on,
and the badge is omitted. A badge reading 2 above a planner showing 1 is worse than no
badge — it makes the page look broken rather than filtered. Lists that are entirely local
stay exact.

### A known, pre-existing hydration warning

Every route that renders a `RecipeGrid` logs `Failed to hydrate` once on load. It is
structural rather than a defect introduced by any one change: SvelteKit renders
`<rp-recipe-card>` as an empty tag on the server, and Stencil then fills it with DOM the
client hydrator did not expect. Svelte recovers by re-rendering the subtree, so the page is
correct — but the warning is real and worth naming rather than filtering out silently.

It was verified identical on the commit before the Veg Only work by stashing the changes
and rebuilding, so it predates all of it. Removing it means either server-rendering the
components (Stencil has no Svelte SSR target) or `ssr = false` on those routes, which would
cost the SEO the discovery and detail pages exist for. Neither trade is worth it for a
recovered warning.

### No test framework

The assignment does not ask for tests, and `@stencil/vitest` plus Playwright is the
heaviest install in the repository — the library builds with **4 packages** instead of
roughly 400. Verification was done by driving the running application over HTTP, including
the JavaScript-disabled path, which exercises the real integration rather than mocked
units. For a longer-lived project this trade would go the other way.

### `<svelte:element>` and `<svelte:component>` are absent

Nothing in this application chooses a tag or a component at runtime. Introducing either
one to demonstrate it would be code that exists only to be pointed at.

---

## 8. Version history

| Version | Type | Change | Reasoning |
|---|---|---|---|
| `1.0.0` | — | Six components | Initial API |
| `1.0.1` | patch | Fixed the `exports` map | `require()` of subpaths and of `package.json` failed. No API change, so a patch |
| `1.1.0` | minor | `rp-day-slot` gained `dayLabels` | A new **optional** prop; all 1.0.x markup keeps working, so a minor |
| `1.1.1` | patch | `aria-pressed` normalized on the favorite button | A fix with no API change |
| `1.2.0` | minor | Warm palette and a full visual pass; `rp-recipe-card` gained `area` and `minutes`; `rp-day-slot` gained drag-and-drop | New optional props and a new interaction on an existing event. No prop, event, or slot was renamed or removed, so 1.1.x markup renders unchanged — though it renders **differently**, which is the honest caveat on calling a redesign a minor |
| `1.3.0` | minor | New `rp-filter-menu`; the favorite heart turned red | A new component is a minor by the policy above. The heart's colour is a token change, not an API one |
| `1.3.1` | patch | `rp-filter-menu` could fail to open while another menu was open | A fix with no API change. Worth recording that 1.3.0 was published from a tarball packed *before* this fix existed |
| `1.4.0` | minor | `rp-recipe-card` gained `href` and `hrefLabel` | New **optional** props, so 1.3.x markup renders unchanged |
| `1.5.0` | minor | New `rp-select`; `rp-day-slot` gained touch dragging and swapped its move control to `rp-select` | A new component. Markup is unchanged and `rpMoveMeal` fires as before, though a consumer that styled the day slot's native `<select>` should drop those rules |

The 1.0.1 fix is worth recording honestly: 1.0.0 was verified only through ESM `import`,
and the two broken conditions were CommonJS-only. Installing the *published* package from
the registry and resolving every entry point under **both** module systems is what exposed
it. The verification now covers both.

---

## 9. Extension seams

- **Authentication** — add a `users` table, put the user on `event.locals` in
  `hooks.server.ts`, and key the store by user id. The store's two-function surface is
  where that change lands.
- **A real database** — replace the body of `read`/`write`. No route changes.
- **More components** — a new component is a minor version. The published type
  declarations flow into `web/src/app.d.ts` automatically.
- **Ingredient search** — TheMealDB has a `filter.php?i=` endpoint that the current
  discovery page does not use.
