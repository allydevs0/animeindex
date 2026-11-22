import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_TARGET = process.env.VITE_BACKEND_URL || 'https://animeindex-28ua.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
