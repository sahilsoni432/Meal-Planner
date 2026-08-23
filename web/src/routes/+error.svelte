<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Brownie Bites</title>
</svelte:head>

<div class="error">
	<p class="status">{page.status}</p>
	<h1>{page.error?.message ?? 'Something went wrong'}</h1>
	<p class="muted">
		{#if page.status === 404}
			The page you asked for does not exist. It may have moved, or the link may be wrong.
		{:else}
			Try again, or head back to browse recipes.
		{/if}
	</p>
	<a class="button" href="/">Browse recipes</a>
</div>

<style>
	.error {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-3);
		align-items: center;
		padding: var(--rp-space-7) var(--rp-space-4);
		text-align: center;
	}

	.status {
		margin: 0;
		font-family: var(--rp-font-serif);
		font-size: clamp(4rem, 3rem + 8vw, 7rem);
		font-weight: 600;
		line-height: 0.9;
		letter-spacing: -0.04em;
		color: transparent;
		background: linear-gradient(150deg, var(--rp-caramel-300), var(--rp-espresso-800));
		background-clip: text;
		-webkit-background-clip: text;
	}

	h1 {
		margin: 0;
		font-family: var(--rp-font-serif);
		font-size: 1.5rem;
		font-weight: 600;
	}

	.muted {
		max-width: 44ch;
		margin: 0;
	}

	.button {
		margin-top: var(--rp-space-3);
	}
</style>
