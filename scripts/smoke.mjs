import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const binary = process.argv[2] ?? process.env.DSH_BIN
assert(binary, 'Pass the DSH 0.2.0-rc.2 lib/bin.js path as the first argument or DSH_BIN.')
const root = fileURLToPath(new URL('../', import.meta.url))
const home = await mkdtemp(join(tmpdir(), 'dsh-context-smoke-'))
const env = { ...process.env, DSH_HOME: home }
const redact = text => text.replace(/token=[^\s"<>]+/g, 'token=[redacted]')
let host
async function command(args) {
  const child = spawn(process.execPath, [binary, ...args], { cwd: root, env })
  let output = ''
  const collect = chunk => { output = (output + chunk).slice(-16000) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const [code] = await once(child, 'exit')
  assert.equal(code, 0, redact(output))
  return output
}

try {
  assert.match(await command(['--version']), /0\.2\.0-rc\.2/)
  await command(['plugin', '--profile', 'web', 'add',
    join(root, 'artifacts/dsh-plugin-context-host-0.1.0.tgz'),
    join(root, 'artifacts/dsh-plugin-context-client-0.1.0.tgz')])
  const patch = join(home, 'seed.patch.yml')
  await writeFile(patch, `- insert:\n    - id: context-smoke-seed\n      name: ${JSON.stringify(join(root, 'tests/seed.mjs'))}\n`)
  host = spawn(process.execPath, [binary, 'web', '--patch', patch, '--no-open', '--port', '0'], { cwd: root, env })
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Startup timeout: ${redact(output)}`)), 30000)
    const collect = chunk => {
      output = (output + chunk).slice(-16000)
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)
      if (match) { clearTimeout(timer); resolve(match[0]) }
    }
    host.stdout.on('data', collect)
    host.stderr.on('data', collect)
    host.once('error', error => { clearTimeout(timer); reject(error) })
    host.once('exit', code => { clearTimeout(timer); reject(new Error(`Host exited ${code}: ${redact(output)}`)) })
  })
  const auth = await fetch(url, { redirect: 'manual' })
  assert.equal(auth.status, 303)
  const cookie = auth.headers.get('set-cookie')?.split(';')[0]
  assert(cookie)
  const base = new URL(url).origin
  async function snapshot(payload) {
    const response = await fetch(`${base}/context-visualizer/snapshot`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'snapshot', payload }),
      signal: AbortSignal.timeout(10000),
    })
    assert.equal(response.status, 200)
    const envelope = await response.json()
    assert.equal(envelope.result.ok, true)
    return envelope.result.value
  }
  const live = await snapshot({ sessionId: 'context-smoke' })
  assert.equal(live.sessionId, 'context-smoke')
  assert.equal(live.requests[0].promptTokens, 160)
  assert.equal(live.usage.input, 160)
  assert.equal(live.usage.output, 20)
  const historical = await snapshot({ sessionId: 'context-smoke', requestSeq: live.requests[0].seq })
  assert(historical.items.some(row => row.content.includes('original smoke question')))
  assert(!historical.items.some(row => row.content.includes('original smoke answer')))
  assert.equal(historical.pressure.kind, 'estimated')
  assert.equal(await snapshot({ sessionId: 'absent-smoke-session' }), null)
  const index = await (await fetch(base, { headers: { cookie } })).text()
  assert(index.includes('dsh-plugin-context-client'), 'Client module missing from actual boot manifest')
  console.log('PASS: packed plugins, real DSH composition, authenticated RPC, history, missing-session fallback, client manifest.')
} finally {
  if (host && host.exitCode === null) {
    const stopped = once(host, 'exit')
    host.kill('SIGINT')
    const timer = setTimeout(() => host.kill('SIGKILL'), 5000)
    await stopped
    clearTimeout(timer)
  }
  await rm(home, { recursive: true, force: true })
}
