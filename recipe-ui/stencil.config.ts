import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'recipe-planner-ui',
  globalStyle: 'src/global/tokens.css',
  outputTargets: [
    {
      // Provides loader/, which the SvelteKit app calls via defineCustomElements().
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
    },
    {
      type: 'docs-readme',
    },
    {
      // The plain-HTML demo page, which is what proves these components need no framework.
      type: 'www',
      serviceWorker: null,
    },
  ],
};
