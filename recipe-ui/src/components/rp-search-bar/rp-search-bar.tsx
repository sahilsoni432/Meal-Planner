import { Component, Event, EventEmitter, Host, Prop, State, Watch, h } from '@stencil/core';

/**
 * A search input that emits on submit rather than on every keystroke.
 *
 * Per-keystroke events would race the consumer's own navigation: each one triggers a
 * server round trip, and a slow response can land after the user has typed more,
 * overwriting the field. Submitting explicitly keeps the interaction deterministic.
 */
@Component({
  tag: 'rp-search-bar',
  styleUrl: 'rp-search-bar.css',
  scoped: true,
})
export class SearchBar {
  /** Initial query text. Changing it externally resets the field. */
  @Prop() value = '';

  /** Placeholder shown when the field is empty. */
  @Prop() placeholder = 'Search recipes';

  /** Accessible label for the input. */
  @Prop() label = 'Search recipes';

  /**
   * Live field contents. Held internally so typing does not require a round trip
   * through the consumer, while `value` remains the externally controlled seed.
   */
  @State() private draft = '';

  /** Fired on submit with the trimmed query. */
  @Event({ eventName: 'rpSearch', bubbles: true, composed: true })
  rpSearch!: EventEmitter<string>;

  /** Fired when the user clears a non-empty field. */
  @Event({ eventName: 'rpClear', bubbles: true, composed: true })
  rpClear!: EventEmitter<void>;

  @Watch('value')
  onValueChange(next: string) {
    this.draft = next ?? '';
  }

  componentWillLoad() {
    this.draft = this.value ?? '';
  }

  private onSubmit = (event: Event) => {
    // The host page owns navigation, so the native GET submission must not fire.
    event.preventDefault();
    this.rpSearch.emit(this.draft.trim());
  };

  private onInput = (event: Event) => {
    this.draft = (event.target as HTMLInputElement).value;
  };

  private onClear = () => {
    this.draft = '';
    this.rpClear.emit();
  };

  render() {
    return (
      <Host>
        <form class="bar" role="search" onSubmit={this.onSubmit}>
          <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>

          <input
            type="search"
            class="field"
            value={this.draft}
            placeholder={this.placeholder}
            aria-label={this.label}
            onInput={this.onInput}
          />

          {this.draft && (
            <button type="button" class="clear" onClick={this.onClear} aria-label="Clear search">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}

          {/*
            The label collapses to an icon on a narrow viewport to give the field room for
            its placeholder, so the accessible name is stated explicitly rather than left
            to the visible text.
          */}
          <button type="submit" class="submit" aria-label="Search">
            <span class="submit-text">Search</span>
            <svg class="submit-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
          </button>
        </form>
      </Host>
    );
  }
}
