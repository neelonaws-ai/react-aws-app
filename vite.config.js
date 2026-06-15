import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Content-hashed filenames for long-term caching on CloudFront
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    sourcemap: false,          // Never ship sourcemaps to prod S3
    minify: 'esbuild',
    target: 'es2015'
  },
  // Env variable prefix exposed to React
  envPrefix: 'VITE_'
})
