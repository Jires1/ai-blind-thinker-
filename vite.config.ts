
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // On s'assure que process.env est un objet défini même si vide, pour éviter les plantages JS
    'process.env': JSON.stringify(process.env || {})
  },
  server: {
    port: 3000
  }
});
