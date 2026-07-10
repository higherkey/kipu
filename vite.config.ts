import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    base: isProd ? '/kipu/' : '/',
    test: {
      environment: 'jsdom',
      globals: true,
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Kids Games Suite',
          short_name: 'Kids Games',
          description: 'A tactile, educational, and sensory mini-game suite for children',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'fullscreen',
          orientation: 'portrait',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        }
      })
    ]
  };
});

