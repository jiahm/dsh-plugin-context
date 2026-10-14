// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Dashboard, type DashboardProps } from '../src/client/Dashboard.tsx'
import { en } from '../src/client/locales.ts'
import { buildSnapshot } from '../../../host/context-visualizer/src/snapshot.ts'
import { fixture } from '../../../host/context-visualizer/tests/fixtures.ts'
import type { ContextSnapshot } from '../../../host/context-visualizer/src/protocol.ts'

afterEach(cleanup)
const t: DashboardProps['t'] = key => en[key as keyof typeof en] ?? key

it('shows context, searches content, switches requests and aborts when unmounted', async () => {
  const { observation, reply } = fixture()
  const live = await buildSnapshot(observation, [], undefined, new AbortController().signal)
  const historical = await buildSnapshot(observation, [], reply.seq, new AbortController().signal)
  const load = vi.fn(async (seq, _signal) => seq === undefined ? live : historical)
  const view = render(<Dashboard sessionId={observation.header.id} load={load} t={t} />)
  await screen.findByText('777')
  expect(screen.getByText('7.8%')).toBeDefined()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'does not exist' } })
  expect(view.container.querySelectorAll('details')).toHaveLength(0)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: `Request 1.1 #${reply.seq}` }))
  await waitFor(() => expect(view.container.textContent).toContain('original question'))
  expect(view.container.textContent).not.toContain('original answer')
  const signal = load.mock.calls.at(-1)![1]
  view.unmount()
  expect(signal.aborted).toBe(true)
})

it('shows an empty state when the platform has no data', async () => {
  render(<Dashboard sessionId={fixture().observation.header.id} load={async () => null} t={t} />)
  expect(await screen.findByRole('status')).toBeDefined()
  await screen.findByText(en.empty)
})

it('contains unexpected platform loader failures', async () => {
  render(<Dashboard sessionId={fixture().observation.header.id} load={async () => { throw new Error('offline') }} t={t} />)
  await screen.findByText(en.empty)
})

it('ignores an old session response arriving after navigation', async () => {
  const { observation } = fixture()
  const live = (await buildSnapshot(observation, [], undefined, new AbortController().signal))!
  let resolveOld!: (value: ContextSnapshot) => void
  const oldLoad = vi.fn((_seq, _signal) => new Promise<ContextSnapshot>(resolve => { resolveOld = resolve }))
  const view = render(<Dashboard sessionId={observation.header.id} load={oldLoad} t={t} />)
  const nextId = 'next-session' as DashboardProps['sessionId']
  const nextLoad = vi.fn(async () => ({ ...live, sessionId: nextId, pressure: { ...live.pressure, tokens: 888 } }))
  view.rerender(<Dashboard sessionId={nextId} load={nextLoad} t={t} />)
  await screen.findByText('888')
  expect(oldLoad.mock.calls[0][1].aborted).toBe(true)
  await act(async () => { resolveOld(live) })
  expect(screen.queryByText('777')).toBeNull()
  expect(screen.getByText('888')).toBeDefined()
})

it('waits for slow reads before polling again and cancels polling on unmount', async () => {
  vi.useFakeTimers()
  try {
    const { observation } = fixture()
    const live = (await buildSnapshot(observation, [], undefined, new AbortController().signal))!
    let resolveRead!: (value: ContextSnapshot) => void
    const load = vi.fn((_seq, _signal) => new Promise<ContextSnapshot>(resolve => { resolveRead = resolve }))
    const view = render(<Dashboard sessionId={observation.header.id} load={load} t={t} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => { resolveRead(live) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(load.mock.calls[1][1].aborted).toBe(true)
    await act(async () => { resolveRead(live); await vi.advanceTimersByTimeAsync(10000) })
    expect(load).toHaveBeenCalledTimes(2)
  } finally {
    cleanup()
    vi.useRealTimers()
  }
})
