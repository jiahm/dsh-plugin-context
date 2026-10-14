// Test-only plugin: no provider/model request; real Session acceptance and publication.
export const inject = ['sessions']
export function apply(ctx) {
  ctx.effect(() => {
    const session = ctx.sessions.prepare('context-smoke', { meta: { cwd: process.cwd() } })
    const dispose = ctx.sessions.enter(session)
    try {
      ctx.sessions.announce(session)
      session.append('turn/start', { turn: 1 })
      session.append('step/start', { turn: 1, step: 1 })
      session.append('user/message', {
        id: 'smoke-user', role: 'user', source: { kind: 'user' },
        content: [{ type: 'text', text: 'original smoke question' }],
      }, { surfaceOp: 'append' })
      session.append('request/header', { reason: 'initial', header: {
        config: { provider: 'deepseek', model: 'deepseek-chat' },
      } })
      session.append('request/context', { provider: 'deepseek', model: 'deepseek-chat', contextWindow: 10000 })
      session.append('assistant/message', { turn: 1, step: 1, message: {
        id: 'smoke-reply', role: 'assistant', source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' },
        content: [{ type: 'text', text: 'original smoke answer' }],
      }, stream: [], usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 10 } }, { surfaceOp: 'append' })
      session.append('step/end', { turn: 1, step: 1 })
      return dispose
    } catch (error) {
      dispose()
      throw error
    }
  }, 'context-visualizer: smoke session')
}
