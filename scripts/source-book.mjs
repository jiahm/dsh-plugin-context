import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['node_modules', 'lib', 'artifacts', 'docs', '.git', 'coverage'])
const files = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (entry.isFile() && entry.name !== 'pnpm-lock.yaml' && !entry.name.endsWith('.tsbuildinfo')) files.push(path)
  }
}
await collect(root)
const sections = ['# 完整源码：文件路径与内容', '', '安装依赖后运行 `pnpm check`。根目录 `pnpm-lock.yaml` 为自动生成的锁文件，未重复展开。', '']
for (const path of files.sort()) {
  const language = { '.ts': 'typescript', '.tsx': 'tsx', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.mjs': 'javascript', '.md': 'markdown' }[extname(path)] ?? 'text'
  const content = await readFile(path, 'utf8')
  const fences = content.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...fences.map(value => value.length + 1)))
  sections.push(`## ${relative(root, path)}`, '', `${fence}${language}`, content.trimEnd(), fence, '')
}
await mkdir(join(root, 'docs'), { recursive: true })
await writeFile(join(root, 'docs/SOURCE.md'), sections.join('\n'))
console.log(`docs/SOURCE.md: ${files.length} complete files`)
