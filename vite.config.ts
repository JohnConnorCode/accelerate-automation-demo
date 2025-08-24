import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  define: {
    'process.env': '{}',
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: 'es2020',
    minify: false, // Disable minification completely to avoid Deferred class issues
    rollupOptions: {
      output: {
        // Single chunk to avoid splitting issues
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
})