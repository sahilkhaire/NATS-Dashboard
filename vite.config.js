import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { natsContextPlugin } from './vite-plugin-nats-context.js'

export default defineConfig({
  plugins: [react(), natsContextPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // Accessible from any machine on the network
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',  // Preview also accessible externally
    port: 5173,
  },
})
