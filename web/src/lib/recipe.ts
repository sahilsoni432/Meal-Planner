/**
 * The recipe domain model, shared by server and client code.
 *
 * Recipes come from two places — TheMealDB and the user — and every screen mixes them
 * freely. Namespacing the id at the boundary (`api:52772`, `usr:k3f9x2`) means one grid,
 * one favorites list, and one planner can hold both without parallel data paths.
 */

export type RecipeSource = 'api' | 'local';

export interface Ingredient {
	name: string;
	measure: string;
}

export interface Recipe {
	id: string;
	title: string;
	category: string;
	area: string;
	instructions: string;
	image: string;
	ingredients: Ingredient[];
	source: RecipeSource;
	isVeg: boolean;
}

/**
 * What a listing needs.
 *
 * TheMealDB's filter endpoint returns only id, name, and thumbnail, so a filtered grid
 * cannot produce a full `Recipe` without an extra request per card. Listings are typed
 * for what is actually available.
 */
export interface RecipeSummary {
	id: string;
	title: string;
	category: string;
	image: string;
	source: RecipeSource;
	isVeg: boolean;
}

/**
 * Categories TheMealDB uses that contain no meat or fish.
 *
 * TheMealDB has no vegetarian field, so `isVeg` for an API recipe is derived from its
 * category and nothing else. That is a deliberately coarse rule with a known consequence:
 * it classifies the *category*, not the dish, so a Pasta with pancetta or a Dessert with
 * gelatine is labelled vegetarian. Being accurate per recipe would mean reading the
 * ingredients, and `filter.php` — which every grid is built on — does not return them, so
 * it would cost one extra request per card.
 *
 * User-created recipes do not go through this: the form asks, and the answer is stored.
 */
const VEG_CATEGORIES = new Set([
	'vegetarian',
	'vegan',
	'dessert',
	'pasta',
	'side',
	'starter',
	'breakfast',
	'miscellaneous'
]);

export function isVegCategory(category: string): boolean {
	return VEG_CATEGORIES.has(category.trim().toLowerCase());
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
	mon: 'Monday',
	tue: 'Tuesday',
	wed: 'Wednesday',
	thu: 'Thursday',
	fri: 'Friday',
	sat: 'Saturday',
	sun: 'Sunday'
};

/**
 * Column headings for the weekly grid.
 *
 * A week across gives each day roughly 155px, and "Wednesday" in uppercase plus a count
 * badge and the add button does not fit — it truncated to "WEDNES…", which reads worse
 * than an abbreviation chosen on purpose. The full names stay in `DAY_LABELS` for the
 * move control and the toasts, where there is room and the whole word is clearer.
 */
export const DAY_LABELS_SHORT: Record<Day, string> = {
	mon: 'Mon',
	tue: 'Tue',
	wed: 'Wed',
	thu: 'Thu',
	fri: 'Fri',
	sat: 'Sat',
	sun: 'Sun'
};

export function isDay(value: string): value is Day {
	return (DAYS as readonly string[]).includes(value);
}

/**
 * Where a recipe detail page was opened from, so its breadcrumb can lead back there.
 *
 * Carried in the URL as `?from=` rather than in a store: the detail page is shareable and
 * survives a reload, and a store would lose the origin on both. The value is a key rather
 * than a path so a crafted link cannot turn the breadcrumb into an arbitrary redirect —
 * anything unrecognised falls back to Discover.
 */
export const RECIPE_ORIGINS = {
	discover: { label: 'Discover', href: '/' },
	favorites: { label: 'Favorites', href: '/favorites' },
	'my-recipes': { label: 'My recipes', href: '/my-recipes' },
	planner: { label: 'Planner', href: '/planner' }
} as const;

export type RecipeOrigin = keyof typeof RECIPE_ORIGINS;

export function resolveOrigin(value: string | null | undefined): (typeof RECIPE_ORIGINS)[RecipeOrigin] {
	return RECIPE_ORIGINS[(value ?? '') as RecipeOrigin] ?? RECIPE_ORIGINS.discover;
}

export function isLocal(id: string): boolean {
	return id.startsWith('usr:');
}

/** Strips the namespace prefix, giving the id the originating system understands. */
export function rawId(id: string): string {
	const separator = id.indexOf(':');
	return separator === -1 ? id : id.slice(separator + 1);
}

export function namespaceId(source: RecipeSource, id: string): string {
	return `${source === 'local' ? 'usr' : 'api'}:${id}`;
}

export function toSummary(recipe: Recipe): RecipeSummary {
	return {
		id: recipe.id,
		title: recipe.title,
		category: recipe.category,
		image: recipe.image,
		source: recipe.source,
		isVeg: recipe.isVeg
	};
}

/** Applies Veg Only to any listing. Kept here so every page filters identically. */
export function applyVegFilter<T extends { isVeg: boolean }>(items: T[], vegOnly: boolean): T[] {
	return vegOnly ? items.filter((item) => item.isVeg) : items;
}
