import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

const buildId = Date.now().toString()

function generateVersionPlugin(): Plugin {
  return {
    name: 'generate-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json',
        source: JSON.stringify({ buildId, buildTime: new Date().toISOString() }, null, 2) })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const proxyTarget = process.env.BACKEND_PROXY_URL || loadEnv(mode, process.cwd(), 'BACKEND_PROXY_URL').BACKEND_PROXY_URL || 'http://127.0.0.1:8080'
  return {
    plugins: [
      react(),
      generateVersionPlugin()
    ],
    define: {
      'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(command === 'build' ? buildId : '')
    },
    server: {
      proxy: {
        '/api': { target: proxyTarget },
        '/ws': { target: proxyTarget, ws: true }
      }
    }
  }
})
