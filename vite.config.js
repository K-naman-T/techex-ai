import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'assets', // Switch back to assets as requested
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces (0.0.0.0)
    allowedHosts: ['proterandrous-impalpably-jair.ngrok-free.dev'], // Allow ngrok tunnel hosts
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
        secure: false,
      }
    }
  },
});
