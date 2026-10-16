import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Permite que Mercado Pago vuelva al checkout local a través de este túnel ngrok.
    allowedHosts: ['scooter-wildlife-shifter.ngrok-free.dev'],
  },
})
