<script lang="ts">
	import { page } from '$app/state';
	import NavMenu from '$lib/components/NavMenu.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import VegToggle from '$lib/components/VegToggle.svelte';
	import { createToasts } from '$lib/state/toasts.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Created here, once per render, and read by any descendant through context.
	createToasts();

	// A null count means the number cannot be computed without a request fan-out — see
	// the layout load. Those badges are omitted rather than shown wrong.
	const nav = $derived([
		{ href: '/', label: 'Discover', count: null as number | null },
		{ href: '/favorites', label: 'Favorites', count: data.counts.favorites },
		{ href: '/my-recipes', label: 'My recipes', count: data.counts.recipes },
		{ href: '/planner', label: 'Planner', count: data.counts.planned },
		{ href: '/about', label: 'About', count: null as number | null }
	]);

	// `/` would otherwise match every path as a prefix.
	const isCurrent = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	// Drives the header's rule and shadow, which are absent while the page is at the top.
	let scrolled = $state(false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onscroll={() => (scrolled = window.scrollY > 8)} />

<header class="site-header" data-scrolled={scrolled}>
	<div class="site-header-inner">
		<a class="brand" href="/">
			<span class="brand-mark" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 3v7a3 3 0 0 0 6 0V3M8 10v11" />
					<path d="M17 3c-1.5 2-2 4-2 6s.7 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9" />
				</svg>
			</span>
			<span>Brownie Bites</span>
		</a>

		<div class="header-controls">
			<VegToggle vegOnly={data.vegOnly} />
			<ThemeToggle theme={data.theme} />

			<!--
				Two presentations of the same list, chosen by CSS rather than by a media query
				read in script: the row of pills on a wide viewport, the menu on a narrow one.
				Only one is in the accessible tree at a time — the hidden one is
				`display: none`, which removes it from the tab order too, so the same links
				are never announced twice.
			-->
			<nav class="site-nav" aria-label="Main">
				{#each nav as item (item.href)}
					<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
						{item.label}
						{#if item.count !== null && item.count > 0}
							<span class="nav-count">{item.count}</span>
						{/if}
					</a>
				{/each}
			</nav>

			<div class="site-nav-compact">
				<NavMenu items={nav} {isCurrent} />
			</div>
		</div>
	</div>
</header>

<!--
	Keyed on the pathname so the entry animation replays on each navigation. Keying on the
	full URL would replay it for a filter change too, where the page is not being entered
	and the flash would read as a glitch.
-->
{#key page.url.pathname}
	<main class="page page-enter">
		{@render children()}
	</main>
{/key}

<Toasts />
