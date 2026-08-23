import { Component, Element, Event, EventEmitter, Host, Listen, Method, Prop, State, Watch, h } from '@stencil/core';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Movement in CSS pixels that separates a tap on an option from a scroll of the list.
 *
 * Below it the finger was choosing; above it, it was dragging the list and must not select
 * whatever it happens to be over when it lifts.
 */
const DRAG_SLOP = 10;

/**
 * A single-select control with a styled option list.
 *
 * A native `<select>` renders its dropdown as an operating-system panel: square corners, a
 * blue system highlight, and platform typography. None of that is reachable from CSS —
 * `option` accepts a colour and a font at best, and the panel itself accepts nothing — so
 * a native control can never match a designed interface once it is open. On a small screen
 * the panel also breaks out of any dialog it sits in, because it is not part of the page.
 *
 * This renders the list as ordinary elements instead, which is what makes it styleable,
 * and reimplements the keyboard behaviour the native control would have provided:
 * Up/Down/Home/End to move, Enter or Space to commit, Escape to dismiss, and typing a few
 * characters to jump. The trigger carries `role="combobox"` and the list `role="listbox"`,
 * so assistive technology sees the same control it would have seen before.
 */
@Component({
  tag: 'rp-select',
  styleUrl: 'rp-select.css',
  scoped: true,
})
export class Select {
  @Element() el!: HTMLElement;

  /** Options to choose from. An array has no attribute form; assign it as a property. */
  @Prop() options: SelectOption[] = [];

  /** Currently selected value. */
  @Prop({ mutable: true }) value = '';

  /** Accessible name, used when no external label is associated. */
  @Prop() label = '';

  /** Shown on the trigger when nothing is selected. */
  @Prop() placeholder = 'Choose…';

  /** Whether the list is open. Reflected so a consumer can style the open state. */
  @Prop({ mutable: true, reflect: true }) open = false;

  /** Disables the control. */
  @Prop({ reflect: true }) disabled = false;

  /**
   * Renders a smaller trigger, for a control sitting in a narrow column.
   *
   * Reflected so the stylesheet can select on it. The list keeps the full type size — it
   * is an overlay and has room even where the trigger does not.
   */
  @Prop({ reflect: true }) compact = false;

  /**
   * Set when the list opens upward because there is more room above the trigger.
   *
   * A prop rather than internal state so it reflects to an attribute the stylesheet can
   * select on; it is written by the component, not by a consumer.
   */
  @Prop({ mutable: true, reflect: true, attribute: 'drop-up' }) dropUp = false;

  /** Index under keyboard focus while the list is open. */
  @State() private activeIndex = -1;

  /** Fired when a value is chosen. */
  @Event({ eventName: 'rpSelectChange', bubbles: true, composed: true })
  rpSelectChange!: EventEmitter<string>;

  private triggerEl?: HTMLButtonElement;
  private listEl?: HTMLElement;

  /**
   * The option a finger is currently resting on, and where it landed.
   *
   * Held between `pointerdown` and `pointerup` so the release can tell a tap from a scroll
   * by how far the finger travelled. Not `@State` — it drives no rendering, and making it
   * reactive would re-render the list on every press.
   */
  private pressedOption: { value: string; x: number; y: number } | null = null;

  /** Buffer for type-ahead, cleared after a pause, matching native select behaviour. */
  private typeBuffer = '';
  private typeTimer?: ReturnType<typeof setTimeout>;

  @Watch('open')
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      window.removeEventListener('resize', this.position);
      window.removeEventListener('scroll', this.onAncestorScroll, true);

      // Discard the measurement rather than carry it into the next open, where the list
      // may be a different length or the trigger somewhere else on the page.
      this.el.style.removeProperty('--rp-select-max-height');
      this.dropUp = false;
      return;
    }

    this.activeIndex = Math.max(0, this.normalizedOptions.findIndex((o) => o.value === this.value));

    // The list renders in response to the state change, so measuring waits two frames:
    // one for Stencil to render it, one for the layout that render produced.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.position();
        this.scrollActiveIntoView();
      }),
    );

    // A list opened near the bottom of the window has to re-measure if the page moves
    // under it. `capture` catches scrolling in any ancestor, not just the window.
    window.addEventListener('resize', this.position);
    window.addEventListener('scroll', this.onAncestorScroll, true);
  }

  /**
   * Re-measures when the options change while the list is open.
   *
   * The room a list needs depends on how many there are, so a list that shrinks would
   * otherwise keep the taller one's placement — including an upward flip no longer
   * warranted by the space available.
   */
  @Watch('options')
  onOptionsChange() {
    if (!this.open) return;

    // Two frames: the first lets Stencil re-render the list, the second measures the
    // element that render produced. Measuring on the first would read the previous
    // list's height, which is the state this exists to correct.
    requestAnimationFrame(() => requestAnimationFrame(() => this.position()));
  }

  disconnectedCallback() {
    clearTimeout(this.typeTimer);
    window.removeEventListener('resize', this.position);
    window.removeEventListener('scroll', this.onAncestorScroll, true);
  }

  /**
   * Re-measures when something *behind* the list scrolls.
   *
   * Bound with `capture` so an ancestor's scrolling is caught, which means the list's own
   * scrolling arrives here too — and repositioning on that fights the user, resetting the
   * height mid-gesture and making the list appear not to scroll at all. Scroll events from
   * within the component are therefore ignored.
   */
  private onAncestorScroll = (event: Event) => {
    // The list's own scrolling must not trigger a reposition: re-measuring mid-gesture
    // resets the height and fights the user. Anything else moving behind it must.
    if (event.target === this.listEl) return;
    this.position();
  };

  /**
   * Sizes the list to the space actually available and flips it upward when there is more
   * room above.
   *
   * Without this a list opened low in the window runs past the bottom edge, where it is
   * unreachable — and inside a dialog it is clipped by the dialog's own bounds.
   */
  private position = () => {
    if (!this.open || !this.triggerEl) return;

    const rect = this.triggerEl.getBoundingClientRect();
    const gap = 8;
    const margin = 12;

    /**
     * The list is bounded by whichever is tighter: the window, or the nearest ancestor
     * that clips. Inside a dialog the dialog is the real limit — it keeps its own
     * `overflow: hidden` for its rounded corners, so a list sized only to the viewport
     * would be cut off at the dialog's edge with no way to reach the rest.
     */
    const clip = this.clippingBounds();
    const bottomLimit = Math.min(window.innerHeight, clip.bottom);
    const topLimit = Math.max(0, clip.top);

    const below = bottomLimit - rect.bottom - gap - margin;
    const above = rect.top - topLimit - gap - margin;

    /**
     * Downward is the default and the expectation; flipping is a last resort.
     *
     * The test is against what the list actually needs, measured from the rendered
     * element rather than estimated from the option count. The count is wrong at exactly
     * the moment it matters: when the options change while open, this runs before Stencil
     * has re-rendered, so a list that just shrank would still be measured as the long one
     * and would flip over the content above it with room to spare below.
     *
     * A fixed threshold has the same failure in a different form — it flips whenever the
     * space below is merely smallish, rather than genuinely insufficient.
     */
    // `scrollHeight` is the content's full height even when `max-height` is capping the
    // box, which is exactly the "how much does it want" figure needed here.
    const natural = this.listEl
      ? Math.min(260, this.listEl.scrollHeight)
      : Math.min(260, this.normalizedOptions.length * 40 + 8);

    const dropUp = below < natural && above > below;
    this.dropUp = dropUp;

    const space = Math.max(96, Math.floor(dropUp ? above : below));
    this.el.style.setProperty('--rp-select-max-height', `${space}px`);
  };

  /**
   * Bounds of the nearest ancestor that would actually clip the list, or the viewport.
   *
   * Ancestors whose overflow is visible are skipped — including ones a host has released
   * precisely so this list can overlay them, as `rp-modal` does with its body. Taking the
   * first such ancestor regardless would measure a box the list is allowed to escape, and
   * report far less room than there is.
   */
  private clippingBounds(): { top: number; bottom: number } {
    let el = this.el.parentElement;

    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const clips = style.overflow !== 'visible' && style.overflowY !== 'visible';
      if (clips) {
        const box = el.getBoundingClientRect();
        if (box.height > 0) return { top: box.top, bottom: box.bottom };
      }
      el = el.parentElement;
    }

    return { top: 0, bottom: window.innerHeight };
  }

  /** Moves focus to the trigger, so a consumer can direct attention here. */
  @Method()
  async focusControl(): Promise<void> {
    this.triggerEl?.focus();
  }

  @Listen('pointerdown', { target: 'document' })
  onDocumentPointerDown(event: PointerEvent) {
    if (!this.open) return;
    if (!this.el.contains(event.target as Node)) this.open = false;
  }

  private get normalizedOptions(): SelectOption[] {
    return Array.isArray(this.options) ? this.options : [];
  }

  private get selectedOption(): SelectOption | undefined {
    return this.normalizedOptions.find((option) => option.value === this.value);
  }

  private choose(option: SelectOption, from?: { x: number; y: number }) {
    this.value = option.value;
    this.open = false;
    this.rpSelectChange.emit(option.value);
    this.triggerEl?.focus();

    // Only a touch leaves a synthetic click behind; a mouse or the keyboard does not.
    if (from) this.swallowGhostClick(from.x, from.y);
  }

  /**
   * Absorbs the synthetic click a touch leaves behind, and only that one.
   *
   * A selection is committed on `pointerdown`, which closes the list — but a touch still
   * produces a `click` at those same coordinates a moment later, and by then whatever was
   * *underneath* the list is there to receive it. In the planner's dialog that is the
   * Cancel button sitting directly behind the options, so choosing the second recipe
   * cancelled the dialog instead of selecting anything.
   *
   * The guard is deliberately narrow. Swallowing the next click anywhere is too blunt — it
   * eats a legitimate press on a backdrop or a neighbouring button and breaks the dialog in
   * a different way. Only a click landing within a few pixels of the point just released,
   * and only within the window in which a synthetic click can arrive, is a ghost.
   */
  private swallowGhostClick(x: number, y: number) {
    const absorb = (event: MouseEvent) => {
      // A real click elsewhere is the user's, and must pass through untouched.
      if (Math.hypot(event.clientX - x, event.clientY - y) > 24) return;

      event.preventDefault();
      event.stopPropagation();
      cleanup();
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', absorb, true);
    };

    document.addEventListener('click', absorb, true);
    // Comfortably past the ~300ms a touch takes to synthesise its click.
    const timer = window.setTimeout(cleanup, 500);
  }

  private scrollActiveIntoView() {
    const active = this.listEl?.querySelector('.option.is-active');
    active?.scrollIntoView({ block: 'nearest' });
  }

  private move(delta: number) {
    const options = this.normalizedOptions;
    if (options.length === 0) return;

    const next = this.activeIndex + delta;
    this.activeIndex = next < 0 ? options.length - 1 : next % options.length;
    requestAnimationFrame(() => this.scrollActiveIntoView());
  }

  /** Jumps to the first option starting with what has been typed. */
  private typeAhead(character: string) {
    clearTimeout(this.typeTimer);
    this.typeBuffer += character.toLowerCase();
    this.typeTimer = setTimeout(() => (this.typeBuffer = ''), 600);

    const index = this.normalizedOptions.findIndex((option) =>
      option.label.toLowerCase().startsWith(this.typeBuffer),
    );
    if (index === -1) return;

    if (this.open) {
      this.activeIndex = index;
      requestAnimationFrame(() => this.scrollActiveIntoView());
    } else {
      this.choose(this.normalizedOptions[index]);
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open) this.open = true;
        else this.move(1);
        return;

      case 'ArrowUp':
        event.preventDefault();
        if (!this.open) this.open = true;
        else this.move(-1);
        return;

      case 'Home':
        if (!this.open) return;
        event.preventDefault();
        this.activeIndex = 0;
        requestAnimationFrame(() => this.scrollActiveIntoView());
        return;

      case 'End':
        if (!this.open) return;
        event.preventDefault();
        this.activeIndex = this.normalizedOptions.length - 1;
        requestAnimationFrame(() => this.scrollActiveIntoView());
        return;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open) {
          this.open = true;
        } else if (this.activeIndex >= 0) {
          this.choose(this.normalizedOptions[this.activeIndex]);
        }
        return;

      case 'Escape':
        if (!this.open) return;
        event.preventDefault();
        this.open = false;
        return;

      case 'Tab':
        // Tabbing away commits nothing and closes, as a native select does.
        this.open = false;
        return;

      default:
        // Single printable characters drive type-ahead; modifiers are left alone.
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          this.typeAhead(event.key);
        }
    }
  };

  render() {
    const options = this.normalizedOptions;
    const selected = this.selectedOption;
    const listId = 'rp-select-list';
    const activeId = this.activeIndex >= 0 ? `rp-select-option-${this.activeIndex}` : undefined;

    return (
      <Host>
        <div class="wrap">
          <button
            type="button"
            class="trigger"
            ref={(element) => (this.triggerEl = element)}
            disabled={this.disabled}
            role="combobox"
            aria-expanded={this.open ? 'true' : 'false'}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-label={this.label || undefined}
            aria-activedescendant={this.open ? activeId : undefined}
            onKeyDown={this.onKeyDown}
            /*
              Toggled on pointerdown rather than click so one press produces one state
              change — the document listener that dismisses an open control runs on the
              same gesture, and splitting the two across events makes them race.
            */
            onPointerDown={(event) => {
              if (this.disabled) return;
              event.preventDefault();
              this.triggerEl?.focus();
              this.open = !this.open;
            }}
          >
            <span class={{ 'trigger-value': true, 'is-placeholder': !selected }}>
              {selected?.label ?? this.placeholder}
            </span>
            <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {this.open && (
            <div
              class="list"
              id={listId}
              role="listbox"
              tabindex={-1}
              aria-label={this.label || undefined}
              ref={(element) => (this.listEl = element)}
            >
              {options.length === 0 ? (
                <p class="empty">No options</p>
              ) : (
                options.map((option, index) => (
                  <button
                    key={option.value}
                    id={`rp-select-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={option.value === this.value ? 'true' : 'false'}
                    class={{
                      option: true,
                      'is-selected': option.value === this.value,
                      'is-active': index === this.activeIndex,
                    }}
                    onPointerDown={(event) => {
                      /**
                       * A mouse commits on the press, because a press with a mouse is
                       * unambiguous and `preventDefault` here is what keeps focus on the
                       * trigger rather than moving it to the option.
                       *
                       * A touch cannot commit yet: the same press is also how the list is
                       * scrolled, and committing on contact selected whichever option the
                       * finger happened to land on the moment a scroll began. Touch is
                       * resolved on release instead, by the handlers below.
                       */
                      if (event.pointerType !== 'mouse') {
                        this.pressedOption = {
                          value: option.value,
                          x: event.clientX,
                          y: event.clientY,
                        };
                        return;
                      }

                      event.preventDefault();
                      this.choose(option);
                    }}
                    onPointerUp={(event) => {
                      if (event.pointerType === 'mouse') return;

                      const pressed = this.pressedOption;
                      this.pressedOption = null;
                      if (!pressed || pressed.value !== option.value) return;

                      /**
                       * Only a finger that stayed put was choosing; one that travelled was
                       * scrolling the list, and must not select whatever it ends up over.
                       */
                      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
                      if (moved > DRAG_SLOP) return;

                      this.choose(option, { x: event.clientX, y: event.clientY });
                    }}
                    onPointerCancel={() => (this.pressedOption = null)}
                    onMouseEnter={() => (this.activeIndex = index)}
                  >
                    <span class="option-text">{option.label}</span>
                    {option.value === this.value && (
                      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Host>
    );
  }
}
