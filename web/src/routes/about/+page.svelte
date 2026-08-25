<script lang="ts">
	/**
	 * A guide to what the application does, written for someone opening it for the first
	 * time.
	 *
	 * Deliberately a static page: it explains features rather than reading any state, so a
	 * load function would only add a round trip. Everything here is content, and the few
	 * repeated shapes below are `{#each}` over local arrays so that adding a feature is a
	 * one-line change rather than another block of markup.
	 */

	const steps = [
		{
			n: 1,
			title: 'Find something to cook',
			body: 'Search by name or browse a category on Discover. Narrow it further with the Category and Cuisine filters — your search and filters live in the address bar, so a view you like can be bookmarked or shared and it will come back exactly as you left it.',
			href: '/',
			cta: 'Go to Discover'
		},
		{
			n: 2,
			title: 'Save the ones you like',
			body: 'Tap the heart on any recipe card to add it to your favorites. The heart fills red so you can see at a glance what you have already saved, and favorites is where the planner looks when you come to build a week.',
			href: '/favorites',
			cta: 'See favorites'
		},
		{
			n: 3,
			title: 'Add your own recipes',
			body: 'Write up the dishes you already cook — title, category, cuisine, ingredients with measures, and the method. Your recipes sit alongside the ones from the API everywhere in the app, and only yours can be edited or deleted.',
			href: '/my-recipes/new',
			cta: 'Write a recipe'
		},
		{
			n: 4,
			title: 'Plan your week',
			body: 'Assign meals to days on the Planner. Drag a card between days, or use the Move control on any card — on a phone, press and hold a card for a moment, then drag. Everything saves as you go; there is no save button to forget.',
			href: '/planner',
			cta: 'Open the planner'
		}
	];

	const features = [
		{
			title: 'Veg Only mode',
			body: 'A switch in the header that filters every listing to vegetarian recipes. Nothing is deleted — each page tells you how many items it is holding back, and switching it off brings them straight back.',
			icon: 'leaf'
		},
		{
			title: 'Light and dark',
			body: 'The theme button next to the switch changes the whole application between a warm light palette and a carbon dark one. Your choice is remembered, and the page loads in the right theme rather than flashing the wrong one first.',
			icon: 'moon'
		},
		{
			title: 'Works without JavaScript',
			body: 'Every action — favoriting, saving a recipe, planning a meal — is an ordinary form submission underneath. Drag-and-drop and the instant updates are enhancements layered on top, not the only way through.',
			icon: 'bolt'
		},
		{
			title: 'Your data stays yours',
			body: 'Favorites, your recipes, and your plan are stored in your own browser, not in a shared account. Two people opening the same link keep entirely separate data.',
			icon: 'lock'
		}
	];

	const faqs = [
		{
			q: 'Do I need an account?',
			a: 'No. There is no sign-up and no login. Everything you save is kept in your own browser.'
		},
		{
			q: 'Why can I only edit some recipes?',
			a: 'Recipes from the public recipe database are read-only. The ones you write yourself can be edited and deleted, which is why My recipes lists only yours.'
		},
		{
			q: 'Why does the planner only offer some recipes?',
			a: 'It offers your own recipes and your favorites. That keeps planning a short, deliberate list rather than a search across thousands of dishes — so favorite something first if you want it available.'
		},
		{
			q: 'Will my data follow me to another device?',
			a: 'No. It is stored per browser, so it does not travel between your phone and your laptop, and clearing your site data clears it.'
		},
		{
			q: 'How does Veg Only decide what is vegetarian?',
			a: 'For recipes you write, you tell it directly with the checkbox on the form. For recipes from the API there is no vegetarian field, so it is inferred from the category — which classifies the category rather than the individual dish, so treat it as a guide.'
		}
	];
</script>

<svelte:head>
	<title>About — Brownie Bites</title>
	<meta
		name="description"
		content="What Brownie Bites does, how to use it, and answers to the questions people ask first."
	/>
</svelte:head>

<div class="page-head">
	<span class="eyebrow">About</span>
	<h1>Cook more of what you like</h1>
	<p class="lede">
		Brownie Bites is a place to find recipes, keep the ones worth repeating, write down your
		own, and turn all of it into a week of meals. Here is the whole app in four steps.
	</p>
</div>

<section class="section-block" aria-labelledby="steps-heading">
	<div class="section-title">
		<h2 id="steps-heading">Getting started</h2>
	</div>

	<ol class="steps">
		{#each steps as step (step.n)}
			<li class="step">
				<span class="step-number" aria-hidden="true">{step.n}</span>
				<div class="step-body">
					<h3>{step.title}</h3>
					<p>{step.body}</p>
					<a class="card-link" href={step.href}>{step.cta}</a>
				</div>
			</li>
		{/each}
	</ol>
</section>

<section class="section-block" aria-labelledby="features-heading">
	<div class="section-title">
		<h2 id="features-heading">Good to know</h2>
	</div>

	<div class="features">
		{#each features as feature (feature.title)}
			<article class="feature">
				<span class="feature-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="20" height="20">
						{#if feature.icon === 'leaf'}
							<path d="M4 20c0-8 6-14 16-14 0 10-6 14-13 14H4Z" />
							<path d="M4 20c4-5 8-7 12-8" />
						{:else if feature.icon === 'moon'}
							<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
						{:else if feature.icon === 'bolt'}
							<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
						{:else}
							<rect x="4.5" y="10.5" width="15" height="10" rx="2" />
							<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
						{/if}
					</svg>
				</span>
				<h3>{feature.title}</h3>
				<p>{feature.body}</p>
			</article>
		{/each}
	</div>
</section>

<section class="section-block" aria-labelledby="faq-heading">
	<div class="section-title">
		<h2 id="faq-heading">Questions</h2>
	</div>

	<!--
		Native `<details>` rather than a scripted accordion: it opens without JavaScript, is
		keyboard operable and announced correctly with no ARIA of our own, and the browser
		handles find-in-page expanding a closed section.
	-->
	<div class="faqs">
		{#each faqs as faq (faq.q)}
			<details class="faq">
				<summary>
					<span>{faq.q}</span>
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
						<path d="m6 9 6 6 6-6" />
					</svg>
				</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</div>
</section>

<section class="closing">
	<h2>Ready to start?</h2>
	<p>Find a recipe you like, save it, and build your first week.</p>
	<div class="closing-actions">
		<a class="button" href="/">Browse recipes</a>
		<a class="button secondary" href="/planner">Open the planner</a>
	</div>
</section>

<style>
	/* ---------- Steps ---------- */

	.steps {
		display: grid;
		gap: var(--rp-space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.step {
		display: flex;
		gap: var(--rp-space-4);
		align-items: flex-start;
		padding: var(--rp-space-5);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-xl);
		box-shadow: var(--rp-shadow-xs);
		transition:
			border-color var(--rp-duration) var(--rp-ease),
			box-shadow var(--rp-duration) var(--rp-ease);
	}

	.step:hover {
		border-color: var(--rp-color-border-strong);
		box-shadow: var(--rp-shadow-sm);
	}

	.step-number {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 34px;
		height: 34px;
		font-family: var(--rp-font-serif);
		font-size: 1rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--rp-color-accent-contrast);
		background: var(--rp-color-accent);
		border-radius: 50%;
	}

	.step-body {
		min-width: 0;
	}

	.step-body h3 {
		margin: 2px 0 var(--rp-space-2);
		font-family: var(--rp-font-serif);
		font-size: 1.1875rem;
		font-weight: 600;
	}

	.step-body p {
		margin: 0 0 var(--rp-space-3);
		max-width: 50ch;
		color: var(--rp-color-text-muted);
	}

	/* ---------- Features ---------- */

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: var(--rp-space-3);
	}

	.feature {
		padding: var(--rp-space-5);
		background: var(--rp-color-surface-sunken);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
	}

	.feature-icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-bottom: var(--rp-space-3);
		color: var(--rp-color-highlight);
		background: var(--rp-color-highlight-soft);
		border-radius: var(--rp-radius-md);
	}

	.feature-icon svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.feature h3 {
		margin: 0 0 var(--rp-space-2);
		font-size: var(--rp-font-size-lg);
		font-weight: 600;
	}

	.feature p {
		margin: 0;
		font-size: var(--rp-font-size-md);
		color: var(--rp-color-text-muted);
	}

	/* ---------- Questions ---------- */

	.faqs {
		display: grid;
		gap: var(--rp-space-2);
	}

	.faq {
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
	}

	.faq summary {
		display: flex;
		gap: var(--rp-space-3);
		align-items: center;
		justify-content: space-between;
		padding: var(--rp-space-4) var(--rp-space-5);
		font-size: var(--rp-font-size-lg);
		font-weight: 600;
		color: var(--rp-color-text);
		cursor: pointer;
		/* The default triangle is replaced by the chevron below. */
		list-style: none;
	}

	.faq summary::-webkit-details-marker {
		display: none;
	}

	.faq summary:focus-visible {
		outline: var(--rp-focus-ring);
		outline-offset: -2px;
		border-radius: var(--rp-radius-lg);
	}

	.faq summary svg {
		flex-shrink: 0;
		fill: none;
		stroke: var(--rp-color-text-subtle);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform var(--rp-duration-fast) var(--rp-ease);
	}

	.faq[open] summary svg {
		transform: rotate(180deg);
	}

	.faq p {
		margin: 0;
		padding: 0 var(--rp-space-5) var(--rp-space-4);
		max-width: 62ch;
		color: var(--rp-color-text-muted);
	}

	/* ---------- Closing ---------- */

	.closing {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-3);
		align-items: center;
		padding: var(--rp-space-7) var(--rp-space-5);
		text-align: center;
		background: var(--rp-color-surface-sunken);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-xl);
	}

	.closing h2 {
		margin: 0;
		font-family: var(--rp-font-serif);
		font-size: 1.375rem;
		font-weight: 600;
	}

	.closing p {
		margin: 0;
		color: var(--rp-color-text-muted);
	}

	.closing-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-2);
		justify-content: center;
		margin-top: var(--rp-space-2);
	}

	@media (max-width: 560px) {
		.step {
			gap: var(--rp-space-3);
			padding: var(--rp-space-4);
		}

		.step-number {
			width: 28px;
			height: 28px;
			font-size: 0.875rem;
		}

		.faq summary {
			padding: var(--rp-space-3) var(--rp-space-4);
			font-size: var(--rp-font-size-md);
		}

		.faq p {
			padding: 0 var(--rp-space-4) var(--rp-space-3);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.step,
		.faq summary svg {
			transition: none;
		}
	}
</style>
