import { watch } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Vite ignores any path containing a .git segment, so feed changes to its watcher by hand
function watchSrc(): Plugin {
  return {
    name: 'watch-src',
    configureServer(server) {
      const root = resolve(process.cwd(), 'src')
      const timers = new Map<string, ReturnType<typeof setTimeout>>()
      watch(root, { recursive: true }, (_e, f) => {
        if (!f) return
        clearTimeout(timers.get(f))
        timers.set(f, setTimeout(() => server.watcher.emit('change', resolve(root, f)), 60))
      }).unref()
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), watchSrc()],
  server: { fs: { strict: false, deny: [] } },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'] },
})
