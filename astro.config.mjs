// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  // Prefetch de rutas al hacer hover sobre links (mejora SPA transitions)
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  integrations: [react()]
});