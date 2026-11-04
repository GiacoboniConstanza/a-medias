import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-v3.ico', 'favicon.svg', 'icons/icon.svg', 'icons/apple-touch-icon-v3.png', 'icons/icon-192-v3.png', 'icons/icon-512-v3.png', 'icons/icon-maskable-192-v3.png', 'icons/icon-maskable-512-v3.png'],
      manifest: {
        name: 'A Medias',
        short_name: 'A Medias',
        description: 'Finanzas compartidas para dos personas que conviven.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#7D8BB2',
        theme_color: '#7D8BB2',
        icons: [
          { src: 'icons/icon-192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/compartir',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'files',
                accept: ['image/*', 'application/pdf', 'text/plain'],
              },
            ],
          },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        importScripts: ['push-handler.js', 'share-handler.js'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
