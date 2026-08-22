import { Component, Host, Prop, h } from '@stencil/core';

/**
 * A measure-and-name ingredient table.
 *
 * @slot heading - Replaces the default heading.
 * @slot - Footnote content rendered beneath the list, such as a serving count.
 */
@Component({
  tag: 'rp-ingredient-list',
  styleUrl: 'rp-ingredient-list.css',
  scoped: true,
})
export class IngredientList {
  /** Ingredients to display. Must be assigned as a DOM property, not an attribute. */
  @Prop() items: Array<{ name: string; measure: string }> = [];

  render() {
    const items = Array.isArray(this.items) ? this.items : [];

    return (
      <Host>
        <section class="wrap">
          <slot name="heading">
            <h2 class="heading">Ingredients</h2>
          </slot>

          {items.length === 0 ? (
            <p class="empty">No ingredients listed for this recipe.</p>
          ) : (
            <ul class="list">
              {items.map((item, index) => (
                // Ingredient names repeat within a recipe (for example, oil listed twice
                // with different measures), so the index is part of the identity.
                <li class="row" key={`${item.name}-${index}`}>
                  <span class="name">{item.name}</span>
                  <span class="measure">{item.measure}</span>
                </li>
              ))}
            </ul>
          )}

          <div class="note">
            <slot />
          </div>
        </section>
      </Host>
    );
  }
}
