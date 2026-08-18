import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La app Supabase ya contiene directamente los cambios de UI y paginación
// sincronizados desde la original. No se aplica el transform histórico de
// progressive-rows porque dependía de patrones exactos de una versión anterior
// de Abastecimiento y podía dejar el módulo transformado de forma parcial.
export default defineConfig({
  plugins: [react()],
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
