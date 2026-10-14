import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const destination = fileURLToPath(new URL('artifacts/', root))
mkdirSync(destination, { recursive: true })
for (const directory of ['packages/host/context-visualizer/', 'packages/client/context-visualizer/']) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: fileURLToPath(new URL(directory, root)), stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
