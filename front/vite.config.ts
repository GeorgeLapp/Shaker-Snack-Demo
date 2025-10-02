import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';

export default defineConfig({
  base: '/',
  plugins: [react(), checker({ typescript: true })],
  server: {
    host: '0.0.0.0',
    port: 3050,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
