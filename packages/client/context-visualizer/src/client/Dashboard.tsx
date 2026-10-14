import { useEffect, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Category, ContextSnapshot } from 'dsh-plugin-context-host/protocol'

export interface SnapshotInjected {
  load(requestSeq: number | undefined, signal: AbortSignal): Promise<ContextSnapshot | null>
}
export type DashboardProps = Pick<ConvViewProps, 'sessionId'> & PropsLocale<'contextVisualizer'> & SnapshotInjected

const categories: Category[] = ['system', 'tools', 'user', 'injected', 'assistant', 'tool']

export function Dashboard({ sessionId, load, t }: DashboardProps) {
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestSeq, setRequestSeq] = useState<number>()
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>()

  useEffect(() => { setRequestSeq(undefined); setQuery(''); setCategory(undefined) }, [sessionId])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoading(true)
    const refresh = async () => {
      let value: ContextSnapshot | null = null
      try { value = await load(requestSeq, controller.signal) } catch { /* Unavailable platform: empty view. */ }
      if (controller.signal.aborted) return
      setSnapshot(value)
      setLoading(false)
      if (requestSeq === undefined) timer = setTimeout(() => { void refresh() }, 2000)
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [sessionId, load, requestSeq, revision])

  // A stale session or request cut is never painted during navigation.
  const data = snapshot?.sessionId === sessionId && snapshot.selectedRequestSeq === (requestSeq ?? null) ? snapshot : null
  const number = (value: number) => value.toLocaleString()
  const items = data?.items.filter(row => (!category || row.category === category) && `${row.source}\n${row.content}`.toLowerCase().includes(query.toLowerCase())) ?? []
  const total = data ? Object.values(data.composition).reduce((sum, value) => sum + value, 0) : 0
  const maxPrompt = Math.max(1, ...(data?.requests.map(row => row.promptTokens ?? 0) ?? []))

  return <div data-context-visualizer="" aria-label={t('title')}>
    <div className="cv-toolbar"><h2>{t('title')}</h2><button onClick={() => setRevision(value => value + 1)}>{t('refresh')}</button></div>
    {!data ? <p role="status">{loading ? t('loading') : t('empty')}</p> : <>
      <section className="cv-card">
        <h3>{t('current')}</h3>
        <div className="cv-metrics">
          <div className="cv-metric"><span className="cv-muted">{t(data.pressure.kind)}</span><strong>{number(data.pressure.tokens ?? 0)}</strong></div>
          {data.pressure.capacity !== null && <div className="cv-metric"><span className="cv-muted">{number(data.pressure.capacity)}</span><strong>{((data.pressure.tokens ?? 0) / Math.max(1, data.pressure.capacity) * 100).toFixed(1)}%</strong></div>}
        </div>
        {data.parentSessionId && <p className="cv-muted">{t('parent')}: {data.parentSessionId}</p>}
      </section>
      <section className="cv-card"><h3>{t('counts')}</h3><div className="cv-metrics">
        {([
          ['turns', data.counts.turns], ['steps', data.counts.steps], ['calls', data.counts.toolCalls],
          ['input', data.usage.input], ['output', data.usage.output], ['cache', data.usage.cacheRead],
        ] as const).map(([key, value]) => <div className="cv-metric" key={key}><span className="cv-muted">{t(key)}</span><strong>{number(value)}</strong></div>)}
      </div></section>
      <section className="cv-card"><h3>{t('composition')}</h3><div className="cv-composition">
        {categories.map(key => <div className="cv-category" key={key}><span>{t(key)}</span><div className="cv-track"><div className="cv-fill" style={{ width: `${data.composition[key] / Math.max(1, total) * 100}%` }} /></div><span>≈{number(data.composition[key])}</span></div>)}
      </div>
        {data.officialComposition && <p className="cv-muted">{t('officialComposition')}: {t('system')} ≈{number(data.officialComposition.system)} · {t('tools')} ≈{number(data.officialComposition.tools)} · {t('messages')} ≈{number(data.officialComposition.messages)}</p>}
        <p className="cv-muted">{t('approximate')}</p>
      </section>
      <section className="cv-card"><h3>{t('trend')}</h3>
        <button aria-pressed={requestSeq === undefined} onClick={() => setRequestSeq(undefined)}>{t('live')}</button>
        <div className="cv-trend" role="group" aria-label={t('choose')}>
          {data.requests.map(row => <button key={row.seq} aria-pressed={requestSeq === row.seq} aria-label={`${t('request')} ${row.turn}.${row.step} #${row.seq}`} title={`${row.model} · ${t(row.status)} · ${row.promptTokens === null ? t('noUsage') : number(row.promptTokens)}`} onClick={() => setRequestSeq(row.seq)}><span className="cv-bar" style={{ height: `${Math.max(3, (row.promptTokens ?? 0) / maxPrompt * 110)}px` }} /><span className="cv-muted">{row.step}</span></button>)}
        </div>
        {data.omitted.requests > 0 && <p className="cv-muted">{t('omitted')}: {data.omitted.requests}</p>}
      </section>
      <section className="cv-card"><h3>{t('browser')}</h3><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)} />
        <div className="cv-filters"><button aria-pressed={category === undefined} onClick={() => setCategory(undefined)}>{t('all')}</button>{categories.map(key => <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{t(key)}</button>)}</div>
        {items.map(row => <details key={row.id}><summary>{t(row.category)} · {row.source} · ≈{number(row.tokens)}</summary><pre>{row.content}</pre>{row.truncated && <span className="cv-muted">{t('truncated')}</span>}</details>)}
        {data.omitted.items > 0 && <p className="cv-muted">{t('omitted')}: {data.omitted.items}</p>}
      </section>
      <section className="cv-card"><h3>{t('events')}</h3>{data.events.map(row => <div className="cv-event" key={`${row.seq}:${row.kind}`}><time className="cv-muted">{new Date(row.time).toLocaleTimeString()}</time><span>{t(row.kind)}</span><span className="cv-muted">{row.source}</span></div>)}
        {data.omitted.events > 0 && <p className="cv-muted">{t('omitted')}: {data.omitted.events}</p>}
      </section>
    </>}
  </div>
}
