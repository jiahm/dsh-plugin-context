import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { buildSnapshot } from './snapshot.ts'

export const name = 'context-visualizer-host'
export const inject = ['connection', 'webServer', 'sessionQuery', 'sessions']

/** One authenticated read-only RPC channel, owned by this plugin's fiber. */
export function apply(ctx: Context): void {
  // rc.2's RPC getter carries Connection's shadow context. An explicit public
  // context property keeps webServer available there while retaining our fiber.
  const rpcContext = ctx.extend({ webServer: ctx.webServer })
  ctx.effect(() => rpcContext.connection.rpc.handle('/context-visualizer', async (endpoint, payload, signal) => {
    try {
      if (endpoint !== 'snapshot' || !payload || typeof payload !== 'object') return { ok: true, value: null }
      const { sessionId, requestSeq } = payload as { sessionId?: unknown; requestSeq?: unknown }
      if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 256) return { ok: true, value: null }
      if (requestSeq !== undefined && (typeof requestSeq !== 'number' || !Number.isSafeInteger(requestSeq) || requestSeq < 0)) return { ok: true, value: null }
      const observation = await ctx.sessionQuery.observeSession(SessionId(sessionId), { signal, projectionMode: 'all' })
      try {
        const value = await buildSnapshot(observation, ctx.sessions.messageProjections, requestSeq as number | undefined, signal)
        return { ok: true, value }
      } finally {
        observation[Symbol.dispose]()
      }
    } catch {
      return { ok: true, value: null }
    }
  }), 'context-visualizer: snapshot RPC')
}

export type * from './protocol.ts'
