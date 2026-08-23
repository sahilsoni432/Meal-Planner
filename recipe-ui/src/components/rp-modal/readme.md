# rp-modal



<!-- Auto Generated Below -->


## Overview

A modal dialog with a focus trap.

Escape and focus containment are handled here rather than left to consumers, because
getting them wrong is the usual reason a hand-rolled modal is inaccessible.

## Properties

| Property  | Attribute | Description                                       | Type      | Default |
| --------- | --------- | ------------------------------------------------- | --------- | ------- |
| `heading` | `heading` | Dialog heading, also used as its accessible name. | `string`  | `''`    |
| `open`    | `open`    | Whether the dialog is visible.                    | `boolean` | `false` |


## Events

| Event     | Description                                                                             | Type                |
| --------- | --------------------------------------------------------------------------------------- | ------------------- |
| `rpClose` | Fired when the user dismisses the dialog via Escape, the backdrop, or the close button. | `CustomEvent<void>` |


## Methods

### `focusFirstField() => Promise<void>`

Moves focus to the first focusable control inside the dialog.

Exposed as a method because "move focus now" is a one-shot action with no state to
represent; a prop would have to be toggled and reset to fire it twice.

#### Returns

Type: `Promise<void>`




## Slots

| Slot       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
|            | Dialog body.                                                   |
| `"footer"` | Action row pinned to the bottom, typically confirm and cancel. |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
