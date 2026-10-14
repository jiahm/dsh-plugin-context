// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { TextEncoder } from 'node:util'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'

it('loads the published browser factory and reclaims every registration on unload', async () => {
  let definition: { id: string; factory: (require: (id: string) => unknown) => any } | undefined
  runInNewContext(readFileSync('packages/client/context-visualizer/lib/client.js', 'utf8'), {
    window: { __ModuleLoader__: { load: (value: typeof definition) => { definition = value } } },
    AbortController, AbortSignal, document, TextEncoder, setTimeout, clearTimeout,
  })
  expect(definition?.id).toBe('dsh-plugin-context-client')
  const module = definition!.factory(id => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return jsx
    throw new Error(`Unexpected browser external: ${id}`)
  })
  const root = new Context()
  const registrations = new Set<string>()
  const own = (id: string) => { registrations.add(id); return () => { registrations.delete(id) } }
  let props: { load: (seq: undefined, signal: AbortSignal) => Promise<unknown> } | undefined
  let command: any
  let pendingSignal: AbortSignal | undefined
  root.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (options: any) => {
      if (options.name === 'conversation.view') props = options.inject('bundle-test')
      return own(options.name)
    },
  })
  root.provide('locale', { register: () => own('locale'), bind: () => (key: string) => key })
  root.provide('connection', { rpc: { call: vi.fn(async (_channel, _endpoint, _payload, signal) => {
    pendingSignal = signal
    return { ok: true, value: null }
  }) } })
  const openTabIn = vi.fn()
  root.provide('sidebarRightTabs', { register: () => own('sidebar') })
  root.provide('sidebarRight', { openTabIn })
  root.provide('inputTriggers', { registerSource: (source: unknown) => { command = source; return own('command') } })
  const fiber = await root.plugin(module)
  try {
    await vi.waitFor(() => expect(registrations.size).toBe(5))
    expect(document.head.querySelector('style[data-context-visualizer]')).not.toBeNull()
    const claim = await command.matchEnter({ sessionId: 'bundle-test' }, '/context-viz')
    await claim.claim.submit()
    expect(openTabIn).toHaveBeenCalledWith('bundle-test', 'dsh-plugin-context-client')
    await props!.load(undefined, new AbortController().signal)
    expect(pendingSignal?.aborted).toBe(false)
  } finally {
    await fiber.dispose()
    await root.fiber.dispose()
  }
  expect(pendingSignal?.aborted).toBe(true)
  expect(registrations.size).toBe(0)
  expect(document.head.querySelector('style[data-context-visualizer]')).toBeNull()
})
