import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/linksoul/',
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['www.aineoo.com'],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    allowedHosts: ['www.aineoo.com'],
  },
});
