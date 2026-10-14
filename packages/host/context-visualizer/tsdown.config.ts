import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'], outDir: 'lib', format: 'esm', platform: 'node',
  clean: false, dts: false,
  external: [/^@deepseek-ai\//],
})
