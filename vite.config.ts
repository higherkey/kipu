import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  return {
    base: '/',
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
      include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    },

    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
          suppressWarnings: true
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,ogg,wav,mp3,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                cacheableResponse: {
                  statuses: [0, 200]
                },
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
                }
              }
            },
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'audio' ||
                /\.(?:ogg|wav|mp3|m4a|aac|webm)$/i.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                  purgeOnQuotaError: true
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                rangeRequests: true
              }
            }
          ]
        },
        manifest: {
          id: '/',
          start_url: '/',
          scope: '/',
          name: 'Kipu',
          short_name: 'Kipu',
          description: 'A tactile, educational, and sensory mini-game suite for children — inspired by the Andean khipu.',
          theme_color: '#3D2B1F',
          background_color: '#F5EDD8',
          display: 'fullscreen',
          orientation: 'portrait',
          categories: ['education', 'kids', 'games'],
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
              purpose: 'any maskable'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ]
  };
});
