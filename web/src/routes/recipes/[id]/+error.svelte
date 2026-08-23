<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Recipe not found — Brownie Bites</title>
</svelte:head>

<div class="error empty-state">
	<span class="empty-state-icon">
		<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.6-3.6" />
		</svg>
	</span>
	<h1>{page.error?.message ?? 'Recipe not found'}</h1>
	<p class="muted">
		The recipe may have been removed, or the link may be wrong. Search for something else.
	</p>
	<a class="button" href="/">Browse recipes</a>
</div>

<style>
	.error {
		margin-top: var(--rp-space-6);
	}

	h1 {
		margin: 0;
		font-family: var(--rp-font-serif);
		font-size: 1.375rem;
		font-weight: 600;
	}

	.muted {
		max-width: 44ch;
		margin: 0;
	}

	.button {
		margin-top: var(--rp-space-2);
	}
</style>
