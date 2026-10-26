import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al backend (npm run dev en backend/, puerto 3000).
// Así el navegador cree que todo viene del mismo lugar y no hay problemas de CORS.
const proxy = { '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
