/** JSON-only RPC contract. The browser imports this file type-only. */
export type Category = 'system' | 'tools' | 'user' | 'injected' | 'assistant' | 'tool'

export interface ContextItem {
  id: string
  category: Category
  source: string
  tokens: number
  content: string
  truncated: boolean
}

export interface RequestPoint {
  seq: number
  turn: number
  step: number
  time: number
  model: string
  promptTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number
  status: 'completed' | 'interrupted' | 'attempt'
}

export interface ContextEvent {
  seq: number
  time: number
  kind: 'inject' | 'replace' | 'model' | 'compact' | 'prune'
  source: string
}

export interface ContextSnapshot {
  schemaVersion: 1
  sessionId: string
  parentSessionId: string | null
  asOfSeq: number
  selectedRequestSeq: number | null
  pressure: { tokens: number | null; capacity: number | null; kind: 'official' | 'estimated' }
  officialComposition: { system: number; tools: number; messages: number } | null
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
  composition: Record<Category, number>
  requests: RequestPoint[]
  events: ContextEvent[]
  items: ContextItem[]
  counts: { turns: number; steps: number; toolCalls: number; items: number }
  omitted: { requests: number; events: number; items: number }
}
