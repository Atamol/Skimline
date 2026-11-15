import { defineConfig } from 'vite'
import { watch } from 'node:fs'
import { resolve } from 'node:path'

function reloadOnDeckEdit() {
  const root = process.cwd()
  return {
    name: 'reload-on-deck-edit',
    configureServer(server) {
      const timers = new Map()
      watch(root, (_event, filename) => {
        if (!filename || !/\.(md|css)$/.test(filename)) return
        clearTimeout(timers.get(filename))
        timers.set(filename, setTimeout(() => server.watcher.emit('change', resolve(root, filename)), 60))
      })
    },
  }
}

export default defineConfig({
  plugins: [reloadOnDeckEdit()],
  server: {
    fs: {
      strict: false,
      deny: [],
    },
  },
})
