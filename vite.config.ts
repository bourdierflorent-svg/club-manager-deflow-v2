import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { versionPlugin } from './vite-plugin-version';

export default defineConfig({
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        versionPlugin(),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-state': ['zustand'],
              'vendor-ui': ['lucide-react', 'recharts'],
              'dashboard-admin': ['./components/AdminDashboard.tsx'],
              'modal-order': ['./components/AdminOrderModal.tsx'],
              'component-tablemap': ['./components/TableMap.tsx'],
              'dashboard-reservations': ['./components/ReservationsManager.tsx'],
              'dashboard-waiter': ['./components/WaiterDashboard.tsx'],
              'dashboard-hostess': ['./components/HostessDashboard.tsx'],
              'dashboard-manager': ['./components/ManagerDashboard.tsx'],
              'dashboard-viewer': ['./components/ViewerDashboard.tsx'],
              'dashboard-barmaid': ['./components/BarmaidDashboard.tsx'],
              'layout': ['./components/Layout.tsx', './components/NotificationCenter.tsx', './components/ConnectionIndicator.tsx'],
            }
          }
        },
        chunkSizeWarningLimit: 500,
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        }
      }
});