import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionObservation } from '@deepseek-ai/dsh-session-query'

/** Valid log emitted through the actual Session acceptance boundary. */
export function fixture() {
  const session = Session.create(SessionId('context-fixture'))
  const events: SessionEvent[] = []
  events.push(session.append('turn/start', { turn: 1 }))
  events.push(session.append('step/start', { turn: 1, step: 1 }))
  const system = session.append('system/message', { turn: 1, step: 1, message: {
    id: MessageId('system'), role: 'system', source: { kind: 'system-prompt' }, content: [{ type: 'text', text: 'You are a coding assistant.' }],
  } }, { surfaceOp: 'append' })
  events.push(system)
  const user = session.append('user/message', {
    id: MessageId('user'), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'original question' }],
  }, { surfaceOp: 'append' })
  events.push(user)
  events.push(session.append('request/header', { reason: 'initial', header: {
    config: { provider: 'deepseek', model: 'fixture-model' },
    tools: [{ name: 'read_file', description: 'Read a file.', parameters: { type: 'object', properties: {} } }],
  } }))
  events.push(session.append('request/context', { provider: 'deepseek', model: 'fixture-model', contextWindow: 10000 }))
  const reply = session.append('assistant/message', { turn: 1, step: 1, message: {
    id: MessageId('reply'), role: 'assistant', source: { kind: 'model', provider: 'deepseek', model: 'fixture-model' }, content: [{ type: 'text', text: 'original answer' }],
  }, stream: [], usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 10, reasoningTokens: 5 } }, { surfaceOp: 'append' })
  events.push(reply)
  events.push(session.append('step/end', { turn: 1, step: 1 }))
  const replacement = session.append('user/message', {
    id: MessageId('summary'), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'compacted summary' }],
  }, { surfaceOp: { op: 'replace', startSeq: user.seq, endSeq: reply.seq }, sourceEventSeqs: [user.seq, reply.seq] })
  events.push(replacement)
  let disposed = false
  const observation: SessionObservation = {
    source: 'live', header: session.header, inheritedEventCount: session.inheritedEventCount,
    events, cursor: events.at(-1)!.seq,
    projections: { asOfSeq: events.at(-1)!.seq, values: {
      contextPressure: { projectedTokens: 777, pressureTokens: 160, contextWindow: 10000 },
      contextBreakdown: { systemTokens: 20, toolsTokens: 30, messageTokens: 40 },
      tokenUsage: { uncachedInputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 10 },
    } },
    retain() { return this }, [Symbol.dispose]() { disposed = true },
  }
  return { session, events, observation, reply, wasDisposed: () => disposed }
}
