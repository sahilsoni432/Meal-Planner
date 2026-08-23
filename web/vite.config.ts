import vercel from '@sveltejs/adapter-vercel';
import node from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * Vercel is the deployment target. The Node adapter is selectable with
 * `ADAPTER=node npm run build` so a production build can be verified on Windows, where
 * the Vercel adapter's final symlink step needs Developer Mode or elevated rights.
 */
const adapter = process.env.ADAPTER === 'node' ? node() : vercel();

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter
		})
	]
});
