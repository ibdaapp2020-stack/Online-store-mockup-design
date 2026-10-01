import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PRO PHARM builds from the Git repository root.

const apiUrl = process.env.API_URL || 'http://127.0.0.1:5180'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': apiUrl,
    },
  },
})
