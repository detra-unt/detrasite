// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({

  site: 'https://detraunt.com',

  vite: {
    plugins: [tailwindcss()]
  },

  // Prefetch de rutas al hacer hover sobre links (mejora SPA transitions)
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  integrations: [
    react(),
    sitemap({
      // Excluir páginas que no deben indexarse
      filter: (page) => !page.includes('/404'),
      // Frecuencia y prioridad para cada ruta
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        // Página principal con mayor prioridad
        if (item.url === 'https://detraunt.com/') {
          item.priority = 1.0;
          // @ts-ignore
          item.changefreq = 'weekly';
          return item;
        }
        if (item.url.includes('/publicaciones')) {
          item.priority = 0.9;
          // @ts-ignore
          item.changefreq = 'daily';
          return item;
        }
        return item;
      },
    }),
  ]
});