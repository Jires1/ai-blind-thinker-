
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Permet de garder la compatibilité avec process.env.API_KEY utilisé dans geminiService.ts
    'process.env': process.env
  },
  server: {
    port: 3000
  }
});
