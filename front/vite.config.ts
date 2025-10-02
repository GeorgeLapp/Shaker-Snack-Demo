import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    checker({ typescript: true })
  ],
  server: {
    port: 3000,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

