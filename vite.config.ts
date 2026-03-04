import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api/bling': {
                target: 'https://www.bling.com.br/Api/v3',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/bling/, ''),
                secure: false,
            }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                const modulePath = id.split('node_modules/')[1];
                const parts = modulePath.split('/');
                const packageName = parts[0].startsWith('@')
                  ? `${parts[0]}-${parts[1]}`
                  : parts[0];
                return `vendor-${packageName.replace(/[@/]/g, '-')}`;
              }

              if (id.includes('/pages/')) return 'pages';
              if (id.includes('/components/')) return 'components';
              if (id.includes('/services/')) return 'services';
              if (id.includes('/lib/')) return 'lib';
            }
          }
        }
      }
    };
});
