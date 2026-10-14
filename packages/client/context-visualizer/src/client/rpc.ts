import { z } from 'zod'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type { ContextSnapshot } from 'dsh-plugin-context-host/protocol'

const count = z.number().finite().nonnegative()
const categories = z.enum(['system', 'tools', 'user', 'injected', 'assistant', 'tool'])
const snapshotSchema = z.object({
  schemaVersion: z.literal(1), sessionId: z.string(), parentSessionId: z.string().nullable(),
  asOfSeq: z.number().int(), selectedRequestSeq: count.nullable(),
  pressure: z.object({ tokens: count.nullable(), capacity: count.nullable(), kind: z.enum(['official', 'estimated']) }),
  officialComposition: z.object({ system: count, tools: count, messages: count }).nullable(),
  usage: z.object({ input: count, output: count, cacheRead: count, cacheWrite: count }),
  composition: z.object({ system: count, tools: count, user: count, injected: count, assistant: count, tool: count }),
  requests: z.array(z.object({ seq: count, turn: count, step: count, time: count, model: z.string(),
    promptTokens: count.nullable(), outputTokens: count.nullable(), cacheReadTokens: count,
    status: z.enum(['completed', 'interrupted', 'attempt']) })).max(200),
  events: z.array(z.object({ seq: count, time: count, kind: z.enum(['inject', 'replace', 'model', 'compact', 'prune']), source: z.string() })).max(200),
  items: z.array(z.object({ id: z.string(), category: categories, source: z.string(), tokens: count,
    content: z.string().max(1800), truncated: z.boolean() })).max(100),
  counts: z.object({ turns: count, steps: count, toolCalls: count, items: count }),
  omitted: z.object({ requests: count, events: count, items: count }),
})

/** Failed, cancelled, malformed or misaddressed responses always become empty data. */
export async function loadSnapshot(
  rpc: ClientConnectionRpc, sessionId: string, requestSeq: number | undefined, signal: AbortSignal,
): Promise<ContextSnapshot | null> {
  try {
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)])
    const response = await rpc.call('/context-visualizer', 'snapshot', { sessionId, ...(requestSeq === undefined ? {} : { requestSeq }) }, boundedSignal)
    if (!response.ok || boundedSignal.aborted) return null
    const parsed = snapshotSchema.safeParse(response.value)
    if (!parsed.success || parsed.data.sessionId !== sessionId || parsed.data.selectedRequestSeq !== (requestSeq ?? null)) return null
    return parsed.data
  } catch { return null }
}
