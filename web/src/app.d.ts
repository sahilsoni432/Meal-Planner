import type { Ingredient } from '$lib/recipe';

/**
 * Typing the custom element boundary.
 *
 * Svelte does not know the prop or event surface of a custom element, so without these
 * declarations every tag would accept any attribute and every event handler would be
 * implicitly `any`. The prop types mirror the published package's own `dist/types`.
 */
declare global {
	namespace App {
		interface Error {
			message: string;
		}
	}

	namespace svelteHTML {
		// Optional, because a consumer may render a component without listening to it.
		type CustomEvents<T> = {
			[K in keyof T as `on${string & K}`]?: (event: CustomEvent<T[K]>) => void;
		};

		/**
		 * Presentation attributes every tag accepts. Declaring an element in
		 * `IntrinsicElements` replaces the default typing rather than extending it, so
		 * without this a `class` or `style` on any of the six would be a type error.
		 */
		type HostAttributes = {
			class?: string;
			style?: string;
			id?: string;
			slot?: string;
		};

		interface IntrinsicElements {
			'rp-recipe-card': HostAttributes & {
				'recipe-id'?: string;
				recipeId?: string;
				'recipe-title'?: string;
				recipeTitle?: string;
				image?: string;
				category?: string;
				/** Added in recipe-planner-ui 1.2.0. */
				area?: string;
				/** Added in recipe-planner-ui 1.2.0. */
				minutes?: number;
				/** Added in recipe-planner-ui 1.4.0 — makes the whole card a link. */
				href?: string;
				'href-label'?: string;
				hrefLabel?: string;
				favorite?: boolean;
			} & CustomEvents<{
				rpFavoriteToggle: { recipeId: string; favorite: boolean };
			}>;

			'rp-search-bar': HostAttributes & {
				value?: string;
				placeholder?: string;
				label?: string;
			} & CustomEvents<{
				rpSearch: string;
				rpClear: void;
			}>;

			'rp-filter-chips': HostAttributes & {
				options?: string[];
				selected?: string | null;
				label?: string;
			} & CustomEvents<{
				rpFilterChange: string | null;
			}>;

			/** Added in recipe-planner-ui 1.4.0. */
			'rp-select': HostAttributes & {
				options?: Array<{ value: string; label: string }>;
				value?: string;
				label?: string;
				placeholder?: string;
				open?: boolean;
				disabled?: boolean;
				compact?: boolean;
			} & CustomEvents<{
				rpSelectChange: string;
			}>;

			/** Added in recipe-planner-ui 1.3.0. */
			'rp-filter-menu': HostAttributes & {
				label?: string;
				options?: string[];
				selected?: string | null;
				'search-placeholder'?: string;
				searchPlaceholder?: string;
				searchable?: boolean;
				open?: boolean;
			} & CustomEvents<{
				rpFilterChange: string | null;
				rpMenuToggle: { label: string; open: boolean };
			}>;

			'rp-ingredient-list': HostAttributes & {
				items?: Ingredient[];
			};

			'rp-day-slot': HostAttributes & {
				day?: string;
				'day-label'?: string;
				dayLabel?: string;
				meals?: Array<{ id: string; title: string }>;
				days?: string[];
				/** Added in recipe-planner-ui 1.1.0. */
				dayLabels?: Record<string, string>;
			} & CustomEvents<{
				rpAddMeal: string;
				rpRemoveMeal: { id: string; day: string };
				rpMoveMeal: { id: string; from: string; to: string };
			}>;

			'rp-modal': HostAttributes & {
				open?: boolean;
				heading?: string;
			} & CustomEvents<{
				rpClose: void;
			}>;
		}
	}
}

export {};
