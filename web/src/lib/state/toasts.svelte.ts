import { getContext, setContext } from 'svelte';

/**
 * Transient notifications shown after a mutation.
 *
 * Favoriting happens on a card deep in a grid while the message appears in the layout, so
 * there is no parent-child relationship to pass a prop through. It is never persisted, and
 * the URL would be wrong for it — `?toast=saved` would survive sharing and reload.
 */

export type ToastKind = 'success' | 'error';

export interface Toast {
	id: string;
	message: string;
	kind: ToastKind;
}

const KEY = Symbol('toasts');
const DISMISS_AFTER = 4000;

let counter = 0;

/**
 * A counter rather than `crypto.randomUUID()`, which exists only in a secure context and
 * throws over plain HTTP — how the site is reached from a phone on the local network.
 * Because every mutation pushes a toast inside its `use:enhance` callback, that throw
 * rejected the callback before `update()` ran, so meals silently failed to save on a phone
 * while working on `localhost`.
 */
function nextId(): string {
	counter += 1;
	return `toast-${counter}`;
}

export class ToastQueue {
	items = $state<Toast[]>([]);

	push(message: string, kind: ToastKind = 'success') {
		const id = nextId();
		this.items = [...this.items, { id, message, kind }];

		setTimeout(() => this.dismiss(id), DISMISS_AFTER);
	}

	dismiss(id: string) {
		this.items = this.items.filter((toast) => toast.id !== id);
	}
}

/**
 * Creates the queue for one render and puts it in context.
 *
 * Never export a ready-made instance: a module-level singleton is created once per Node
 * process, and one process serves every visitor, so one user's toasts would appear in
 * another user's page. Context is per-render, which is what makes this safe under SSR.
 */
export function createToasts(): ToastQueue {
	return setContext(KEY, new ToastQueue());
}

export function useToasts(): ToastQueue {
	return getContext<ToastQueue>(KEY);
}
