import { Component, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';

export interface PlannedMeal {
  id: string;
  title: string;
}

/**
 * One day column of a weekly meal plan.
 *
 * Meals can be moved by dragging between columns or by choosing a day from the select on
 * each meal. Both paths emit the same `rpMoveMeal`, so a consumer handles one event and
 * gets both. The select is not a fallback that could be dropped later — it is the keyboard
 * and touch path, and dragging is the enhancement layered over it.
 *
 * @slot - Empty-state content shown when the day has no meals.
 */
@Component({
  tag: 'rp-day-slot',
  styleUrl: 'rp-day-slot.css',
  scoped: true,
})
export class DaySlot {
  @Element() el!: HTMLElement;

  /** Machine-readable day key, echoed in every event. Reflected so a pointer drag can
   * read the target column straight off the element it lands on. */
  @Prop({ reflect: true }) day!: string;

  /** Human-readable day name shown as the column heading. */
  @Prop() dayLabel = '';

  /** Meals planned for this day. Must be assigned as a DOM property. */
  @Prop() meals: PlannedMeal[] = [];

  /** All day keys, used to populate each meal's move target list. */
  @Prop() days: string[] = [];

  /**
   * Display names for the keys in `days`, as a key-to-label map.
   *
   * Without this the move control would offer raw keys like "mon". Optional, so a
   * consumer whose keys are already human-readable can leave it unset.
   */
  @Prop() dayLabels: Record<string, string> = {};

  @State() private normalized: PlannedMeal[] = [];

  /** True while a compatible meal is being dragged over this column. */
  @State() private dropActive = false;

  /** Id of the meal being dragged out of this column, dimmed at its origin. */
  @State() private draggingId: string | null = null;

  /**
   * Which input the user is actually using, which decides whether native HTML5
   * drag-and-drop is armed at all.
   *
   * It starts as `'unknown'` and is set by the first pointer event seen, rather than being
   * guessed from `navigator.maxTouchPoints` or a media query: a laptop with a touchscreen
   * answers yes to both while the person is using a mouse, and a tablet with a keyboard
   * case can be either from one moment to the next. Only an actual event knows.
   *
   * Until something is known, native dragging stays on — that is the mouse behaviour, and
   * a mouse cannot be detected any earlier than its first event either.
   */
  @State() private pointerKind: 'unknown' | 'mouse' | 'touch' = 'unknown';

  /**
   * Nested children fire dragleave as the pointer crosses them, so a boolean flag would
   * flicker off mid-column. Counting enter and leave pairs is what makes the state stable.
   */
  private dragDepth = 0;

  /**
   * Pointer-drag state, used on touch.
   *
   * HTML5 drag-and-drop is a mouse-only API — a touch never produces `dragstart`, so on a
   * phone or tablet the meals simply could not be dragged. Pointer events cover mouse,
   * touch, and pen from one code path, so this runs alongside the native drag rather than
   * replacing it: the native path keeps working where the browser provides it, and this
   * takes over where it does not.
   */
  private pointerDrag: {
    id: string;
    title: string;
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
  } | null = null;

  /** The floating copy that follows the finger, appended to the document while dragging. */
  private ghost: HTMLElement | null = null;

  /** The panel currently highlighted under the pointer, so it can be un-highlighted. */
  private hoveredPanel: Element | null = null;

  /** Movement in CSS pixels before a press becomes a drag rather than a tap or a scroll. */
  private static readonly DRAG_THRESHOLD = 8;

  /**
   * Movement tolerated during the long press before it is abandoned as a scroll.
   *
   * A finger resting on a card is never still: holding a phone one-handed produces several
   * pixels of drift, and a real device reports it. With only `DRAG_THRESHOLD` to go on,
   * that drift was read as a deliberate vertical swipe and the pending drag was discarded
   * — the user held, and nothing happened. Every platform's long press allows a slop
   * radius for exactly this reason; this is ours.
   */
  private static readonly HOLD_SLOP = 16;

  /**
   * How long a finger must rest on a meal before the press becomes a drag.
   *
   * A phone lays the week out as a single column, so the day you are dragging to is above
   * or below — the same axis as scrolling. Distance alone cannot separate the two
   * intentions on that axis, so time does: hold to drag, swipe to scroll. This is the
   * long-press convention every mobile reorder UI uses, and it is why the desktop path
   * needs no equivalent — there the axes already differ.
   */
  private static readonly LONG_PRESS_MS = 220;

  /** Distance from a viewport edge, in CSS pixels, within which a drag scrolls the page. */
  private static readonly EDGE_ZONE = 72;

  /** Peak scroll speed in CSS pixels per frame, reached at the very edge. */
  private static readonly EDGE_SPEED = 14;

  /** Pending long-press timer, cleared if the finger moves or lifts first. */
  private holdTimer: number | null = null;

  /** Auto-scroll frame handle, active only while a pointer drag is near an edge. */
  private edgeScrollFrame: number | null = null;

  /** Latest pointer position, read by the auto-scroll loop between pointer events. */
  private lastPoint = { x: 0, y: 0 };

  /** Fired when the user asks to add a meal to this day. */
  @Event({ eventName: 'rpAddMeal', bubbles: true, composed: true })
  rpAddMeal!: EventEmitter<string>;

  /** Fired when a meal is removed from this day. */
  @Event({ eventName: 'rpRemoveMeal', bubbles: true, composed: true })
  rpRemoveMeal!: EventEmitter<{ id: string; day: string }>;

  /** Fired when a meal is reassigned to a different day, by drag or by select. */
  @Event({ eventName: 'rpMoveMeal', bubbles: true, composed: true })
  rpMoveMeal!: EventEmitter<{ id: string; from: string; to: string }>;

  componentWillLoad() {
    this.normalized = Array.isArray(this.meals) ? this.meals : [];
  }

  componentWillUpdate() {
    // Recomputed before each render rather than in a @Watch, because the property can be
    // replaced before the element upgrades, which @Watch would miss.
    this.normalized = Array.isArray(this.meals) ? this.meals : [];
  }

  connectedCallback() {
    /**
     * Every column clears its own highlight when any drag anywhere ends.
     *
     * `dragleave` is not guaranteed: a drop, or a drag abandoned with Escape, can leave a
     * column highlighted with no further event coming to it. Listening for the global end
     * of the gesture is what makes the reset unconditional.
     */
    document.addEventListener('dragend', this.clearDragState);
    document.addEventListener('drop', this.clearDragState);
  }

  disconnectedCallback() {
    // A pointer drag registers listeners on `window` and appends a ghost to the body,
    // both of which would outlive the component if it unmounted mid-drag.
    this.endPointerDrag();
    document.removeEventListener('dragend', this.clearDragState);
    document.removeEventListener('drop', this.clearDragState);
  }

  private clearDragState = () => {
    this.dragDepth = 0;
    this.dropActive = false;
    this.draggingId = null;
  };

  private emitMove(id: string, from: string, to: string) {
    if (!to || to === from) return;
    this.rpMoveMeal.emit({ id, from, to });
  }

  private onDragStart = (event: DragEvent, meal: PlannedMeal) => {
    /**
     * Refuses a native drag that a touch produced.
     *
     * Belt and braces alongside clearing `draggable` on pointerdown: some Android builds
     * evaluate the long press before that clearing is observed. A native drag started by a
     * touch is unusable here — `dragover` and `drop` are not reliably delivered for one —
     * and letting it run would cancel the pointer drag that *does* work.
     */
    if (this.pointerKind === 'touch') {
      event.preventDefault();
      return;
    }

    this.draggingId = meal.id;

    // A custom MIME type is what lets dragover distinguish a meal from a dragged file or
    // a text selection, so unrelated drags never light up a column as a drop target.
    event.dataTransfer?.setData('application/x-rp-meal', JSON.stringify({ id: meal.id, from: this.day }));
    // text/plain is set alongside it because some browsers refuse a drag with no
    // conventional format attached.
    event.dataTransfer?.setData('text/plain', meal.title);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

    // Cleanup is handled by the document-level `dragend`/`drop` listeners registered in
    // `connectedCallback`. The element's own `dragend` cannot be relied on: a successful
    // move re-renders this column, so the source element is gone before the event would
    // have reached it, leaving the card stuck at 40% opacity.
  };

  private hasMealPayload(event: DragEvent) {
    return event.dataTransfer?.types.includes('application/x-rp-meal') ?? false;
  }

  private onDragEnter = (event: DragEvent) => {
    if (!this.hasMealPayload(event)) return;
    this.dragDepth += 1;
    this.dropActive = true;
  };

  private onDragOver = (event: DragEvent) => {
    if (!this.hasMealPayload(event)) return;
    // Without preventDefault the browser treats the element as a non-drop zone and the
    // drop event never fires.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };

  private onDragLeave = (event: DragEvent) => {
    if (!this.hasMealPayload(event)) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dropActive = false;
  };

  /**
   * Begins tracking a possible pointer drag.
   *
   * Nothing happens until the finger has either held still for `LONG_PRESS_MS` or moved
   * past the threshold, so a tap still reaches the select and the remove button, and a
   * swipe still scrolls the page.
   */
  private onPointerDown = (event: PointerEvent, meal: PlannedMeal) => {
    /**
     * Touch and pen only. A mouse already has HTML5 drag-and-drop, and running both from
     * one gesture makes them fight: this path's `preventDefault` on pointermove — needed
     * to stop a touch scrolling the page — also suppresses the native drag's own feedback,
     * so the card never dimmed and no drag image appeared even though the drop still
     * worked. The native path is left to own the mouse entirely.
     */
    if (event.pointerType === 'mouse') {
      this.pointerKind = 'mouse';
      return;
    }

    this.pointerKind = 'touch';

    /**
     * Disarms the native drag for *this* gesture, not merely the next render.
     *
     * Android Chrome decides whether to start an HTML5 drag during the long press that is
     * about to happen, and a `@State` change does not reach the DOM until Stencil's next
     * render — which lands too late to matter. Clearing the attribute directly is what
     * stops the two drag systems arming from the same press; the state above keeps it off
     * for every card once the render does catch up.
     */
    const card = event.currentTarget as HTMLElement | null;
    card?.removeAttribute('draggable');

    // A press on the select or a button is that control's, not the start of a drag.
    if ((event.target as HTMLElement).closest('button, select, label, a, rp-select')) return;

    this.pointerDrag = {
      id: meal.id,
      title: meal.title,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    this.lastPoint = { x: event.clientX, y: event.clientY };

    // Holding still is enough to start; `onPointerMove` cancels this if the finger
    // travels first, which is what keeps a scroll a scroll.
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      if (this.pointerDrag) this.beginPointerDrag();
    }, DaySlot.LONG_PRESS_MS);

    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
  };

  /**
   * Swallows a context menu raised anywhere while a touch drag is running.
   *
   * The element's own handler covers the press that starts the drag, but Android can also
   * raise the menu from a descendant or once the finger has travelled onto another
   * element, and either would hijack the touch stream mid-drag.
   */
  private onContextMenuDuringDrag = (event: Event) => {
    if (this.pointerDrag?.started) event.preventDefault();
  };

  /** Promotes the tracked press into an actual drag. */
  private beginPointerDrag() {
    const drag = this.pointerDrag;
    if (!drag || drag.started) return;

    drag.started = true;
    this.draggingId = drag.id;
    /**
     * Cloned before `draggingId` is applied to the DOM.
     *
     * Stencil renders on its own schedule, so at this point the original card has not yet
     * gained `.is-dragging` — which is what makes it a clean copy rather than a dimmed one.
     * `.is-dragging` is stripped from the clone regardless, since that ordering is a
     * detail of the framework rather than a guarantee.
     */
    this.createGhost(this.cardFor(drag.id), drag.title);
    this.moveGhost(this.lastPoint.x, this.lastPoint.y);
    this.highlightPanelAt(this.lastPoint.x, this.lastPoint.y);
    this.startEdgeScroll();
    document.addEventListener('contextmenu', this.onContextMenuDuringDrag, true);
  }

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    /**
     * Clamped into the viewport.
     *
     * Pointer capture keeps delivering coordinates once a finger passes the edge of the
     * screen, and on a phone that happens constantly — the days below the fold are reached
     * by dragging *downwards* past the bottom. Those coordinates hit-test to nothing, so
     * the highlight would drop out and the release would land on no column at all.
     *
     * Clamping keeps the effective point on the last visible row, which is also the row
     * auto-scrolling is bringing new days into.
     */
    this.lastPoint = {
      x: Math.min(Math.max(event.clientX, 1), window.innerWidth - 1),
      y: Math.min(Math.max(event.clientY, 1), window.innerHeight - 1),
    };

    if (!drag.started) {
      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      const moved = Math.hypot(dx, dy);

      /**
       * Below the threshold the press is still undecided, and must stay that way.
       *
       * A finger resting on a card is never perfectly still — it jitters a few pixels
       * while the long press runs. Reacting to that jitter is what broke the gesture on a
       * real device: a wobble of a pixel or two is mostly vertical simply because of how a
       * phone is held, so the branch below read it as a scroll and tore down the pending
       * drag. The user held, and nothing ever happened.
       */
      if (moved < DaySlot.DRAG_THRESHOLD) return;

      /**
       * Past the threshold with the hold still pending, a mainly vertical movement is a
       * scroll — the axis the page scrolls on. A sideways swipe cannot be a scroll here,
       * so it starts a drag immediately, which keeps a multi-column layout responsive.
       *
       * The slop radius is what distinguishes a swipe from the drift of a finger that is
       * simply resting. Inside it the hold keeps running; only travel beyond it is a
       * decision to scroll.
       */
      if (dy > dx) {
        if (moved < DaySlot.HOLD_SLOP) return;
        this.scrollFromTouch(event);
        return;
      }

      this.cancelHold();
      this.beginPointerDrag();
    }

    // Suppresses the page scroll that a touch-move would otherwise produce.
    event.preventDefault();
    // The clamped point, not the raw one: a finger past the edge of the screen still has
    // to highlight the row it is pressing against.
    this.moveGhost(this.lastPoint.x, this.lastPoint.y);
    this.highlightPanelAt(this.lastPoint.x, this.lastPoint.y);
  };

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const started = drag.started;
    const id = drag.id;
    /**
     * Resolved from the last clamped point rather than the release coordinates.
     *
     * A finger lifted past the bottom of the screen reports a position outside the
     * viewport, which hit-tests to nothing — the drop would be discarded even though the
     * column the user was holding against is obvious. `lastPoint` is that column.
     */
    const panel = started ? this.panelAt(this.lastPoint.x, this.lastPoint.y) : null;
    this.endPointerDrag();

    if (!started) return;

    const to = panel?.getAttribute('day');
    if (to) this.emitMove(id, this.day, to);
  };

  /**
   * A cancelled pointer sequence.
   *
   * Once a drag is under way this deliberately does *not* tear it down. On a phone
   * `pointercancel` is delivered whenever the platform decides some other gesture owns the
   * touch — a native drag arming, an edge-swipe, the browser's own scroll heuristics — and
   * treating that as "the user gave up" is what made a drag vanish mid-gesture with the
   * card left behind. The drag stays live and `pointerup` still resolves it; only a press
   * that had not yet become a drag is discarded here.
   */
  private onPointerCancel = () => {
    if (this.pointerDrag?.started) return;
    this.endPointerDrag();
  };

  /**
   * Scrolls the page for a swipe that turned out not to be a drag.
   *
   * The card sets `touch-action: none`, which it must in order to be draggable at all on
   * the vertical axis — but that also means the browser will not scroll for this gesture,
   * so the component has to. The drag is abandoned first, then each subsequent move is
   * translated into scrolling until the finger lifts, which keeps the swipe continuous
   * rather than dropping the rest of it.
   */
  private scrollFromTouch(event: PointerEvent) {
    const startY = this.pointerDrag?.startY ?? event.clientY;
    let lastY = event.clientY;

    this.endPointerDrag();
    window.scrollBy(0, startY - event.clientY);

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      window.scrollBy(0, lastY - move.clientY);
      lastY = move.clientY;
      move.preventDefault();
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  private cancelHold() {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private endPointerDrag() {
    this.cancelHold();
    this.stopEdgeScroll();
    document.removeEventListener('contextmenu', this.onContextMenuDuringDrag, true);
    this.pointerDrag = null;
    this.draggingId = null;
    this.clearHighlight();
    this.ghost?.remove();
    this.ghost = null;
    this.el.style.removeProperty('touch-action');

    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
  }

  /**
   * Scrolls the page while the finger rests near the top or bottom of the viewport.
   *
   * On a phone the week is one column tall, so the day being dragged to is usually off
   * screen — and a finger that is already touching the screen cannot scroll to it, because
   * that same touch is the drag. Without this the drop target is simply unreachable, which
   * is exactly the failure that a desktop browser's device emulation hides: its window is
   * tall enough that every day is visible at once.
   */
  private startEdgeScroll() {
    if (this.edgeScrollFrame !== null) return;

    const step = () => {
      if (!this.pointerDrag?.started) {
        this.edgeScrollFrame = null;
        return;
      }

      const y = this.lastPoint.y;
      const height = window.innerHeight;
      let delta = 0;

      if (y < DaySlot.EDGE_ZONE) {
        delta = -DaySlot.EDGE_SPEED * (1 - y / DaySlot.EDGE_ZONE);
      } else if (y > height - DaySlot.EDGE_ZONE) {
        delta = DaySlot.EDGE_SPEED * (1 - (height - y) / DaySlot.EDGE_ZONE);
      }

      if (delta !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        // Nothing moved, so the page is already at the end — keep the highlight where it
        // is rather than re-running a hit test that cannot produce a new answer.
        if (window.scrollY !== before) {
          // The page moved under a stationary finger, so what is beneath it has changed.
          this.highlightPanelAt(this.lastPoint.x, this.lastPoint.y);
        }
      }

      this.edgeScrollFrame = requestAnimationFrame(step);
    };

    this.edgeScrollFrame = requestAnimationFrame(step);
  }

  private stopEdgeScroll() {
    if (this.edgeScrollFrame !== null) {
      cancelAnimationFrame(this.edgeScrollFrame);
      this.edgeScrollFrame = null;
    }
  }

  /** The `rp-day-slot` under a point, found by hit-testing rather than by geometry. */
  private panelAt(x: number, y: number): Element | null {
    // The ghost follows the pointer and would otherwise be the topmost element.
    if (this.ghost) this.ghost.style.display = 'none';
    const target = document.elementFromPoint(x, y);
    if (this.ghost) this.ghost.style.display = '';

    const hit = target?.closest('rp-day-slot');
    if (hit) return hit;

    /**
     * Hit-testing returns nothing when the point is outside the viewport or lands in the
     * gap between columns — a finger dragged to the very edge of the screen does both.
     * Falling back to the nearest panel by geometry means a drop at the edge still lands
     * somewhere sensible instead of being silently discarded.
     */
    return this.nearestPanel(x, y);
  }

  private nearestPanel(x: number, y: number): Element | null {
    let best: Element | null = null;
    let bestDistance = Infinity;

    for (const panel of Array.from(document.querySelectorAll('rp-day-slot'))) {
      const box = panel.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      // Zero on either axis whenever the point is already within the panel's span there,
      // so this measures the gap to the box rather than to its centre.
      const dx = Math.max(box.left - x, 0, x - box.right);
      const dy = Math.max(box.top - y, 0, y - box.bottom);
      const distance = Math.hypot(dx, dy);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = panel;
      }
    }

    // Beyond this the pointer is nowhere near the planner and the drop is not meant for it.
    return bestDistance <= 64 ? best : null;
  }

  private highlightPanelAt(x: number, y: number) {
    const panel = this.panelAt(x, y);
    if (panel === this.hoveredPanel) return;

    this.clearHighlight();
    // The origin column is not a drop target; highlighting it would suggest otherwise.
    if (panel && panel !== this.el) {
      panel.querySelector('.slot')?.classList.add('is-drop-active');
      this.hoveredPanel = panel;
    }
  }

  private clearHighlight() {
    this.hoveredPanel?.querySelector('.slot')?.classList.remove('is-drop-active');
    this.hoveredPanel = null;
  }

  /**
   * The rendered card for one meal id.
   *
   * Found by index rather than by a selector: the `<li>` carries no id attribute, and the
   * order of `.meal` elements is the order of `normalized`, which is what the render walks.
   */
  private cardFor(id: string): HTMLElement | null {
    const index = this.normalized.findIndex((meal) => meal.id === id);
    if (index < 0) return null;
    return this.el.querySelectorAll<HTMLElement>('.meal')[index] ?? null;
  }

  /**
   * Builds the copy of the card that follows the finger.
   *
   * A clone of the real card rather than a label bearing its title. The native drag on a
   * desktop hands the browser a snapshot of the element itself, so the thing being dragged
   * looks exactly like the thing that was picked up; a touch drag has to construct that
   * likeness, and a bare title made the two platforms look like different features.
   *
   * The clone is sized to the original because it is positioned out of the flow, where a
   * percentage width would resolve against the viewport instead of the column.
   */
  private createGhost(source: HTMLElement | null, title: string) {
    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.className = 'rp-drag-ghost';

    if (source) {
      const box = source.getBoundingClientRect();
      ghost.style.width = `${box.width}px`;

      const copy = source.cloneNode(true) as HTMLElement;
      // The original is dimmed by `.is-dragging`; the copy is the thing being dragged and
      // must not inherit that, nor the id-based state that belongs to the live card.
      copy.classList.remove('is-dragging');
      copy.removeAttribute('draggable');

      /**
       * Every cloned custom element is flattened to inert markup.
       *
       * A cloned `rp-select` is still an undefined `rp-select` in the registry's eyes, so
       * appending it to the document upgrades it — Stencil then renders a *second* trigger
       * inside the one already copied, and the ghost shows two dropdowns. Replacing the
       * element with a plain `div` carrying the same classes keeps the rendered appearance
       * while removing anything that can come alive.
       */
      for (const custom of Array.from(copy.querySelectorAll('rp-select'))) {
        const flat = document.createElement('div');
        flat.className = custom.className;
        // The trigger is what was visible; the list is closed and contributes nothing.
        const trigger = custom.querySelector('.trigger');
        if (trigger) flat.append(trigger.cloneNode(true));
        custom.replaceWith(flat);
      }

      for (const node of Array.from(copy.querySelectorAll('button, input, select, a'))) {
        (node as HTMLElement).style.pointerEvents = 'none';
        node.setAttribute('tabindex', '-1');
      }

      ghost.append(copy);
    } else {
      // No element to copy — fall back to the title, which is better than nothing at all.
      ghost.textContent = title;
    }

    document.body.append(ghost);
    this.ghost = ghost;
  }

  /**
   * Positions the floating copy, keeping it fully on screen.
   *
   * The copy is as wide as the card it came from, so following the pointer literally pushes
   * it off the edge whenever a drag reaches one — and on a phone a drag reaches the bottom
   * edge on almost every move, because that is how auto-scroll is triggered. Clamping to
   * the viewport keeps the thing being dragged visible, which is the entire point of it.
   */
  private moveGhost(x: number, y: number) {
    if (!this.ghost) return;

    const box = this.ghost.getBoundingClientRect();
    // The rule's negative margin offsets the copy up and left of the fingertip; these are
    // the bounds that keep the result inside the viewport once it is applied.
    const maxX = window.innerWidth - box.width + 12;
    const maxY = window.innerHeight - box.height + 44;

    this.ghost.style.transform = `translate(${Math.min(Math.max(x, 12), Math.max(maxX, 12))}px, ${Math.min(Math.max(y, 44), Math.max(maxY, 44))}px)`;
  }

  private onDrop = (event: DragEvent) => {
    const payload = event.dataTransfer?.getData('application/x-rp-meal');
    if (!payload) return;

    event.preventDefault();
    this.dragDepth = 0;
    this.dropActive = false;

    try {
      const { id, from } = JSON.parse(payload) as { id: string; from: string };
      this.emitMove(id, from, this.day);
    } catch {
      // A malformed payload means the drag did not originate here; ignoring it is
      // preferable to throwing inside a drop handler, where nothing would catch it.
    }
  };

  render() {
    const days = Array.isArray(this.days) ? this.days : [];
    const labels = this.dayLabels ?? {};
    const meals = this.normalized;

    return (
      <Host>
        <section
          class={{ slot: true, 'is-drop-active': this.dropActive, 'is-empty': meals.length === 0 }}
          onDragEnter={this.onDragEnter}
          onDragOver={this.onDragOver}
          onDragLeave={this.onDragLeave}
          onDrop={this.onDrop}
        >
          <header class="head">
            <h3 class="day">{this.dayLabel || this.day}</h3>
            <div class="head-right">
              {meals.length > 0 && <span class="count">{meals.length}</span>}
              {/*
                The accessible name prefers the full label from `dayLabels` over the
                heading, because a consumer may abbreviate the heading to fit a narrow
                column — "Add a meal to Wednesday" is worth more to a screen reader than
                "Add a meal to Wed".
              */}
              <button
                type="button"
                class="add"
                onClick={() => this.rpAddMeal.emit(this.day)}
                aria-label={`Add a meal to ${
                  (this.dayLabels ?? {})[this.day] || this.dayLabel || this.day
                }`}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </header>

          {meals.length === 0 ? (
            <div class="empty">
              <slot>
                <svg class="empty-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  <path d="M4 4h16v16H4z" opacity="0.35" />
                  <path d="M8 2v4M16 2v4M4 10h16" />
                </svg>
                <p class="empty-text">No meals planned</p>
              </slot>
            </div>
          ) : (
            <ul class="meals">
              {meals.map((meal) => (
                <li
                  class={{ meal: true, 'is-dragging': this.draggingId === meal.id }}
                  key={meal.id}
                  /**
                   * Only where HTML5 drag-and-drop is the right mechanism — a mouse.
                   *
                   * Android Chrome fires a native `dragstart` on a long press, so leaving
                   * this on unconditionally armed *both* systems from one touch: the
                   * pointer path began its ghost, the native drag then seized the touch
                   * stream and delivered `pointercancel`, which tore that ghost and the
                   * target highlight straight back down. The native drag it left running
                   * has no usable drop target, because a touch-initiated drag does not
                   * reliably deliver `dragover`/`drop` on Android.
                   *
                   * The visible result was a card that could be picked up, showed no
                   * highlight over any day, and refused to drop.
                   */
                  draggable={this.pointerKind !== 'touch'}
                  onDragStart={(event) => this.onDragStart(event, meal)}
                  onPointerDown={(event) => this.onPointerDown(event, meal)}
                  /**
                   * Suppresses Android's long-press context menu.
                   *
                   * The gesture that starts a drag here is the same one the platform uses
                   * to raise its text-selection and link menu. On a card containing a title
                   * and controls that menu appears over the drag, takes the touch stream
                   * with it, and leaves the next tap dismissing the menu rather than
                   * pressing the button it landed on — which is why dragging and the remove
                   * button appeared broken together.
                   *
                   * A desktop right-click is a different gesture and is left alone.
                   */
                  onContextMenu={(event: MouseEvent) => {
                    if (this.pointerKind === 'touch') event.preventDefault();
                  }}
                >
                  <span class="grip" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <circle cx="9" cy="6" r="1.4" />
                      <circle cx="15" cy="6" r="1.4" />
                      <circle cx="9" cy="12" r="1.4" />
                      <circle cx="15" cy="12" r="1.4" />
                      <circle cx="9" cy="18" r="1.4" />
                      <circle cx="15" cy="18" r="1.4" />
                    </svg>
                  </span>

                  <span class="meal-title">{meal.title}</span>

                  <div class="meal-actions">
                    {/*
                      `rp-select` rather than a native `<select>`. A native control renders
                      its dropdown through the operating system, so the open panel keeps
                      platform typography and a blue system highlight no matter what this
                      stylesheet says — and on a phone it escapes the card entirely.
                    */}
                    <rp-select
                      class="move-select"
                      compact
                      label={`Move ${meal.title} to another day`}
                      placeholder="Move…"
                      options={days
                        .filter((day) => day !== this.day)
                        .map((day) => ({ value: day, label: labels[day] ?? day }))}
                      onRpSelectChange={(event: CustomEvent<string>) =>
                        this.emitMove(meal.id, this.day, event.detail)
                      }
                    ></rp-select>

                    <button
                      type="button"
                      class="remove"
                      onClick={() => this.rpRemoveMeal.emit({ id: meal.id, day: this.day })}
                      aria-label={`Remove ${meal.title}`}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Host>
    );
  }
}
