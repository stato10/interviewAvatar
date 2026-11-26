import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev proxy target for /api when VITE_API_URL is left empty (same-origin calls).
  const backend = env.DEV_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/health': { target: backend, changeOrigin: true },
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            livekit: ['livekit-client'],
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  }
})
