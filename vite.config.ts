import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',

      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:5001',
            changeOrigin: true,
            secure: false,
          }
        }
      },

      build: {
        outDir: 'dist',
        emptyOutDir: true,
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            manualChunks: undefined
          }
        }
      },

      plugins: [react()],

      define: {
        'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5001'),
      },

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
