import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/Episismic/',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-globe.gl') || id.includes('/three/')) return 'globe';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          return undefined;
        },
      },
    },
  },
});
