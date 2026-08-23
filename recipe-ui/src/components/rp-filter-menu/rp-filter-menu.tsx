import { Component, Element, Event, EventEmitter, Host, Listen, Prop, State, Watch, h } from '@stencil/core';

/**
 * A collapsed filter control: a pill that opens a tray of options.
 *
 * `rp-filter-chips` renders every option at once, which is right for a handful and wrong
 * for the ~30 categories and cuisines a recipe app has — the chips fill the top of the
 * page before any content appears. This collapses the same single-select behaviour behind
 * one trigger and adds a search field, so a long list stays usable.
 *
 * It emits the same `rpFilterChange` as `rp-filter-chips`, including `null` to clear, so
 * a consumer can swap one for the other without touching its handler.
 */
@Component({
  tag: 'rp-filter-menu',
  styleUrl: 'rp-filter-menu.css',
  scoped: true,
})
export class FilterMenu {
  @Element() el!: HTMLElement;

  /** Text on the trigger, e.g. "Category". */
  @Prop() label = 'Filter';

  /**
   * Available values. An array has no attribute representation, so this must be assigned
   * as a DOM property.
   */
  @Prop() options: string[] = [];

  /** Currently active value, or null when no filter is applied. */
  @Prop() selected: string | null = null;

  /** Placeholder for the in-tray search field. */
  @Prop() searchPlaceholder = 'Search…';

  /**
   * Hides the search field. Below roughly a dozen options the field costs more attention
   * than the scanning it saves.
   */
  @Prop() searchable = true;

  /** Whether the tray is open. Reflected so a consumer can style the open state. */
  @Prop({ mutable: true, reflect: true }) open = false;

  @State() private filterText = '';

  /** Index of the option under keyboard focus, or -1 when none is. */
  @State() private activeIndex = -1;

  /** Fired with the new selection, or null when the filter is cleared. */
  @Event({ eventName: 'rpFilterChange', bubbles: true, composed: true })
  rpFilterChange!: EventEmitter<string | null>;

  /** Fired when the tray opens or closes, so a consumer can coordinate two menus. */
  @Event({ eventName: 'rpMenuToggle', bubbles: true, composed: true })
  rpMenuToggle!: EventEmitter<{ label: string; open: boolean }>;

  private triggerEl?: HTMLButtonElement;
  private searchEl?: HTMLInputElement;

  @Watch('open')
  onOpenChange(isOpen: boolean) {
    this.rpMenuToggle.emit({ label: this.label, open: isOpen });

    if (isOpen) {
      this.filterText = '';
      this.activeIndex = -1;
      // The tray renders in the same tick, so focus has to wait for it to exist.
      requestAnimationFrame(() => {
        if (this.searchable) this.searchEl?.focus();
      });
    }
  }

  /**
   * Dismisses on a press outside the component.
   *
   * Bound to the document rather than to a backdrop element: a backdrop would either
   * block the page behind it or need to be transparent and full-screen, and both make
   * two open menus fight over which one is on top.
   */
  @Listen('pointerdown', { target: 'document' })
  onDocumentPointerDown(event: PointerEvent) {
    if (!this.open) return;
    if (!this.el.contains(event.target as Node)) this.open = false;
  }

  @Listen('keydown', { target: 'document' })
  onDocumentKeydown(event: KeyboardEvent) {
    if (!this.open || event.key !== 'Escape') return;

    event.preventDefault();
    this.open = false;
    this.triggerEl?.focus();
  }

  private get visibleOptions(): string[] {
    const all = Array.isArray(this.options) ? this.options : [];
    const term = this.filterText.trim().toLowerCase();
    return term ? all.filter((option) => option.toLowerCase().includes(term)) : all;
  }

  private choose = (option: string | null) => {
    this.rpFilterChange.emit(option);
    this.open = false;
    this.triggerEl?.focus();
  };

  /** Arrow keys move through the list; Enter commits whatever is highlighted. */
  private onTrayKeydown = (event: KeyboardEvent) => {
    const options = this.visibleOptions;
    if (options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = this.activeIndex + step;
      this.activeIndex = next < 0 ? options.length - 1 : next % options.length;
      return;
    }

    if (event.key === 'Enter' && this.activeIndex >= 0) {
      event.preventDefault();
      this.choose(options[this.activeIndex]);
    }
  };

  render() {
    const options = this.visibleOptions;
    const hasSelection = Boolean(this.selected);
    const trayId = `rp-filter-tray-${this.label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
      <Host>
        <div class="wrap">
          <button
            type="button"
            class={{ trigger: true, 'is-active': hasSelection }}
            ref={(element) => (this.triggerEl = element)}
            /*
              Toggled on pointerdown, not click. A sibling menu dismisses itself on the
              document's pointerdown from this same gesture; if this one waited for the
              click, the two halves of one press would land as two separate updates and
              whichever ran last would decide the state. Handling both on pointerdown
              makes one press produce exactly one change.
            */
            onPointerDown={(event) => {
              // Suppressed so the press does not steal focus from the tray's search field
              // as it mounts; the trigger is focused explicitly instead, which keeps
              // Escape able to return focus here.
              event.preventDefault();
              this.triggerEl?.focus();
              this.open = !this.open;
            }}
            /* Enter and Space on a focused button raise click without pointerdown. */
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              this.open = !this.open;
            }}
            aria-expanded={this.open ? 'true' : 'false'}
            aria-haspopup="listbox"
            aria-controls={trayId}
          >
            <span class="trigger-label">{this.label}</span>

            {hasSelection && <span class="trigger-value">{this.selected}</span>}

            <svg class="chevron" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/*
            The clear control sits outside the trigger rather than inside it. A button
            nested in a button is invalid HTML and the inner one's click would not be
            reachable by keyboard.
          */}
          {hasSelection && (
            <button
              type="button"
              class="clear"
              onClick={() => this.choose(null)}
              aria-label={`Clear ${this.label.toLowerCase()} filter`}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}

          {this.open && (
            <div class="tray" id={trayId} role="listbox" aria-label={this.label} onKeyDown={this.onTrayKeydown}>
              {this.searchable && (
                <div class="search">
                  <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.6-3.6" />
                  </svg>
                  <input
                    type="text"
                    class="search-field"
                    ref={(element) => (this.searchEl = element)}
                    value={this.filterText}
                    placeholder={this.searchPlaceholder}
                    aria-label={`Search ${this.label.toLowerCase()} options`}
                    onInput={(event) => {
                      this.filterText = (event.target as HTMLInputElement).value;
                      this.activeIndex = -1;
                    }}
                  />
                </div>
              )}

              <div class="options">
                {options.length === 0 ? (
                  <p class="no-match">No matches</p>
                ) : (
                  options.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={this.selected === option ? 'true' : 'false'}
                      class={{
                        option: true,
                        'is-selected': this.selected === option,
                        'is-active': this.activeIndex === index,
                      }}
                      onClick={() => this.choose(option)}
                      onMouseEnter={() => (this.activeIndex = index)}
                    >
                      <span class="option-text">{option}</span>
                      {this.selected === option && (
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>

              {hasSelection && (
                <div class="tray-foot">
                  <button type="button" class="reset" onClick={() => this.choose(null)}>
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Host>
    );
  }
}
