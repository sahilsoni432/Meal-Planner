import { read } from '$lib/server/store';
import { applyVegFilter, DAYS } from '$lib/recipe';
import { parseTheme, THEME_COOKIE, THEME_DEPENDENCY } from '$lib/theme';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import type { LayoutServerLoad } from './$types';

/**
 * Favorites are needed by every grid in the application, so they are loaded once for
 * the whole tree rather than repeated in each page load.
 *
 * The counts feed the navigation badges. They are derived here rather than in each page
 * because the header renders on every route, including ones whose own load knows nothing
 * about the plan. When Veg Only is on they count what is actually visible — a badge
 * reading 5 above a page showing 2 would be worse than no badge.
 */
export const load: LayoutServerLoad = async ({ cookies, depends }) => {
	depends(VEG_DEPENDENCY);
	depends(THEME_DEPENDENCY);

	const { favorites, plan, recipes } = read(cookies);
	const vegOnly = parseVegOnly(cookies.get(VEG_COOKIE));
	const theme = parseTheme(cookies.get(THEME_COOKIE));

	const localIds = new Set(recipes.map((recipe) => recipe.id));
	const nonVegLocalIds = new Set(
		recipes.filter((recipe) => !recipe.isVeg).map((recipe) => recipe.id)
	);

	/**
	 * Counts what the destination page will actually show.
	 *
	 * With Veg Only on, only *local* ids can be judged here — an API recipe's veg status
	 * needs a `lookup.php` call, and doing that for every favorite and planned meal would
	 * put a request fan-out on every page in the application.
	 *
	 * So rather than publish a number that would disagree with the page (a badge reading 2
	 * above a planner showing 1 is worse than no badge), a list containing any API id is
	 * reported as `null` while the filter is on, and the badge is simply omitted. Lists
	 * that are entirely local stay exact.
	 */
	const countVisible = (ids: string[]): number | null => {
		if (!vegOnly) return ids.length;
		if (ids.some((id) => !localIds.has(id))) return null;
		return ids.filter((id) => !nonVegLocalIds.has(id)).length;
	};

	return {
		favorites,
		vegOnly,
		theme,
		counts: {
			favorites: countVisible(favorites),
			planned: countVisible(DAYS.flatMap((day) => plan[day])),
			recipes: applyVegFilter(recipes, vegOnly).length
		}
	};
};
