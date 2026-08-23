import { Component, Event, EventEmitter, Host, Prop, h } from '@stencil/core';

/**
 * A single-select row of filter chips.
 *
 * Selecting the active chip clears the filter, so the event detail is nullable —
 * consumers translate null into "remove this search param".
 */
@Component({
  tag: 'rp-filter-chips',
  styleUrl: 'rp-filter-chips.css',
  scoped: true,
})
export class FilterChips {
  /**
   * Available filter values.
   *
   * An array has no attribute representation, so this must be assigned as a DOM
   * property. Frameworks that set properties on custom elements do this automatically.
   */
  @Prop() options: string[] = [];

  /** Currently active value, or null when no filter is applied. */
  @Prop() selected: string | null = null;

  /** Accessible label for the group. */
  @Prop() label = 'Filter';

  /** Fired with the new selection, or null when the filter is cleared. */
  @Event({ eventName: 'rpFilterChange', bubbles: true, composed: true })
  rpFilterChange!: EventEmitter<string | null>;

  private select(option: string) {
    this.rpFilterChange.emit(this.selected === option ? null : option);
  }

  render() {
    // A string prop arriving from an HTML attribute would be unusable; tolerate it so
    // the component behaves predictably in a plain .html page.
    const options = Array.isArray(this.options) ? this.options : [];

    return (
      <Host>
        <div class="chips" role="group" aria-label={this.label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              class={{ chip: true, 'is-selected': this.selected === option }}
              aria-pressed={String(this.selected === option)}
              onClick={() => this.select(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </Host>
    );
  }
}
