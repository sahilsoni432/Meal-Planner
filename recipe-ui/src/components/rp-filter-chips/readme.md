# rp-filter-chips



<!-- Auto Generated Below -->


## Overview

A single-select row of filter chips.

Selecting the active chip clears the filter, so the event detail is nullable —
consumers translate null into "remove this search param".

## Properties

| Property   | Attribute  | Description                                                                                                                                                                              | Type       | Default    |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| `label`    | `label`    | Accessible label for the group.                                                                                                                                                          | `string`   | `'Filter'` |
| `options`  | --         | Available filter values.  An array has no attribute representation, so this must be assigned as a DOM property. Frameworks that set properties on custom elements do this automatically. | `string[]` | `[]`       |
| `selected` | `selected` | Currently active value, or null when no filter is applied.                                                                                                                               | `string`   | `null`     |


## Events

| Event            | Description                                                       | Type                  |
| ---------------- | ----------------------------------------------------------------- | --------------------- |
| `rpFilterChange` | Fired with the new selection, or null when the filter is cleared. | `CustomEvent<string>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
