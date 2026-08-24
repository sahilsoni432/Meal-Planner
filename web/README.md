# web

The SvelteKit application. See the [project README](../README.md) for setup, deployment,
and the assumptions behind the persistence model, and [ARCHITECTURE.md](../ARCHITECTURE.md)
for how the pieces fit together.

## Running it

```sh
npm install
npm run dev
```

The dev server starts at http://localhost:5173.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Type-check the Svelte and TypeScript sources |
| `npm run lint` | Prettier check |
| `npm run format` | Prettier write |

## Notes

The UI components come from `recipe-planner-ui`, installed from npm rather than imported
from `recipe-ui/` across the repository. A change to the library is not visible here until
it is published.

Vercel is the deployment target. The Node adapter is selectable with `ADAPTER=node npm run
build` for verifying a production build on Windows, where the Vercel adapter's symlink step
needs Developer Mode or elevated rights.
