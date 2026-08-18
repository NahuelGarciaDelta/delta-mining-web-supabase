import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tallerCentralNavigationVitePlugin } from './scripts/taller-central-navigation-vite-plugin.mjs'

// La app Supabase contiene directamente la paginación progresiva; solo se aplica
// el transform de navegación de Taller Central que replica la app original.
export default defineConfig({
  plugins: [tallerCentralNavigationVitePlugin(), react()],
  server: {
    host: '0.0.0.0'
  },
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor'
          if (id.includes('xlsx')) return 'xlsx-vendor'
          return 'vendor'
        }
      }
    }
  }
})
