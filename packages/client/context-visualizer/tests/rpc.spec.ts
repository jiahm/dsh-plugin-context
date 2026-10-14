import { expect, it, vi } from 'vitest'
import { loadSnapshot } from '../src/client/rpc.ts'

it('contains transport failures, platform errors and malformed snapshots', async () => {
  const call = vi.fn()
  const rpc = { call }
  const signal = new AbortController().signal
  call.mockRejectedValueOnce(new Error('offline'))
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  call.mockResolvedValueOnce({ ok: false, error: { code: 'missing', message: '' } })
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  call.mockResolvedValueOnce({ ok: true, value: { schemaVersion: 1, items: [null] } })
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  expect(call).toHaveBeenCalledWith('/context-visualizer', 'snapshot', { sessionId: 'test' }, expect.any(AbortSignal))
})
