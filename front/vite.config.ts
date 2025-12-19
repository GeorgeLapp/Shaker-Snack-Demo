import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import legacy from '@vitejs/plugin-legacy';
import checker from 'vite-plugin-checker';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    checker({ typescript: true }),
    legacy({
      targets: [
        'Android >= 5',
        'Chrome >= 49'
      ],
      modernPolyfills: true
    })
  ],
  build: {
    target: ['es2017'], // при проблемах снизьте до es2015
    outDir: 'dist',
    sourcemap: false
  },
  server: { host: '0.0.0.0', port: 3000, strictPort: false },
  resolve: { alias: { '@': '/src' } }
});
