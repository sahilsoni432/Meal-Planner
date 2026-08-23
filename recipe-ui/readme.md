# recipe-planner-ui

Framework-agnostic web components for recipe discovery and meal planning interfaces, built
with [Stencil](https://stenciljs.com). They are standards-based custom elements, so they work
in Svelte, React, Vue, Angular, or a plain `.html` file with no framework at all.

```bash
npm install recipe-planner-ui
```

## Registering the components

The package ships a lazy loader that registers every tag:

```js
import { defineCustomElements } from 'recipe-planner-ui/loader';

defineCustomElements();
```

In SvelteKit or any other SSR framework, register in the browser only — custom elements are a
client-side API:

```ts
// src/routes/+layout.ts
import { browser } from '$app/environment';

export async function load() {
  if (browser) {
    const { defineCustomElements } = await import('recipe-planner-ui/loader');
    await defineCustomElements();
  }
}
```

Alternatively, import individual components for tree-shaking:

```js
import { defineCustomElement as defineRecipeCard } from 'recipe-planner-ui/components/rp-recipe-card.js';

defineRecipeCard();
```

## Passing data

Primitive props can be set as attributes. **Array and object props have no attribute
representation and must be assigned as DOM properties** — this is a rule of the custom
elements standard, not a limitation of this library.

```html
<rp-recipe-card recipe-id="api:52772" recipe-title="Teriyaki Chicken" favorite></rp-recipe-card>

<rp-filter-chips id="chips"></rp-filter-chips>
<script>
  document.getElementById('chips').options = ['Chicken', 'Seafood', 'Dessert'];
</script>
```

Most frameworks, Svelte included, set properties automatically when a property of that name
exists on the element.

## Components

| Tag | Key props | Events | Slots |
|---|---|---|---|
| `rp-recipe-card` | `recipeId`, `recipeTitle`, `image`, `category`, `favorite` | `rpFavoriteToggle` | default, `actions` |
| `rp-search-bar` | `value`, `placeholder`, `label` | `rpSearch`, `rpClear` | — |
| `rp-filter-chips` | `options[]`, `selected` | `rpFilterChange` | — |
| `rp-ingredient-list` | `items[]` | — | `heading`, default |
| `rp-day-slot` | `day`, `dayLabel`, `meals[]`, `days[]`, `dayLabels` | `rpAddMeal`, `rpRemoveMeal`, `rpMoveMeal` | default |
| `rp-modal` | `open`, `heading` | `rpClose` | default, `footer` |

Per-component API documentation, generated from the source, lives in each component's
directory under `src/components/`.

### Events

All events bubble and are composed, so they can be handled on any ancestor:

```js
document.addEventListener('rpFavoriteToggle', (event) => {
  const { recipeId, favorite } = event.detail;
});
```

`rp-recipe-card` emits the *intended next state* and never writes to its own `favorite` prop.
The consumer owns the data and decides whether to apply the change.

### `rp-modal`

Handles its own focus trap, Escape-to-close, and focus restoration. It exposes one imperative
method for the case a prop cannot express:

```js
await document.querySelector('rp-modal').focusFirstField();
```

## Styling

Components use `scoped` encapsulation rather than shadow DOM, so a consuming application's
global CSS reaches them. Theming is done by overriding the semantic token tier:

```css
:root {
  --rp-color-accent: #7048e8;
  --rp-radius-lg: 4px;
}
```

Tokens are organised in three tiers — primitive (`--rp-green-600`), semantic
(`--rp-color-accent`), and component-level. Override the semantic tier to retheme the library;
the primitive tier is an implementation detail.

The package also ships pre-hydration sizing under `:not(:defined)` so pages do not reflow as
elements upgrade.

## Local development

```bash
npm install
npm start     # dev server with a demo page at http://localhost:3333
npm run build # production build
```

`src/index.html` is a plain HTML page exercising every component and logging every event —
the quickest way to verify a change, and a demonstration that these components need no
framework.

## License

MIT
