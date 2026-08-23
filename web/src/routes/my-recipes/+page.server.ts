import { fail } from '@sveltejs/kit';
import { applyVegFilter, toSummary } from '$lib/recipe';
import { read, write } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	const { recipes, favorites } = read(cookies);
	const vegOnly = parseVegOnly(cookies.get(VEG_COOKIE));

	const all = recipes.map(toSummary);
	const visible = applyVegFilter(all, vegOnly);

	return {
		recipes: visible,
		favorites,
		vegOnly,
		// Own recipes are the one list a user knows the contents of, so a filtered view
		// has to account for what is missing rather than appear to have lost it.
		hiddenCount: all.length - visible.length
	};
};

export const actions: Actions = {
	delete: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');

		if (!id) return fail(400, { message: 'A recipe id is required.' });

		write(
			cookies,
			(store) => {
				store.recipes = store.recipes.filter((recipe) => recipe.id !== id);

				// A deleted recipe must not linger as a favorite or a planned meal, which
				// would leave the favorites page resolving an id that no longer exists.
				store.favorites = store.favorites.filter((favorite) => favorite !== id);
				for (const day of Object.keys(store.plan) as Array<keyof typeof store.plan>) {
					store.plan[day] = store.plan[day].filter((meal) => meal !== id);
				}
			},
			url
		);

		return { deleted: true };
	}
};
