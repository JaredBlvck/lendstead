import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Railway passes $PORT at runtime; in dev we bind :5173 locally.
// VITE_API_URL points at the Railway backend service (set in Railway dashboard).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
});
