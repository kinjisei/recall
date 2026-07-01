import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Recall — английский',
        short_name: 'Recall',
        description: 'Учим и поддерживаем английский язык',
        theme_color: '#0ea5e9',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        // Иконки добавим позже (Фаза 3). Без них установка PWA пока невозможна,
        // но в браузере и в dev-режиме приложение работает полностью.
        icons: [],
      },
    }),
  ],
})
