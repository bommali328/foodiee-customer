import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  resolve: {
    dedupe: ['react', 'react-dom'], // 👈 Forces Vite to use a single React instance
  },
  server: {
    host: true,
    port: 3000,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
  },
})