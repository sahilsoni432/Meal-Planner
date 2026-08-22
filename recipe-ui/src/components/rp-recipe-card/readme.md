# rp-recipe-card



<!-- Auto Generated Below -->


## Overview

A recipe summary tile.

Takes only primitives, so it can be driven from plain HTML attributes with no
framework present. It has no idea where a recipe comes from or what a route is —
consumers inject navigation through the `actions` slot.

## Properties

| Property                   | Attribute      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Type      | Default     |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `area`                     | `area`         | Cuisine or region, shown as a second meta pill when present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `string`  | `undefined` |
| `category`                 | `category`     | Category label shown under the heading.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `string`  | `undefined` |
| `favorite`                 | `favorite`     | Whether this recipe is currently a favorite. Reflected for CSS hooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `boolean` | `false`     |
| `href`                     | `href`         | Destination for the whole card.  Given one, the card renders a link that covers its full area, so the tile behaves the way a card is expected to: clicking anywhere opens the recipe. The favorite button and anything in the `actions` slot sit above it and keep their own behaviour.  This is still a plain URL, not route knowledge — the component neither builds it nor knows what it points at, so a consumer with no router can pass an ordinary href. Omitting it leaves the card inert, which is what the planner picker wants. | `string`  | `undefined` |
| `hrefLabel`                | `href-label`   | Accessible name for that link. Defaults to the recipe title, which is what a link covering a whole card should announce.                                                                                                                                                                                                                                                                                                                                                                                                                  | `string`  | `undefined` |
| `image`                    | `image`        | Absolute URL of the recipe image.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `string`  | `undefined` |
| `minutes`                  | `minutes`      | Preparation time in minutes, shown as a meta pill when present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `number`  | `undefined` |
| `recipeId` _(required)_    | `recipe-id`    | Identifier echoed back in the toggle event so consumers know which card fired.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string`  | `undefined` |
| `recipeTitle` _(required)_ | `recipe-title` | Recipe name, rendered as the card heading.  Named `recipeTitle` rather than `title` because every HTMLElement already defines `title` on its prototype; shadowing it produces inconsistent behaviour across browsers.                                                                                                                                                                                                                                                                                                                     | `string`  | `undefined` |


## Events

| Event              | Description                                   | Type                                                    |
| ------------------ | --------------------------------------------- | ------------------------------------------------------- |
| `rpFavoriteToggle` | Fired when the favorite control is activated. | `CustomEvent<{ recipeId: string; favorite: boolean; }>` |


## Slots

| Slot        | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
|             | Badges rendered over the image, such as a category or source marker. |
| `"actions"` | Controls rendered in the footer, typically links to view or edit.    |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
