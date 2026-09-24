import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD_STAMP) },
  // Binds every interface so a phone on the same network can reach it.
  server: { host: true },
  // Two pages: the demo at / and the learning walkthrough at /learn/.
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        learn: 'learn/index.html',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'ProMaize',
        short_name: 'ProMaize',
        description: 'Trial planner: which breeding lines get the ground this season',
        theme_color: '#1a1a19',
        background_color: '#1a1a19',
        display: 'standalone',
        start_url: '/',
      },
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
    }),
  ],
})
