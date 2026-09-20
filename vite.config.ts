import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD_STAMP) },
  // Binds every interface so a phone on the same network can reach it.
  server: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'SyDAg 2026',
        short_name: 'SyDAg',
        description: 'SyDAg 2026 hackathon',
        theme_color: '#1a1a19',
        background_color: '#1a1a19',
        display: 'standalone',
        start_url: '/',
      },
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
    }),
  ],
})
