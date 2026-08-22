import { Component, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';

/**
 * A recipe summary tile.
 *
 * Takes only primitives, so it can be driven from plain HTML attributes with no
 * framework present. It has no idea where a recipe comes from or what a route is —
 * consumers inject navigation through the `actions` slot.
 *
 * @slot - Badges rendered over the image, such as a category or source marker.
 * @slot actions - Controls rendered in the footer, typically links to view or edit.
 */
@Component({
  tag: 'rp-recipe-card',
  styleUrl: 'rp-recipe-card.css',
  scoped: true,
})
export class RecipeCard {
  @Element() el!: HTMLElement;

  /** Identifier echoed back in the toggle event so consumers know which card fired. */
  @Prop() recipeId!: string;

  /**
   * Recipe name, rendered as the card heading.
   *
   * Named `recipeTitle` rather than `title` because every HTMLElement already defines
   * `title` on its prototype; shadowing it produces inconsistent behaviour across browsers.
   */
  @Prop() recipeTitle!: string;

  /** Absolute URL of the recipe image. */
  @Prop() image?: string;

  /** Category label shown under the heading. */
  @Prop() category?: string;

  /**
   * Destination for the whole card.
   *
   * Given one, the card renders a link that covers its full area, so the tile behaves the
   * way a card is expected to: clicking anywhere opens the recipe. The favorite button and
   * anything in the `actions` slot sit above it and keep their own behaviour.
   *
   * This is still a plain URL, not route knowledge — the component neither builds it nor
   * knows what it points at, so a consumer with no router can pass an ordinary href.
   * Omitting it leaves the card inert, which is what the planner picker wants.
   */
  @Prop() href?: string;

  /**
   * Accessible name for that link. Defaults to the recipe title, which is what a link
   * covering a whole card should announce.
   */
  @Prop() hrefLabel?: string;

  /** Cuisine or region, shown as a second meta pill when present. */
  @Prop() area?: string;

  /** Preparation time in minutes, shown as a meta pill when present. */
  @Prop() minutes?: number;

  /** Whether this recipe is currently a favorite. Reflected for CSS hooks. */
  @Prop({ reflect: true }) favorite = false;

  /**
   * True between the image element being created and its load event.
   *
   * Drives the shimmer placeholder behind the image. Tracked in state rather than with a
   * CSS-only trick because a cached image can complete before this component ever renders,
   * and the load event would then never fire — `onLoad` plus the `complete` check in
   * `onImageRef` covers both orderings.
   */
  @State() private imageLoading = true;

  /** Set when the image URL fails, so a broken link falls back to the gradient. */
  @State() private imageFailed = false;

  /** Briefly true after a favorite toggle, driving the press animation. */
  @State() private pulsing = false;

  private pulseTimer?: ReturnType<typeof setTimeout>;

  /** Fired when the favorite control is activated. */
  @Event({ eventName: 'rpFavoriteToggle', bubbles: true, composed: true })
  rpFavoriteToggle!: EventEmitter<{ recipeId: string; favorite: boolean }>;

  disconnectedCallback() {
    clearTimeout(this.pulseTimer);
  }

  private toggleFavorite = () => {
    this.pulsing = true;
    clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => (this.pulsing = false), 400);

    // Emits the intended next state. The consumer owns the data and decides whether
    // the change is applied, so this component never writes to its own prop.
    this.rpFavoriteToggle.emit({ recipeId: this.recipeId, favorite: !this.favorite });
  };

  private onImageRef = (element?: HTMLImageElement) => {
    // A browser-cached image is already complete by the time the ref runs, and its load
    // event fired before the listener was attached.
    if (element?.complete) this.imageLoading = false;
  };

  render() {
    // Normalized because a consumer that omits the attribute entirely leaves the prop
    // undefined, and `aria-pressed="undefined"` would be dropped from the DOM, leaving a
    // toggle button with no announced state.
    const isFavorite = this.favorite === true;
    const showImage = this.image && !this.imageFailed;

    return (
      <Host>
        <article class="card">
          <div class={{ media: true, 'is-loading': showImage && this.imageLoading }}>
            {showImage ? (
              <img
                src={this.image}
                alt=""
                loading="lazy"
                width="320"
                height="240"
                ref={this.onImageRef}
                onLoad={() => (this.imageLoading = false)}
                onError={() => (this.imageFailed = true)}
              />
            ) : (
              <div class="media-fallback" aria-hidden="true" />
            )}

            <div class="scrim" aria-hidden="true" />

            <div class="badges">
              <slot />
            </div>

            <button
              type="button"
              class={{ favorite: true, 'is-pulsing': this.pulsing }}
              onClick={this.toggleFavorite}
              aria-pressed={isFavorite ? 'true' : 'false'}
              aria-label={
                isFavorite
                  ? `Remove ${this.recipeTitle} from favorites`
                  : `Add ${this.recipeTitle} to favorites`
              }
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 21s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.3 12c-1.8 4.3-9.3 9-9.3 9z" />
              </svg>
            </button>
          </div>

          {/*
            One link, stretched over the card by CSS rather than wrapping it. Wrapping
            would put the favorite button and the slotted action links inside an anchor,
            which is invalid HTML and would make them unreachable by keyboard.
          */}
          {this.href && (
            <a class="cover-link" href={this.href}>
              <span class="sr-only">{this.hrefLabel ?? this.recipeTitle}</span>
            </a>
          )}

          <div class="body">
            <h3 class="title">{this.recipeTitle}</h3>

            <div class="meta">
              {this.category && <span class="pill pill-category">{this.category}</span>}
              {this.area && <span class="pill">{this.area}</span>}
              {this.minutes ? <span class="pill">{this.minutes} min</span> : null}
            </div>
          </div>

          <div class="actions">
            <slot name="actions" />
          </div>
        </article>
      </Host>
    );
  }
}
