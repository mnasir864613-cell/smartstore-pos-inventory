import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env vars for the current mode
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = command === 'serve';

  return {
    plugins: [
      vue(),
      // basicSsl only applies during development (vite dev/serve)
      // It is NOT included in production builds (vite build)
      ...(isDev ? [basicSsl()] : [])
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      https: isDev, // HTTPS only in dev (driven by basicSsl)
      port: 5173,
      proxy: {
        // Dev proxy: forward /api requests to local backend
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist',
      // Generate source maps only in non-production for security
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          // Chunk vendor libs separately for better caching
          manualChunks: {
            vendor: ['vue', 'vue-router', 'axios'],
            icons: ['lucide-vue-next']
          }
        }
      }
    }
  };
});
