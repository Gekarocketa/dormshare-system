import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Na GitHub Pages aplikacja działa pod adresem /dormshare-system/
const base = process.env.GITHUB_PAGES === 'true' ? '/dormshare-system/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});

