import type { Cookies } from '@sveltejs/kit';
import { DAYS, isVegCategory, type Day, type Recipe } from '$lib/recipe';
import seed from '../../../data/store.seed.json';

/**
 * The entire persistence surface of the application.
 *
 * State lives in a cookie rather than on disk. Every host this would realistically deploy
 * to has a read-only or ephemeral filesystem — on Vercel a write throws EROFS, which
 * surfaced as a 500 on every favorite, save, and plan change. A cookie needs no external
 * service, survives redeploys, and is per-visitor rather than one global store, so two
 * people opening the deployed link do not overwrite each other.
 *
 * The trade is size: a cookie is capped at about 4KB. Only what cannot be reconstructed
 * is stored — favorites and the plan are lists of ids, and user recipes are held in a
 * compact array form. `capacityExceeded` reports when a write would not fit, so the
 * caller can tell the user rather than silently dropping data.
 */

const COOKIE = 'planner';
const MAX_COOKIE_BYTES = 3800; // Leaves headroom under the 4096 limit for cookie metadata.

export interface Store {
	recipes: Recipe[];
	favorites: string[];
	plan: Record<Day, string[]>;
}

/**
 * The serialized form. Keys are short and recipes are positional because every byte
 * counts against the cookie limit; this shape is roughly 40% smaller than the object
 * form for the same data.
 */
interface Packed {
	f?: string[];
	p?: Partial<Record<Day, string[]>>;
	r?: Array<PackedRecipe>;
}

/**
 * A recipe as stored. The trailing `isVeg` flag is `0 | 1` rather than a boolean because
 * JSON writes those as one byte instead of four or five, and it is optional because a
 * cookie written before the field existed has only seven entries.
 */
type PackedRecipe = [
	string,
	string,
	string,
	string,
	string,
	string,
	Array<[string, string]>,
	(0 | 1)?
];

function emptyPlan(): Record<Day, string[]> {
	const plan = {} as Record<Day, string[]>;
	for (const day of DAYS) plan[day] = [];
	return plan;
}

function pack(store: Store): Packed {
	const packed: Packed = {};

	if (store.favorites.length > 0) packed.f = store.favorites;

	const usedDays = DAYS.filter((day) => store.plan[day].length > 0);
	if (usedDays.length > 0) {
		packed.p = {};
		for (const day of usedDays) packed.p[day] = store.plan[day];
	}

	if (store.recipes.length > 0) {
		packed.r = store.recipes.map((recipe): PackedRecipe => [
			recipe.id,
			recipe.title,
			recipe.category,
			recipe.area,
			recipe.instructions,
			recipe.image,
			recipe.ingredients.map((ingredient): [string, string] => [
				ingredient.name,
				ingredient.measure
			]),
			recipe.isVeg ? 1 : 0
		]);
	}

	return packed;
}

function unpack(packed: Packed | null): Store {
	return {
		favorites: packed?.f ?? [],
		// Spread over an empty week so a plan written before a day existed still loads.
		plan: { ...emptyPlan(), ...(packed?.p ?? {}) },
		recipes: (packed?.r ?? []).map(
			([id, title, category, area, instructions, image, ingredients, isVeg]): Recipe => ({
				id,
				title,
				category,
				area,
				instructions,
				image,
				ingredients: ingredients.map(([name, measure]) => ({ name, measure })),
				source: 'local',
				// A recipe saved before the field existed has no flag, so its category
				// decides — the same rule the API recipes use.
				isVeg: isVeg === undefined ? isVegCategory(category) : isVeg === 1
			})
		)
	};
}

function seedStore(): Store {
	const source = seed as Partial<Store>;
	return {
		// The seed is hand-written JSON rather than something the type checker validates,
		// so a recipe added there without the flag falls back to its category.
		recipes: (source.recipes ?? []).map((recipe) => ({
			...recipe,
			isVeg: recipe.isVeg ?? isVegCategory(recipe.category)
		})),
		favorites: source.favorites ?? [],
		plan: { ...emptyPlan(), ...(source.plan ?? {}) }
	};
}

function serialize(store: Store): string {
	return encodeURIComponent(JSON.stringify(pack(store)));
}

/**
 * Reads the visitor's store.
 *
 * A visitor with no cookie yet gets the seed, so a first visit shows a populated app
 * rather than empty pages.
 */
export function read(cookies: Cookies): Store {
	const raw = cookies.get(COOKIE);
	if (!raw) return seedStore();

	try {
		return unpack(JSON.parse(decodeURIComponent(raw)) as Packed);
	} catch {
		// A malformed cookie is not worth failing a page render over.
		return seedStore();
	}
}

export class StoreFullError extends Error {
	constructor() {
		super('There is not enough room to save that. Remove a recipe or a favorite first.');
		this.name = 'StoreFullError';
	}
}

/**
 * Applies a change and writes it back.
 *
 * Throws `StoreFullError` when the result would not fit, leaving the previous state
 * intact — callers turn that into a message rather than losing what the user had.
 */
export function write(
	cookies: Cookies,
	mutate: (store: Store) => void,
	url?: URL
): Store {
	const store = read(cookies);
	mutate(store);

	const value = serialize(store);
	if (value.length > MAX_COOKIE_BYTES) throw new StoreFullError();

	cookies.set(COOKIE, value, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		/**
		 * Set only when the request actually arrived over HTTPS.
		 *
		 * A `Secure` cookie is discarded outright by the browser on a plain-HTTP origin, so
		 * hard-coding `true` meant every `Set-Cookie` was silently dropped when the site was
		 * opened from a phone at `http://<lan-ip>`. The failure was invisible server-side:
		 * the action ran, reported success, and the toast appeared, while nothing was
		 * persisted — the next load re-read the previous cookie, so adding, moving, and
		 * removing a meal all appeared to do nothing.
		 *
		 * SvelteKit's own default is not sufficient here: it exempts `localhost` only, and
		 * still sets `Secure` for any other HTTP host. Production is HTTPS, so the flag is
		 * on there and the cookie stays protected.
		 */
		secure: url ? url.protocol === 'https:' : true,
		maxAge: 60 * 60 * 24 * 365
	});

	return store;
}

/** Bytes still available, so the UI can warn before a save fails. */
export function remainingBytes(store: Store): number {
	return MAX_COOKIE_BYTES - serialize(store).length;
}
