// [mcp-local harness] feature: add-preload | plano: 9daa1987 | 2026-09-17 12:00:59
// Adicionar entry do preload no electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      outDir: 'dist/main',
      lib: {
        entry: resolve('src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: resolve('src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    resolve: {
      alias: {
        '@shared':   resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    build: {
      outDir: 'dist/renderer'
    }
  }
})
