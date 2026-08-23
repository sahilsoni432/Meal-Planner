import { Component, Element, Event, EventEmitter, Host, Method, Prop, Watch, h } from '@stencil/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog with a focus trap.
 *
 * Escape and focus containment are handled here rather than left to consumers, because
 * getting them wrong is the usual reason a hand-rolled modal is inaccessible.
 *
 * @slot - Dialog body.
 * @slot footer - Action row pinned to the bottom, typically confirm and cancel.
 */
@Component({
  tag: 'rp-modal',
  styleUrl: 'rp-modal.css',
  scoped: true,
})
export class Modal {
  @Element() el!: HTMLElement;

  /** Whether the dialog is visible. */
  @Prop({ reflect: true }) open = false;

  /** Dialog heading, also used as its accessible name. */
  @Prop() heading = '';

  /** Fired when the user dismisses the dialog via Escape, the backdrop, or the close button. */
  @Event({ eventName: 'rpClose', bubbles: true, composed: true })
  rpClose!: EventEmitter<void>;

  private previouslyFocused: HTMLElement | null = null;

  /** Page offset captured while the background is locked, restored when it is released. */
  private lockedScrollY = 0;

  @Watch('open')
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      this.previouslyFocused = document.activeElement as HTMLElement;
      document.addEventListener('keydown', this.onKeydown);
      this.lockBackground();
      // The dialog content renders in the same tick, so defer focus until it exists.
      requestAnimationFrame(() => this.focusFirstField());
    } else {
      document.removeEventListener('keydown', this.onKeydown);
      this.unlockBackground();
      this.previouslyFocused?.focus();
      this.previouslyFocused = null;
    }
  }

  /**
   * Freezes the page behind the dialog.
   *
   * Without this the page is still scrollable underneath, and on a phone that is what a
   * touch drag inside the dialog ends up moving: dragging a long option list scrolled the
   * page behind it rather than the list, so the options below the fold were unreachable.
   * `overscroll-behavior` on the list is not enough on its own — it stops a scroll
   * *chaining* outward once the list ends, but not the page claiming the gesture.
   *
   * `position: fixed` rather than `overflow: hidden`, because iOS Safari ignores the
   * latter on `body`. Fixing the body collapses it to the top of the document, so the
   * offset is captured and re-applied as a negative inset, then restored on release —
   * otherwise closing the dialog would jump the page back to the top.
   */
  private lockBackground() {
    if (document.body.dataset.rpModalLock) return; // A nested dialog must not re-lock.

    this.lockedScrollY = window.scrollY;
    document.body.dataset.rpModalLock = 'true';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lockedScrollY}px`;
    document.body.style.insetInline = '0';
    // The scrollbar disappears with the fixed body; reserving its width stops the page
    // shifting sideways as the dialog opens.
    document.body.style.overflowY = 'scroll';
  }

  private unlockBackground() {
    if (!document.body.dataset.rpModalLock) return;

    delete document.body.dataset.rpModalLock;
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('inset-inline');
    document.body.style.removeProperty('overflow-y');
    window.scrollTo(0, this.lockedScrollY);
  }

  componentDidLoad() {
    // A dialog can be mounted already open, in which case @Watch never fires.
    if (this.open) this.onOpenChange(true);
  }

  disconnectedCallback() {
    // Without this, every mount of a page containing a modal leaks a document listener.
    document.removeEventListener('keydown', this.onKeydown);
    // A dialog unmounted while open would otherwise leave the page frozen with no way
    // back — navigating away with one on screen is the ordinary way that happens.
    this.unlockBackground();
  }

  /**
   * Moves focus to the first focusable control inside the dialog.
   *
   * Exposed as a method because "move focus now" is a one-shot action with no state to
   * represent; a prop would have to be toggled and reset to fire it twice.
   */
  @Method()
  async focusFirstField(): Promise<void> {
    const first = this.el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }

  private onKeydown = (event: KeyboardEvent) => {
    if (!this.open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.rpClose.emit();
      return;
    }

    if (event.key === 'Tab') this.trapFocus(event);
  };

  private trapFocus(event: KeyboardEvent) {
    const focusable = Array.from(this.el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    // Wrap in both directions so Tab never escapes the dialog into the page behind it.
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private onBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) this.rpClose.emit();
  };

  render() {
    if (!this.open) return null;

    return (
      <Host>
        <div class="backdrop" onClick={this.onBackdropClick}>
          <div class="dialog" role="dialog" aria-modal="true" aria-label={this.heading}>
            <header class="head">
              <h2 class="heading">{this.heading}</h2>
              <button type="button" class="close" onClick={() => this.rpClose.emit()} aria-label="Close dialog">
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div class="body">
              <slot />
            </div>

            <footer class="foot">
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </Host>
    );
  }
}
