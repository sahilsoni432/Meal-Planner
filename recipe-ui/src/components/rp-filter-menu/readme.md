# rp-filter-menu



<!-- Auto Generated Below -->


## Overview

A collapsed filter control: a pill that opens a tray of options.

`rp-filter-chips` renders every option at once, which is right for a handful and wrong
for the ~30 categories and cuisines a recipe app has — the chips fill the top of the
page before any content appears. This collapses the same single-select behaviour behind
one trigger and adds a search field, so a long list stays usable.

It emits the same `rpFilterChange` as `rp-filter-chips`, including `null` to clear, so
a consumer can swap one for the other without touching its handler.

## Properties

| Property            | Attribute            | Description                                                                                                      | Type       | Default     |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| `label`             | `label`              | Text on the trigger, e.g. "Category".                                                                            | `string`   | `'Filter'`  |
| `open`              | `open`               | Whether the tray is open. Reflected so a consumer can style the open state.                                      | `boolean`  | `false`     |
| `options`           | --                   | Available values. An array has no attribute representation, so this must be assigned as a DOM property.          | `string[]` | `[]`        |
| `searchPlaceholder` | `search-placeholder` | Placeholder for the in-tray search field.                                                                        | `string`   | `'Search…'` |
| `searchable`        | `searchable`         | Hides the search field. Below roughly a dozen options the field costs more attention than the scanning it saves. | `boolean`  | `true`      |
| `selected`          | `selected`           | Currently active value, or null when no filter is applied.                                                       | `string`   | `null`      |


## Events

| Event            | Description                                                                  | Type                                             |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `rpFilterChange` | Fired with the new selection, or null when the filter is cleared.            | `CustomEvent<string>`                            |
| `rpMenuToggle`   | Fired when the tray opens or closes, so a consumer can coordinate two menus. | `CustomEvent<{ label: string; open: boolean; }>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
