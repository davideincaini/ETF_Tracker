import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ETF_Tracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // The market data files (public/data/*.json) change every weekday, so
        // they must NOT be precached with the app shell (that would freeze them
        // until the next app release). Precache only code and markup (this is
        // the plugin's default, written out so the exclusion is explicit)...
        globPatterns: ['**/*.{js,css,html}'],
        runtimeCaching: [
          {
            // ...and fetch the data "network first": try the server, and if it
            // does not answer within 6 seconds (offline, bad signal) serve the
            // last copy kept on the phone. The app shows that copy's age.
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'market-data',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
      manifest: {
        name: 'Antigravity',
        short_name: 'Antigravity',
        description: 'ETF Portfolio & Smart PAC Manager',
        theme_color: '#34C759',
        background_color: '#f4f6f3',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
