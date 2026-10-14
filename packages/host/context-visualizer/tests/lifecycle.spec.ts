import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src/index.ts'
import { fixture } from './fixtures.ts'

describe('RPC boundary and lifetime', () => {
  it('returns empty data on errors and releases the observation and channel on unload', async () => {
    const root = new Context()
    const sample = fixture()
    let handler: Function | undefined
    const dispose = vi.fn(() => { handler = undefined })
    const observeSession = vi.fn(async () => sample.observation)
    root.provide('connection', { rpc: { handle: (_channel: string, fn: Function) => { handler = fn; return dispose } } })
    root.provide('webServer', {})
    root.provide('sessionQuery', { observeSession })
    root.provide('sessions', { messageProjections: [] })
    const fiber = await root.plugin(plugin)
    try {
      const signal = new AbortController().signal
      const response = await handler!('snapshot', { sessionId: 'context-fixture' }, signal)
      expect(response.ok).toBe(true)
      expect(response.value.pressure.tokens).toBe(777)
      expect(sample.wasDisposed()).toBe(true)
      observeSession.mockRejectedValueOnce(new Error('platform read failed'))
      expect(await handler!('snapshot', { sessionId: 'missing' }, signal)).toEqual({ ok: true, value: null })
      expect(await handler!('snapshot', { sessionId: '' }, signal)).toEqual({ ok: true, value: null })
      expect(await handler!('unknown', {}, signal)).toEqual({ ok: true, value: null })
    } finally {
      await fiber.dispose()
      await root.fiber.dispose()
    }
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(handler).toBeUndefined()
  })
})
