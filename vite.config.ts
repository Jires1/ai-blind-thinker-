
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // On injecte les variables d'environnement au build pour le prototype
    'process.env': JSON.stringify(process.env)
  },
  server: {
    port: 3000
  }
});
