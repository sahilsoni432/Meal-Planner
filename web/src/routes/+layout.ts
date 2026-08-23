import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';

/**
 * Registers the custom elements from the published npm package.
 *
 * Imports from `dist/components` rather than the package's `loader`. The loader is
 * Stencil's lazy build and fetches per-component chunks relative to where the loader
 * script was served; Vite bundles it into the app's chunk directory without those chunks,
 * so every fetch 404s and no element upgrades. `dist/components` needs no runtime
 * resolution — each module carries its own component.
 *
 * `customElements` is a browser API, so this is client-side only. Server-rendered markup
 * carries un-upgraded tags until it resolves, which is why props are written as
 * kebab-case attributes.
 *
 * The `data` spread carries the server load's payload into `LayoutData`, which is
 * generated from this function's return type alone.
 */
export const load: LayoutLoad = async ({ data }) => {
	if (browser) {
		const components = await Promise.all([
			import('recipe-planner-ui/components/rp-recipe-card.js'),
			import('recipe-planner-ui/components/rp-search-bar.js'),
			import('recipe-planner-ui/components/rp-filter-chips.js'),
			import('recipe-planner-ui/components/rp-filter-menu.js'),
			import('recipe-planner-ui/components/rp-select.js'),
			import('recipe-planner-ui/components/rp-ingredient-list.js'),
			import('recipe-planner-ui/components/rp-day-slot.js'),
			import('recipe-planner-ui/components/rp-modal.js')
		]);

		// defineCustomElement throws if the tag is already registered, which happens on a
		// client-side navigation back through the root layout.
		for (const { defineCustomElement } of components) {
			try {
				defineCustomElement();
			} catch {
				// already defined
			}
		}
	}

	return { ...data };
};
