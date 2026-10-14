import { foldSurface, deriveEventMessage, foldRequestHeader } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionMessageProjection } from '@deepseek-ai/dsh-session'
import { estimateMessage, estimateToolsTokens } from '@deepseek-ai/dsh-token-meter/estimate'
import type { SessionObservation } from '@deepseek-ai/dsh-session-query'
import type { ContextPressureProjection, ContextBreakdownProjection, TokenUsageProjection } from '@deepseek-ai/dsh-token-meter'
import type { Category, ContextItem, ContextSnapshot, ContextEvent, RequestPoint } from './protocol.ts'

const MAX_ROWS = 200
const MAX_ITEMS = 100
const MAX_CONTENT = 1800
export const MAX_SNAPSHOT_BYTES = 512 * 1024

function categoryOf(role: string, source: string): Category {
  if (role === 'system') return 'system'
  if (role === 'assistant') return 'assistant'
  if (role === 'tool') return 'tool'
  if (role === 'user' && source === 'user') return 'user'
  return 'injected'
}

function item(id: string, category: Category, source: string, tokens: number, value: unknown): ContextItem {
  const text = JSON.stringify(value, null, 2) ?? ''
  return { id, category, source: source.slice(0, 128), tokens,
    content: text.slice(0, MAX_CONTENT), truncated: text.length > MAX_CONTENT }
}

/** Rebuild exactly one log cut; a historical request excludes its own reply. */
export async function buildSnapshot(
  observation: SessionObservation,
  projections: readonly SessionMessageProjection[],
  requestSeq: number | undefined,
  signal: AbortSignal,
): Promise<ContextSnapshot | null> {
  const log = observation.events
  const requests: RequestPoint[] = []
  const events: ContextEvent[] = []
  const turns = new Set<number>()
  const steps = new Set<string>()
  let toolCalls = 0
  let model = ''
  let cut = requestSeq === undefined ? log.length : -1
  let capacity: number | null = null
  let selectedCapacity: number | null = null
  let selectedFound = requestSeq === undefined

  for (let index = 0; index < log.length; index++) {
    if (index % 1000 === 0) {
      signal.throwIfAborted()
      if (index > 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
    const ev = log[index]
    if (ev.type === 'turn/start') turns.add(ev.data.turn)
    if (ev.type === 'step/start') steps.add(`${ev.data.turn}:${ev.data.step}`)
    if (ev.type === 'tool/call') toolCalls++
    if (ev.type === 'request/header') {
      const next = ev.data.header.config.model
      if (model !== '' && next !== model) events.push({ seq: ev.seq, time: ev.time, kind: 'model', source: next })
      model = next
    }
    if (ev.type === 'request/context') capacity = ev.data.contextWindow ?? null
    if (ev.type === 'assistant/message' || ev.type === 'assistant/attempt') {
      const usage = ev.type === 'assistant/message' ? ev.data.usage : undefined
      requests.push({ seq: ev.seq, time: ev.time, turn: ev.data.turn, step: ev.data.step, model: model.slice(0, 128),
        promptTokens: usage ? usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) : null,
        outputTokens: usage?.outputTokens ?? null, cacheReadTokens: usage?.cacheReadTokens ?? 0,
        status: ev.type === 'assistant/attempt' ? 'attempt' : ev.data.interrupted ? 'interrupted' : 'completed' })
      if (ev.seq === requestSeq) { cut = index; selectedFound = true; selectedCapacity = capacity }
    }
    if (ev.type === 'user/message' && ev.data.source.kind !== 'user') {
      events.push({ seq: ev.seq, time: ev.time, kind: 'inject', source: ev.data.source.kind.slice(0, 128) })
    }
    if (ev.surfaceOp && ev.surfaceOp !== 'append') {
      events.push({ seq: ev.seq, time: ev.time, kind: 'replace', source: `${ev.surfaceOp.startSeq}–${ev.surfaceOp.endSeq}` })
    }
    // Plugin-owned events remain raw log facts; no invented compaction payload.
    const type: string = ev.type
    if (type === 'compaction/end' || type === 'compaction/prune') {
      events.push({ seq: ev.seq, time: ev.time, kind: type === 'compaction/end' ? 'compact' : 'prune', source: type })
    }
  }
  if (!selectedFound) return null
  signal.throwIfAborted()
  const prefix: readonly SessionEvent[] = requestSeq === undefined ? log : log.slice(0, cut)
  const surface = foldSurface(prefix, projections)
  const header = foldRequestHeader(prefix)
  const composition: ContextSnapshot['composition'] = { system: 0, tools: estimateToolsTokens(header), user: 0, injected: 0, assistant: 0, tool: 0 }
  const items: ContextItem[] = []
  for (const tool of header?.tools ?? []) {
    items.push(item(`tool:${tool.name}`, 'tools', tool.name, estimateToolsTokens({ config: header!.config, tools: [tool] }), tool))
  }
  for (const seq of surface.nodes) {
    const message = deriveEventMessage(prefix[seq], surface.projectedMessages)
    if (!message) continue
    const category = categoryOf(message.role, message.source.kind)
    const tokens = estimateMessage(message)
    composition[category] += tokens
    items.push(item(`event:${seq}`, category, message.source.kind, tokens, message))
  }
  const values = observation.projections?.values
  const pressure = values?.contextPressure as ContextPressureProjection | undefined
  const breakdown = values?.contextBreakdown as ContextBreakdownProjection | undefined
  const usage = values?.tokenUsage as TokenUsageProjection | undefined
  const official = requestSeq === undefined && pressure?.projectedTokens !== undefined
  const estimated = Object.values(composition).reduce((sum, value) => sum + value, 0)
  const snapshot: ContextSnapshot = {
    schemaVersion: 1, sessionId: observation.header.id,
    parentSessionId: observation.header.parentSession ?? null,
    asOfSeq: observation.cursor, selectedRequestSeq: requestSeq ?? null,
    pressure: { tokens: official ? pressure!.projectedTokens! : estimated,
      capacity: requestSeq === undefined ? pressure?.contextWindow ?? capacity : selectedCapacity,
      kind: official ? 'official' : 'estimated' },
    officialComposition: requestSeq === undefined && breakdown ? {
      system: breakdown.systemTokens, tools: breakdown.toolsTokens, messages: breakdown.messageTokens,
    } : null,
    usage: { input: (usage?.uncachedInputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0),
      output: usage?.outputTokens ?? 0, cacheRead: usage?.cacheReadTokens ?? 0, cacheWrite: usage?.cacheWriteTokens ?? 0 },
    composition, requests: requests.slice(-MAX_ROWS), events: events.slice(-MAX_ROWS), items: items.slice(-MAX_ITEMS),
    counts: { turns: turns.size, steps: steps.size, toolCalls, items: items.length },
    omitted: { requests: Math.max(0, requests.length - MAX_ROWS), events: Math.max(0, events.length - MAX_ROWS), items: Math.max(0, items.length - MAX_ITEMS) },
  }
  // Enforce the complete serialized wire size, including multibyte content.
  const encoder = new TextEncoder()
  while (encoder.encode(JSON.stringify(snapshot)).byteLength > MAX_SNAPSHOT_BYTES && snapshot.items.length > 0) {
    snapshot.items.shift()
    snapshot.omitted.items++
  }
  return encoder.encode(JSON.stringify(snapshot)).byteLength <= MAX_SNAPSHOT_BYTES ? snapshot : null
}
