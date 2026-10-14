import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { CommandClaim } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { Dashboard, type SnapshotInjected } from './Dashboard.tsx'
import { en, zh } from './locales.ts'
import { css } from './styles.ts'
import { loadSnapshot } from './rpc.ts'

export const inject = ['slots', 'locale', 'connection']
const NS = 'contextVisualizer'
const ID = 'dsh-plugin-context-client'

export function apply(ctx: Context): void {
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort() }, 'context-visualizer: requests')
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'context-visualizer: dictionaries')
  const t = ctx.locale.bind(NS)
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const propsFor = (sessionId: string): SnapshotInjected => ({
    load: (requestSeq, signal) => loadSnapshot(connection.rpc, sessionId, requestSeq, AbortSignal.any([lifetime.signal, signal])),
  })
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.contextVisualizer = ''
    style.textContent = css
    document.head.append(style)
    return () => { style.remove() }
  }, 'context-visualizer: styles')
  ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: ID, order: 25, locale: NS, label: () => t('title'), inject: propsFor,
  }, Dashboard)), 'context-visualizer: conversation tab')

  // The optional column may activate later or be absent in a custom web profile.
  ctx.effect(() => {
    const sidebar = ctx.inject(['sidebarRightTabs', 'sidebarRight'], c => {
      c.effect(() => c.sidebarRightTabs.register({
        id: ID, kind: ID, title: () => t('title'),
        guide: [{ id: ID, order: 25, title: () => t('title'), description: () => t('description') }],
      }), 'context-visualizer: sidebar type')
      c.effect(() => c.slots.inject('sidebar.right.pane.tab', () => c.slots.register({
        name: 'sidebar.right.pane.tab', key: ID, locale: NS, inject: propsFor,
      }, Dashboard)), 'context-visualizer: sidebar body')
      c.effect(() => {
        const commands = c.inject(['inputTriggers'], commandCtx => {
          const claimFor = (sessionId: Parameters<typeof c.sidebarRight.openTabIn>[0]): CommandClaim => ({
            name: 'context-viz', token: '/context-viz ', hint: t('commandHint'), attachments: false,
            submit: async () => {
              try { c.sidebarRight.openTabIn(sessionId, ID) } catch { /* Platform unavailable: empty result. */ }
              return { kind: 'success' }
            },
          })
          const source: InputTriggerSource = {
            trigger: '/', name: 'context-viz', order: 25, showGroupTitle: false,
            candidates: async (_session, request) => request.position === 'leading' && 'context-viz'.startsWith(request.query.trim().toLowerCase())
              ? [{ name: 'context-viz', label: t('command'), description: t('description') }] : [],
            onPick: pick => ({ claim: claimFor(pick.session.sessionId) }),
            matchEnter: async (session, line) => line === '/context-viz' ? { claim: claimFor(session.sessionId) } : undefined,
          }
          commandCtx.effect(() => commandCtx.inputTriggers.registerSource(source), 'context-visualizer: /context-viz')
        })
        return () => commands.dispose()
      }, 'context-visualizer: command service')
    })
    return () => sidebar.dispose()
  }, 'context-visualizer: optional sidebar')
}
