import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chat: resolve(__dirname, 'pages/chat.html'),
        docs: resolve(__dirname, 'pages/docs.html'),
        features: resolve(__dirname, 'pages/features.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
})
