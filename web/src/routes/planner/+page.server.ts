import { fail } from '@sveltejs/kit';
import {
	applyVegFilter,
	DAYS,
	isDay,
	isLocal,
	rawId,
	toSummary,
	type Day,
	type RecipeSummary
} from '$lib/recipe';
import { lookupRecipe } from '$lib/server/mealdb';
import { read, StoreFullError, write } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import type { Actions, PageServerLoad } from './$types';

export interface PlannedMeal {
	id: string;
	title: string;
}

export const load: PageServerLoad = async ({ fetch, cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	const { plan, recipes, favorites } = read(cookies);
	const vegOnly = parseVegOnly(cookies.get(VEG_COOKIE));

	// Every planned id is resolved once, rather than per day, since the same recipe can
	// appear on several days.
	const planned = new Set(Object.values(plan).flat());

	// Both the title and the veg flag are needed per id, so one map holds the resolved
	// recipe rather than two maps holding halves of it.
	const resolved = new Map<string, { title: string; isVeg: boolean }>();
	await Promise.all(
		[...planned].map(async (id) => {
			if (isLocal(id)) {
				const own = recipes.find((recipe) => recipe.id === id);
				if (own) resolved.set(id, { title: own.title, isVeg: own.isVeg });
				return;
			}

			const recipe = await lookupRecipe(fetch, rawId(id));
			if (recipe) resolved.set(id, { title: recipe.title, isVeg: recipe.isVeg });
		})
	);

	let hiddenCount = 0;

	const week = DAYS.map((day) => ({
		day,
		meals: plan[day]
			// An id with no title no longer resolves — the recipe was deleted upstream.
			.filter((id) => resolved.has(id))
			.filter((id) => {
				// Hidden, not removed: the meal stays in the plan and returns when the
				// filter is switched off.
				if (vegOnly && !resolved.get(id)!.isVeg) {
					hiddenCount += 1;
					return false;
				}
				return true;
			})
			.map((id): PlannedMeal => ({ id, title: resolved.get(id)!.title }))
	}));

	/**
	 * The picker offers exactly two sources: the user's own recipes and their favorites.
	 * Anything else would make the planner depend on a search.
	 *
	 * The two overlap — a local recipe the user has also favorited is in both lists — so
	 * the result is keyed by id. Ids are namespaced (`usr:` / `api:`), which makes the id
	 * itself the identity: the same recipe cannot arrive under two different ones.
	 *
	 * Only non-local favorites are looked up. A favorited local recipe is already in
	 * `recipes`, so resolving it over the network would be a request for data in hand.
	 */
	const byId = new Map<string, RecipeSummary>();

	for (const recipe of recipes) byId.set(recipe.id, toSummary(recipe));

	const apiFavorites = await Promise.all(
		favorites
			.filter((id) => !isLocal(id))
			.map(async (id) => {
				const recipe = await lookupRecipe(fetch, rawId(id));
				return recipe ? toSummary(recipe) : null;
			})
	);

	for (const recipe of apiFavorites) {
		if (recipe && !byId.has(recipe.id)) byId.set(recipe.id, recipe);
	}

	const candidates: RecipeSummary[] = [...byId.values()].sort((a, b) =>
		a.title.localeCompare(b.title)
	);

	return {
		week,
		// Offering a meat recipe in the picker while the filter hides it from the grid
		// would let the user assign something they then could not see.
		candidates: applyVegFilter(candidates, vegOnly),
		vegOnly,
		hiddenCount
	};
};

/** Rejects a day that is not one of the seven, so a crafted post cannot widen the plan. */
function readDay(data: FormData, field: string): Day | null {
	const value = String(data.get(field) ?? '');
	return isDay(value) ? value : null;
}

export const actions: Actions = {
	assign: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const day = readDay(data, 'day');
		const recipeId = String(data.get('recipeId') ?? '');

		if (!day || !recipeId) return fail(400, { message: 'A day and a recipe are required.' });

		try {
			write(
				cookies,
				(store) => {
					// The same recipe twice in one day is meaningless, so assignment is idempotent.
					if (!store.plan[day].includes(recipeId)) {
						store.plan[day] = [...store.plan[day], recipeId];
					}
				},
				url
			);
		} catch (error) {
			if (error instanceof StoreFullError) return fail(400, { message: error.message });
			throw error;
		}

		return { assigned: true };
	},

	remove: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const day = readDay(data, 'day');
		const recipeId = String(data.get('recipeId') ?? '');

		if (!day || !recipeId) return fail(400, { message: 'A day and a recipe are required.' });

		// Removing only ever shrinks the store, so this cannot exceed the cap.
		write(
			cookies,
			(store) => {
				store.plan[day] = store.plan[day].filter((id) => id !== recipeId);
			},
			url
		);

		return { removed: true };
	},

	move: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const from = readDay(data, 'from');
		const to = readDay(data, 'to');
		const recipeId = String(data.get('recipeId') ?? '');

		if (!from || !to || !recipeId) {
			return fail(400, { message: 'A source day, a target day, and a recipe are required.' });
		}

		write(
			cookies,
			(store) => {
				store.plan[from] = store.plan[from].filter((id) => id !== recipeId);
				if (!store.plan[to].includes(recipeId)) {
					store.plan[to] = [...store.plan[to], recipeId];
				}
			},
			url
		);

		return { moved: true };
	}
};
