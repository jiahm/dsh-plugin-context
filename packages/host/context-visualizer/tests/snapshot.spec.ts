import { describe, expect, it } from 'vitest'
import { buildSnapshot, MAX_SNAPSHOT_BYTES } from '../src/snapshot.ts'
import { fixture } from './fixtures.ts'

describe('context reconstruction', () => {
  it('removes shadowed messages, preserves official pressure and disjoint provider usage', async () => {
    const { observation } = fixture()
    const data = await buildSnapshot(observation, [], undefined, new AbortController().signal)
    expect(data?.items.some(row => row.content.includes('compacted summary'))).toBe(true)
    expect(data?.items.some(row => row.content.includes('original question'))).toBe(false)
    expect(data?.items.some(row => row.content.includes('original answer'))).toBe(false)
    expect(data?.pressure).toEqual({ tokens: 777, capacity: 10000, kind: 'official' })
    expect(data?.usage).toEqual({ input: 160, output: 20, cacheRead: 50, cacheWrite: 10 })
    expect(data?.requests[0].promptTokens).toBe(160)
    expect(data?.events.some(row => row.kind === 'replace')).toBe(true)
  })

  it('reconstructs historical input before the selected reply and before later compaction', async () => {
    const { observation, reply } = fixture()
    const data = await buildSnapshot(observation, [], reply.seq, new AbortController().signal)
    expect(data?.items.some(row => row.content.includes('original question'))).toBe(true)
    expect(data?.items.some(row => row.content.includes('original answer'))).toBe(false)
    expect(data?.items.some(row => row.content.includes('compacted summary'))).toBe(false)
    expect(data?.pressure.kind).toBe('estimated')
    expect(data?.officialComposition).toBeNull()
    expect(data?.items.some(row => row.category === 'tools')).toBe(true)
  })

  it('rejects a seq that is not a settled request', async () => {
    const { observation } = fixture()
    expect(await buildSnapshot(observation, [], 0, new AbortController().signal)).toBeNull()
  })

  it('honors cancellation without mutating the log', async () => {
    const { observation } = fixture()
    const before = JSON.stringify(observation.events)
    const controller = new AbortController()
    controller.abort()
    await expect(buildSnapshot(observation, [], undefined, controller.signal)).rejects.toThrow()
    expect(JSON.stringify(observation.events)).toBe(before)
  })

  it('bounds multibyte content in the complete serialized payload', async () => {
    const { observation, events } = fixture()
    // Large tool headers exercise the preview cap without altering message identities.
    const header = events.find(event => event.type === 'request/header')!
    const large = { ...header, data: { ...header.data, header: { ...header.data.header,
      tools: Array.from({ length: 150 }, (_, index) => ({ name: `工具${index}`, description: '中'.repeat(10000), parameters: { type: 'object' } })),
    } } }
    const bigObservation = { ...observation, events: events.map(event => event === header ? large : event) }
    const data = await buildSnapshot(bigObservation, [], undefined, new AbortController().signal)
    expect(new TextEncoder().encode(JSON.stringify(data)).byteLength).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES)
    expect(data!.omitted.items).toBeGreaterThan(0)
    expect(data!.items.length).toBeLessThan(100)
    expect(data!.items.every(row => row.content.length <= 1800)).toBe(true)
    expect(data!.items.some(row => row.truncated)).toBe(true)
  })
})
