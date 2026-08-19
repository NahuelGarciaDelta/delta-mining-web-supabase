import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tallerCentralNavigationVitePlugin } from './scripts/taller-central-navigation-vite-plugin.mjs'
import { atrasoIchcFixesVitePlugin } from './scripts/atraso-ichc-fixes-vite-plugin.mjs'
import { intelligentRefreshVitePlugin } from './scripts/intelligent-refresh-vite-plugin.mjs'

// La versión Supabase conserva la paginación progresiva implementada directamente
// en sus componentes. Los demás transforms replican el comportamiento vigente de
// la app original sin reemplazar la capa de datos Supabase.
export default defineConfig({
  plugins: [tallerCentralNavigationVitePlugin(), atrasoIchcFixesVitePlugin(), intelligentRefreshVitePlugin(), react()],
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
