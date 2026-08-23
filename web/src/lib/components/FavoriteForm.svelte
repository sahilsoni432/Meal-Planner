<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { useToasts } from '$lib/state/toasts.svelte';

	interface Props {
		recipeId: string;
		favorite: boolean;
	}

	let { recipeId, favorite }: Props = $props();

	const toasts = useToasts();
	let form = $state<HTMLFormElement>();

	/**
	 * The card's favorite control lives inside a web component, so it cannot be the
	 * form's submit button. The event handler submits this form instead, which keeps a
	 * single code path: with JavaScript the submission is enhanced, without it the
	 * fallback button below posts the same action.
	 */
	export function submit() {
		form?.requestSubmit();
	}
</script>

<form
	bind:this={form}
	method="POST"
	action="/?/toggleFavorite"
	use:enhance={() => {
		const next = !favorite;

		return async ({ result, update }) => {
			/**
			 * The action ends in a 303 so that a JavaScript-less browser lands back on the
			 * page it posted from. With `use:enhance` that redirect is applied as a
			 * navigation, and a navigation scrolls to the top — which throws a reader who
			 * favorited a card near the bottom of a long grid back to the start of the page.
			 *
			 * Handling the redirect here instead keeps the same server code path for both
			 * clients: `invalidateAll` re-reads the favorites so every grid updates, and
			 * `noScroll` leaves the viewport where the user left it. Any other result —
			 * a validation failure, say — falls through to the default handling.
			 */
			if (result.type === 'redirect') {
				await goto(result.location, { noScroll: true, invalidateAll: true, keepFocus: true });
			} else {
				await update({ reset: false });
			}

			toasts.push(next ? 'Added to favorites' : 'Removed from favorites');
		};
	}}
>
	<input type="hidden" name="recipeId" value={recipeId} />
	<input type="hidden" name="redirectTo" value={page.url.pathname + page.url.search} />
	<button type="submit" class="fallback">
		{favorite ? 'Remove from favorites' : 'Add to favorites'}
	</button>
</form>

<style>
	form {
		display: contents;
	}

	/**
	 * Visible only when the custom element has not upgraded — without JavaScript the
	 * card's own heart button cannot work, so this is the control that does.
	 */
	.fallback {
		padding: 4px var(--rp-space-3);
		font: inherit;
		font-size: var(--rp-font-size-xs);
		font-weight: 600;
		color: var(--rp-color-text-muted);
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border-strong);
		border-radius: var(--rp-radius-pill);
	}

	.fallback:hover {
		color: var(--rp-color-text);
		border-color: var(--rp-color-text-subtle);
	}

	:global(rp-recipe-card:defined) .fallback {
		display: none;
	}
</style>
