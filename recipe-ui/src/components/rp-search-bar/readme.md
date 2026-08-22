# rp-search-bar



<!-- Auto Generated Below -->


## Overview

A search input that emits on submit rather than on every keystroke.

Per-keystroke events would race the consumer's own navigation: each one triggers a
server round trip, and a slow response can land after the user has typed more,
overwriting the field. Submitting explicitly keeps the interaction deterministic.

## Properties

| Property      | Attribute     | Description                                                  | Type     | Default            |
| ------------- | ------------- | ------------------------------------------------------------ | -------- | ------------------ |
| `label`       | `label`       | Accessible label for the input.                              | `string` | `'Search recipes'` |
| `placeholder` | `placeholder` | Placeholder shown when the field is empty.                   | `string` | `'Search recipes'` |
| `value`       | `value`       | Initial query text. Changing it externally resets the field. | `string` | `''`               |


## Events

| Event      | Description                                   | Type                  |
| ---------- | --------------------------------------------- | --------------------- |
| `rpClear`  | Fired when the user clears a non-empty field. | `CustomEvent<void>`   |
| `rpSearch` | Fired on submit with the trimmed query.       | `CustomEvent<string>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
