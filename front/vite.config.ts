import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    checker({ typescript: true })
  ],
  server: {\n    host: '0.0.0.0',\n    port: 3050,\n    strictPort: false,\n  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});


