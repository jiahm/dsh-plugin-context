# 完整源码：文件路径与内容

安装依赖后运行 `pnpm check`。根目录 `pnpm-lock.yaml` 为自动生成的锁文件，未重复展开。

## .gitignore

```text
node_modules/
**/lib/
**/*.tsbuildinfo
artifacts/
coverage/
```

## README.md

````markdown
# DeepSeek Harness 上下文可视化插件

适配 **DSH Desktop 2.0.17 内置的 `@deepseek-ai/dsh@0.2.0-rc.2`**。本项目是独立插件工作区，通过两个插件包扩展平台。

参考 [dsh-context](https://github.com/bowenliang123/dsh-context) 的上下文仪表盘、请求趋势、消息浏览器和事件视图组织方式。当前交付聚焦正在查看的会话，包含父会话标识。

## 1. 设计方案

居住形态：**Host + Client**。Session 日志和投影位于 Host，浏览器界面位于 Client，需要 RPC 通道连接。

```text
dsh-plugin-context/
├── packages/host/context-visualizer/
│   ├── src/index.ts              # apply、inject、RPC 注册与容错
│   ├── src/protocol.ts           # JSON 快照契约，Client 仅导入类型
│   ├── src/snapshot.ts           # Surface 还原、用量、估算与内容预览
│   ├── cordis.patch.yml          # Host bundle 行
│   ├── package.json
│   ├── tsconfig.json
│   └── tsdown.config.ts
├── packages/client/context-visualizer/
│   ├── src/index.ts              # 空的 Node companion
│   ├── src/client/index.ts       # 浏览器 apply、槽位、侧栏、命令
│   ├── src/client/Dashboard.tsx  # 纯 Props React 组件
│   ├── src/client/rpc.ts         # RPC、5 秒超时、Zod 边界校验
│   ├── src/client/locales.ts     # 中英文
│   ├── src/client/styles.ts      # 有作用域的主题样式
│   ├── cordis.patch.yml          # Client companion bundle 行
│   ├── package.json
│   ├── tsconfig.json
│   └── tsdown.config.ts
├── scripts/                     # 打包、完整源码清单、隔离运行时测试
├── tests/                       # 浏览器产物卸载测试、真实 Session 种子
├── tsconfig.host.json
├── tsconfig.client.json
└── pnpm-lock.yaml
```

数据流：

1. `conversation.view` 槽位按 `sessionId` 注入普通 `load()` 函数；组件不持有 Cordis Context。
2. Client 调用 `connection.rpc.call('/context-visualizer', 'snapshot', { sessionId, requestSeq? }, signal)`。
3. Host 用 `connection.rpc.handle()` 注册通道，通过 `sessionQuery.observeSession()` 获取日志及投影。
4. 用平台 `foldSurface()`、`deriveEventMessage()`、`foldRequestHeader()` 解释消息与替换，读取 token-meter 投影并估算分类占比。
5. 返回 JSON 快照；Host 在 `finally` 释放观察对象。Client 校验快照后绘制面板。

界面包含实时上下文占用、窗口比例、六类组成、会话累计用量、请求趋势、历史 Surface、来源与内容搜索，以及注入、替换、模型变更、压缩、裁剪事件。实时面板在一次读取完成后等待 2 秒刷新；历史选择只读取一次，也可手动刷新。

入口挂在会话“上下文”页签；有右侧栏和输入触发服务时，同时注册侧栏和 `/context-viz` 命令。缺少这两个可选服务时，会话页签仍可用。

生命周期：RPC、词典、样式、槽位、侧栏类型、命令和可选注入 Fiber 均由 `ctx.effect()` 管理。组件卸载或切换会话会取消读取并清除定时器，插件卸载会取消全部剩余读取。

版本细节：rc.2 的 Host RPC getter 带有 Cordis shadow context。入口声明 `webServer`，并用公开的 `ctx.extend({ webServer: ctx.webServer })` 给 RPC 注册上下文提供该服务；扩展上下文保留本插件的 Fiber。这一接法已在真实 rc.2 Web profile 验证。

### 数据口径与边界

- “官方投影 Token”来自 token-meter 的 `contextPressure.projectedTokens`，含平台对后续上下文的投影；没有该投影时显示估算值。
- 六类组成和历史占用是平台启发式估算，不能直接相加解释提供方计费值。
- 请求趋势使用每次 `assistant/message.usage`；输入为互斥的普通输入、缓存读取、缓存写入之和。推理 Token 已包含在输出中，不重复加。没有 usage 的尝试显示未知。
- 历史视图展示**所选回复提交前的日志 Surface**。日志没有逐请求完整序列化的网络输入，期间发生的异步注入可能与真正发送的输入存在差异；此视图用于追踪日志上下文。
- 会话累计值仍覆盖整个会话；切换历史选择影响占用、组成和浏览器，不改变会话总计与完整趋势。
- 最多显示最近 200 次请求、200 条事件、100 个上下文条目；每个内容预览最多 1800 个 UTF-16 代码单元。省略数量会显示在界面上。整个 JSON 快照最多 512 KiB。
- 图片和文件显示日志中的引用信息；搜索仅覆盖返回的内容预览。
- 读取、取消、超时、无会话、协议校验失败均返回空快照，界面显示空态。插件复用 DSH 的认证 RPC，不发起模型调用，也不写入会话日志。

API 核对依据：[architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[packages/AGENTS.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/AGENTS.md)、[adding-a-package.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)。公开文档用于确认架构；具体接口按 npm `0.2.0-rc.2` 声明和 Desktop 的同版本实际运行时核对。

## 2. 完整代码

源码已经按上述路径写入本仓库。[docs/SOURCE.md](docs/SOURCE.md) 汇总每个源代码、测试和配置文件的**路径及完整内容**，可直接逐文件复制。`pnpm-lock.yaml` 位于根目录，供可重复安装使用。

修改后运行 `pnpm source-book` 更新源码清单。

## 3. 接线清单

### 本插件工作区：已完成

根 `tsconfig.host.json` 的 references：

```json
{ "path": "./packages/host/context-visualizer" }
```

根 `tsconfig.client.json` 的 references：

```json
{ "path": "./packages/client/context-visualizer" }
```

Client 的 `tsconfig.json` 继承 `../../../tsconfig.base.client.json`，增加 Host 契约引用：

```json
{ "path": "../../host/context-visualizer" }
```

Host 的 `package.json`：

| 位置 | 依赖 |
| --- | --- |
| dependencies | `@deepseek-ai/dsh-token-meter@0.2.0-rc.2` |
| peerDependencies + devDependencies | `@deepseek-ai/cordis@4.0.4`；`@deepseek-ai/dsh-session`、`dsh-session-query`、`dsh-client-connection`、`dsh-host-webserver`，均为 `0.2.0-rc.2` |
| devDependencies | `@deepseek-ai/dsh-session-projection@0.2.0-rc.2`、`@deepseek-ai/dsh-llm@0.2.0-rc.2` |

Client 的 `package.json`：

| 位置 | 依赖/声明 |
| --- | --- |
| peerDependencies + devDependencies | `@deepseek-ai/cordis@4.0.4` |
| devDependencies | `dsh-plugin-context-host: workspace:*`，仅导入类型；`react@18.3.1`；`zod@^4.4.3` |
| devDependencies | `@deepseek-ai/dsh-client-connection`、`dsh-client-locale`、`dsh-client-ui-slots`、`dsh-client-ui-renderer`、`dsh-client-ui-session`、`dsh-client-ui-conversation`、`dsh-client-ui-sidebar-right`、`dsh-client-ui-input-trigger`，均为 `0.2.0-rc.2` |
| dsh.client | `platform: "web"`，`inject` 声明 Connection、Locale、Conversation、Sidebar Right 的 Client 包 |

浏览器 tsdown 输出 `window.__ModuleLoader__.load({ id, factory })` 闭包产物。React 与 JSX runtime 由平台模块表提供；Zod 打进浏览器产物，因此部署时不额外安装浏览器依赖。

两个包各自声明 `dsh.bundle.patch: "./cordis.patch.yml"`，patch 内容分别为：

```yaml
- insert:
    - id: context-visualizer-host
      name: dsh-plugin-context-host
```

```yaml
- insert:
    - id: context-visualizer-client
      name: dsh-plugin-context-client
```

### 接到 DSH profile / 定制 bundle

安装下面两个 tarball 后，DSH 插件管理会把包纳入 profile 的 bundle 组合，应用各包 patch；无需重复手工插入同一 ID。

若维护自定义 bundle：在该 bundle 的 `package.json.dependencies` 加两个包的已发布版本或本地 `file:` tarball，并在该 bundle 的 patch 加上面的两行插件注册。已打包外部插件无需在 DSH 的 tsconfig 中增加源码引用。

若将源码迁入官方 monorepo，需遵守所用分支的 `packages/AGENTS.md` 包命名规则，并同步包名、Client 产物 ID、patch 和契约导入；Client 改用该分支的 `packages/client/tsdown.client.ts` 公共预设。不要直接用当前 master 编译配置代替 rc.2 的配置。本交付采用独立工作区打包安装，运行时接线已经验证。

## 4. 构建与测试

本次验证环境为 Node.js 25.8.0、pnpm 10.28.0。在本仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm pack:plugins
pnpm source-book
```

`pnpm check` 执行 Host/Client 类型检查、浏览器和 Node 打包、测试代码类型检查、Vitest。`pnpm test` 需要已有的 `lib/client.js`，首次运行先 `pnpm build`。

macOS 上针对 Desktop 2.0.17 的真实运行时测试：

```bash
pnpm test:smoke '/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js'
```

其他环境将参数换成 `@deepseek-ai/dsh@0.2.0-rc.2` 的 `lib/bin.js` 绝对路径。脚本会校验版本、创建临时 `DSH_HOME`、安装两个 tarball、加载 Web profile 和测试种子、检查认证 RPC、历史视图、空数据与 Client 启动清单，最后停止进程并删除临时目录。它不会修改现有 DSH_HOME，不请求模型。

输出安装包：

```text
artifacts/dsh-plugin-context-host-0.1.0.tgz
artifacts/dsh-plugin-context-client-0.1.0.tgz
```

验证记录见 [docs/VALIDATION.md](docs/VALIDATION.md)。

## 5. 启动、使用、停止、卸载

### Desktop 2.0.17 安装与启动

先启动 Desktop 一次，让它初始化 profile，然后完全退出应用。macOS 在仓库根目录运行以下函数，使用 Desktop 的 profile 管理入口：

```bash
dsh_desktop() {
  node '/Applications/DSH Desktop.app/Contents/Resources/app/lib/desktop-cli.js' "$@"
}

dsh_desktop --version
# 应显示 0.2.0-rc.2，这是内置 DSH 的版本。

dsh_desktop plugin --profile desktop add \
  "$PWD/artifacts/dsh-plugin-context-host-0.1.0.tgz" \
  "$PWD/artifacts/dsh-plugin-context-client-0.1.0.tgz"
```

若 Desktop 使用了自定义 profile，将 `desktop` 换成当前 profile 名。`desktop` profile 是 Electron 管理的保留名称，普通 npm DSH 的 CLI 不支持管理它；请使用上面的 `lib/desktop-cli.js`。其他操作系统使用其 Desktop 安装目录内对应入口。

重新启动 Desktop，打开一个会话，选择“上下文”页签；也可输入 `/context-viz` 并按 Enter 打开右侧栏。命令由输入触发器处理，不发送模型请求。点趋势柱选择历史日志 Surface，点“实时 · 下一次请求”返回实时；用类别按钮和搜索框筛选内容。

### 独立 Web profile

下面命令使用匹配的官方 DSH npm 版本，安装到 `web` profile 并启动：

```bash
pnpm --package=@deepseek-ai/dsh@0.2.0-rc.2 dlx dsh plugin --profile web add \
  "$PWD/artifacts/dsh-plugin-context-host-0.1.0.tgz" \
  "$PWD/artifacts/dsh-plugin-context-client-0.1.0.tgz"

pnpm --package=@deepseek-ai/dsh@0.2.0-rc.2 dlx dsh web
```

打开启动输出中的认证 URL。如果本机全局 `dsh --version` 是 `0.1.x`，继续使用上述固定版本命令。

### 停止和卸载

- 关闭上下文页或侧栏会停止该视图轮询并取消请求。
- 在 Desktop 的插件管理界面禁用这两个包，按界面提示重载/重启；Web 进程用 `Ctrl-C` 停止。
- 卸载 Desktop 插件前完全退出应用，然后执行：

```bash
dsh_desktop plugin --profile desktop remove dsh-plugin-context-client dsh-plugin-context-host
```

Web 卸载：

```bash
pnpm --package=@deepseek-ai/dsh@0.2.0-rc.2 dlx dsh plugin --profile web remove \
  dsh-plugin-context-client dsh-plugin-context-host
```

重新启动对应 profile，页签、侧栏和命令将消失。插件没有创建自己的持久化会话数据。
````

## package.json

```json
{
  "name": "dsh-plugin-context-workspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.28.0",
  "scripts": {
    "typecheck": "tsc -b tsconfig.host.json tsconfig.client.json",
    "build": "pnpm typecheck && pnpm -r bundle",
    "test": "vitest run",
    "check": "pnpm build && pnpm typecheck:tests && pnpm test",
    "pack:plugins": "pnpm build && node scripts/pack.mjs",
    "source-book": "node scripts/source-book.mjs",
    "test:smoke": "node scripts/smoke.mjs",
    "typecheck:tests": "tsc -p tsconfig.tests.json"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/cordis-plugin-loader": "1.0.5",
    "@deepseek-ai/dsh-scope": "0.2.0-rc.2",
    "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
    "@testing-library/react": "16.3.0",
    "@testing-library/dom": "10.4.1",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^26.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tsdown": "0.15.12",
    "typescript": "5.9.3",
    "vitest": "3.2.4"
  }
}
```

## packages/client/context-visualizer/README.md

```markdown
# dsh-plugin-context-client

DSH 0.2.0-rc.2 上下文面板。与 `dsh-plugin-context-host` 一起安装。

在会话页选择“上下文”，或输入 `/context-viz` 打开右侧面板。
支持实时占用、组成估算、请求趋势、历史请求输入、消息搜索和上下文事件。
右侧栏和输入命令是可选服务；会话页槽位不依赖它们。

完整使用与接线说明见项目根目录 README.md。
```

## packages/client/context-visualizer/cordis.patch.yml

```yaml
- insert:
    - id: context-visualizer-client
      name: dsh-plugin-context-client
```

## packages/client/context-visualizer/package.json

```json
{
  "name": "dsh-plugin-context-client",
  "version": "0.1.0",
  "description": "Context dashboard, browser and sidebar for DeepSeek Harness",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/client.js", "lib/types/**/*.d.ts", "cordis.patch.yml", "README.md"],
  "scripts": { "bundle": "tsdown", "build": "tsc -b && tsdown" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-connection", "@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-conversation", "@deepseek-ai/dsh-client-ui-sidebar-right"]
    }
  },
  "peerDependencies": { "@deepseek-ai/cordis": "4.0.4" },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/dsh-client-connection": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-locale": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-slots": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-renderer": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-session": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-conversation": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-sidebar-right": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-input-trigger": "0.2.0-rc.2",
    "dsh-plugin-context-host": "workspace:*",
    "react": "18.3.1",
    "zod": "^4.4.3"
  }
}
```

## packages/client/context-visualizer/src/client/Dashboard.tsx

```tsx
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
```

## packages/client/context-visualizer/src/client/index.ts

```typescript
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
```

## packages/client/context-visualizer/src/client/locales.ts

```typescript
export const en = {
  title: 'Context', description: 'Inspect context composition, requests and messages.',
  refresh: 'Refresh', loading: 'Loading context…', empty: 'No context data is available.',
  live: 'Live · next request', current: 'Current context', estimated: 'Estimated tokens', official: 'Official projected tokens',
  turns: 'Turns', steps: 'Steps', calls: 'Tool calls', input: 'Billed input', output: 'Billed output',
  cache: 'Cache read', composition: 'Estimated composition', officialComposition: 'Official composition estimate',
  messages: 'Messages', system: 'System prompt', tools: 'Tool schemas', user: 'User messages',
  injected: 'Injected context', assistant: 'Assistant replies', tool: 'Tool results',
  trend: 'Request trend · provider input tokens', noUsage: 'No provider usage', request: 'Request',
  browser: 'Context browser', search: 'Search source and content', all: 'All categories',
  events: 'Context events', inject: 'Injection', replace: 'Surface replacement', model: 'Model change',
  compact: 'Compaction', prune: 'Pruning', truncated: 'Content preview truncated',
  omitted: 'Older rows omitted', parent: 'Parent session', approximate: 'Composition is heuristic; it does not equal provider billing. Historical views reconstruct the logged input before a reply; image/file payloads are shown as references.',
  command: 'Open context sidebar', commandHint: 'Press Enter to inspect this session’s context.',
  completed: 'Completed', interrupted: 'Interrupted', attempt: 'Uncommitted attempt',
  choose: 'Choose a request', counts: 'Session totals',
} as const

export type LocaleKey = keyof typeof en
export const zh: Record<LocaleKey, string> = {
  title: '上下文', description: '查看上下文组成、请求和消息详情。',
  refresh: '刷新', loading: '正在读取上下文…', empty: '暂无可用的上下文数据。',
  live: '实时 · 下一次请求', current: '当前上下文', estimated: '估算 Token', official: '官方投影 Token',
  turns: '轮次', steps: '步骤', calls: '工具调用', input: '计费输入', output: '计费输出',
  cache: '缓存读取', composition: '估算组成', officialComposition: '官方组成估算',
  messages: '消息', system: '系统提示', tools: '工具 Schema', user: '用户消息',
  injected: '注入上下文', assistant: '助手回复', tool: '工具结果',
  trend: '请求趋势 · 提供方输入 Token', noUsage: '无提供方用量', request: '请求',
  browser: '上下文浏览器', search: '搜索来源和内容', all: '全部分类',
  events: '上下文事件', inject: '注入', replace: 'Surface 替换', model: '模型变更',
  compact: '压缩', prune: '裁剪', truncated: '内容预览已截断',
  omitted: '已省略较早的行', parent: '父会话', approximate: '组成使用启发式估算，不等于提供方计费值。历史视图重建回复前的日志输入；图片和文件显示引用信息。',
  command: '打开上下文侧栏', commandHint: '按 Enter 查看当前会话的上下文。',
  completed: '已完成', interrupted: '已中断', attempt: '未提交的尝试',
  choose: '选择请求', counts: '会话总计',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { contextVisualizer: LocaleKey }
}
```

## packages/client/context-visualizer/src/client/rpc.ts

```typescript
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
```

## packages/client/context-visualizer/src/client/styles.ts

```typescript
/** All rules are scoped to the plugin; colors use the host's semantic tokens. */
export const css = `
[data-context-visualizer] { color: var(--dsw-alias-label-primary); padding: 16px; height: 100%; overflow: auto; font: 13px/1.6 var(--dsw-font-family); box-sizing: border-box; }
[data-context-visualizer] * { box-sizing: border-box; }
[data-context-visualizer] h2 { margin: 0; font-size: 17px; font-weight: 600; }
[data-context-visualizer] h3 { margin: 0 0 12px; font-size: 14px; font-weight: 500; }
[data-context-visualizer] .cv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
[data-context-visualizer] .cv-card { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
[data-context-visualizer] .cv-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
[data-context-visualizer] .cv-metric { display: flex; flex-direction: column; gap: 4px; }
[data-context-visualizer] .cv-metric strong { font-size: 20px; font-variant-numeric: tabular-nums; font-weight: 600; }
[data-context-visualizer] .cv-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
[data-context-visualizer] button, [data-context-visualizer] input { font: inherit; color: inherit; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); padding: 6px 10px; border-radius: 8px; }
[data-context-visualizer] button { cursor: pointer; }
[data-context-visualizer] button:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-context-visualizer] button[aria-pressed="true"] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }
[data-context-visualizer] button:focus-visible, [data-context-visualizer] input:focus-visible, [data-context-visualizer] summary:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
[data-context-visualizer] .cv-filters { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
[data-context-visualizer] input { width: 100%; }
[data-context-visualizer] .cv-composition { display: grid; gap: 8px; }
[data-context-visualizer] .cv-category { display: grid; grid-template-columns: 110px 1fr 64px; align-items: center; gap: 8px; }
[data-context-visualizer] .cv-track { height: 7px; border-radius: 5px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); }
[data-context-visualizer] .cv-fill { height: 100%; min-width: 1px; background: var(--dsw-alias-brand-primary); }
[data-context-visualizer] .cv-trend { display: flex; gap: 4px; height: 150px; align-items: end; overflow-x: auto; padding: 8px 0; }
[data-context-visualizer] .cv-trend button { min-width: 28px; padding: 0; height: 100%; background: transparent; border: 0; display: flex; flex-direction: column; align-items: stretch; justify-content: end; gap: 4px; }
[data-context-visualizer] .cv-bar { background: var(--dsw-alias-brand-primary); border-radius: 4px 4px 0 0; min-height: 3px; opacity: .6; }
[data-context-visualizer] .cv-trend button[aria-pressed="true"] .cv-bar { opacity: 1; }
[data-context-visualizer] details { border-top: 1px solid var(--dsw-alias-border-l2); padding: 8px 0; }
[data-context-visualizer] summary { cursor: pointer; overflow-wrap: anywhere; }
[data-context-visualizer] pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 280px; overflow: auto; font: 12px/1.6 var(--ds-font-family-code); }
[data-context-visualizer] .cv-event { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
`
```

## packages/client/context-visualizer/src/index.ts

```typescript
import type { Context } from '@deepseek-ai/cordis'

export const inject: string[] = []

/** Node companion: browser capabilities are registered by the ./client entry. */
export function apply(_ctx: Context): void {}
```

## packages/client/context-visualizer/tests/dashboard.spec.tsx

```tsx
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
```

## packages/client/context-visualizer/tests/rpc.spec.ts

```typescript
import { expect, it, vi } from 'vitest'
import { loadSnapshot } from '../src/client/rpc.ts'

it('contains transport failures, platform errors and malformed snapshots', async () => {
  const call = vi.fn()
  const rpc = { call }
  const signal = new AbortController().signal
  call.mockRejectedValueOnce(new Error('offline'))
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  call.mockResolvedValueOnce({ ok: false, error: { code: 'missing', message: '' } })
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  call.mockResolvedValueOnce({ ok: true, value: { schemaVersion: 1, items: [null] } })
  expect(await loadSnapshot(rpc, 'test', undefined, signal)).toBeNull()
  expect(call).toHaveBeenCalledWith('/context-visualizer', 'snapshot', { sessionId: 'test' }, expect.any(AbortSignal))
})
```

## packages/client/context-visualizer/tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.client.json",
  "compilerOptions": { "rootDir": "src", "outDir": "lib/types" },
  "references": [{ "path": "../../host/context-visualizer" }],
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

## packages/client/context-visualizer/tsdown.config.ts

```typescript
import { defineConfig } from 'tsdown'

// The external-workspace equivalent of DSH's packages/client/tsdown.client.ts.
export default defineConfig([
  { entry: { index: 'src/index.ts' }, outDir: 'lib', format: 'esm', platform: 'node', clean: false, dts: false },
  {
    entry: { client: 'src/client/index.ts' }, outDir: 'lib', format: 'cjs', platform: 'browser',
    clean: false, dts: false, external: ['react', 'react/jsx-runtime'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-context-client", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
```

## packages/host/context-visualizer/README.md

```markdown
# dsh-plugin-context-host

为 DSH 0.2.0-rc.2 提供只读上下文快照 RPC。与 `dsh-plugin-context-client` 一起安装。

入口为具名 `apply(ctx)`；依赖 `connection`、`webServer`、`sessionQuery`、`sessions` 服务。
`/context-visualizer/snapshot` 使用 DSH 已有的浏览器认证，不开放独立服务器。
所有失败返回空快照，卸载时回收通道，读取结束时释放 SessionObservation。

完整使用与接线说明见项目根目录 README.md。
```

## packages/host/context-visualizer/cordis.patch.yml

```yaml
- insert:
    - id: context-visualizer-host
      name: dsh-plugin-context-host
```

## packages/host/context-visualizer/package.json

```json
{
  "name": "dsh-plugin-context-host",
  "version": "0.1.0",
  "description": "Read-only context snapshots for DeepSeek Harness",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./protocol": { "types": "./lib/types/protocol.d.ts" },
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/types/**/*.d.ts", "cordis.patch.yml", "README.md"],
  "scripts": { "bundle": "tsdown", "build": "tsc -b && tsdown" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "dependencies": { "@deepseek-ai/dsh-token-meter": "0.2.0-rc.2" },
  "peerDependencies": {
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/dsh-session": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-query": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-connection": "0.2.0-rc.2",
    "@deepseek-ai/dsh-host-webserver": "0.2.0-rc.2"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/dsh-session": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-query": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-connection": "0.2.0-rc.2",
    "@deepseek-ai/dsh-host-webserver": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-projection": "0.2.0-rc.2",
    "@deepseek-ai/dsh-llm": "0.2.0-rc.2"
  }
}
```

## packages/host/context-visualizer/src/index.ts

```typescript
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
```

## packages/host/context-visualizer/src/protocol.ts

```typescript
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
```

## packages/host/context-visualizer/src/snapshot.ts

```typescript
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
```

## packages/host/context-visualizer/tests/fixtures.ts

```typescript
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
```

## packages/host/context-visualizer/tests/lifecycle.spec.ts

```typescript
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src/index.ts'
import { fixture } from './fixtures.ts'

describe('RPC boundary and lifetime', () => {
  it('returns empty data on errors and releases the observation and channel on unload', async () => {
    const root = new Context()
    const sample = fixture()
    let handler: Function | undefined
    const dispose = vi.fn(() => { handler = undefined })
    const observeSession = vi.fn(async () => sample.observation)
    root.provide('connection', { rpc: { handle: (_channel: string, fn: Function) => { handler = fn; return dispose } } })
    root.provide('webServer', {})
    root.provide('sessionQuery', { observeSession })
    root.provide('sessions', { messageProjections: [] })
    const fiber = await root.plugin(plugin)
    try {
      const signal = new AbortController().signal
      const response = await handler!('snapshot', { sessionId: 'context-fixture' }, signal)
      expect(response.ok).toBe(true)
      expect(response.value.pressure.tokens).toBe(777)
      expect(sample.wasDisposed()).toBe(true)
      observeSession.mockRejectedValueOnce(new Error('platform read failed'))
      expect(await handler!('snapshot', { sessionId: 'missing' }, signal)).toEqual({ ok: true, value: null })
      expect(await handler!('snapshot', { sessionId: '' }, signal)).toEqual({ ok: true, value: null })
      expect(await handler!('unknown', {}, signal)).toEqual({ ok: true, value: null })
    } finally {
      await fiber.dispose()
      await root.fiber.dispose()
    }
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(handler).toBeUndefined()
  })
})
```

## packages/host/context-visualizer/tests/snapshot.spec.ts

```typescript
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
```

## packages/host/context-visualizer/tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "lib/types" },
  "include": ["src/**/*.ts"]
}
```

## packages/host/context-visualizer/tsdown.config.ts

```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'], outDir: 'lib', format: 'esm', platform: 'node',
  clean: false, dts: false,
  external: [/^@deepseek-ai\//],
})
```

## pnpm-workspace.yaml

```yaml
packages:
  - packages/*/*
autoInstallPeers: false
```

## scripts/pack.mjs

```javascript
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const destination = fileURLToPath(new URL('artifacts/', root))
mkdirSync(destination, { recursive: true })
for (const directory of ['packages/host/context-visualizer/', 'packages/client/context-visualizer/']) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: fileURLToPath(new URL(directory, root)), stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
```

## scripts/smoke.mjs

```javascript
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const binary = process.argv[2] ?? process.env.DSH_BIN
assert(binary, 'Pass the DSH 0.2.0-rc.2 lib/bin.js path as the first argument or DSH_BIN.')
const root = fileURLToPath(new URL('../', import.meta.url))
const home = await mkdtemp(join(tmpdir(), 'dsh-context-smoke-'))
const env = { ...process.env, DSH_HOME: home }
const redact = text => text.replace(/token=[^\s"<>]+/g, 'token=[redacted]')
let host
async function command(args) {
  const child = spawn(process.execPath, [binary, ...args], { cwd: root, env })
  let output = ''
  const collect = chunk => { output = (output + chunk).slice(-16000) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const [code] = await once(child, 'exit')
  assert.equal(code, 0, redact(output))
  return output
}

try {
  assert.match(await command(['--version']), /0\.2\.0-rc\.2/)
  await command(['plugin', '--profile', 'web', 'add',
    join(root, 'artifacts/dsh-plugin-context-host-0.1.0.tgz'),
    join(root, 'artifacts/dsh-plugin-context-client-0.1.0.tgz')])
  const patch = join(home, 'seed.patch.yml')
  await writeFile(patch, `- insert:\n    - id: context-smoke-seed\n      name: ${JSON.stringify(join(root, 'tests/seed.mjs'))}\n`)
  host = spawn(process.execPath, [binary, 'web', '--patch', patch, '--no-open', '--port', '0'], { cwd: root, env })
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Startup timeout: ${redact(output)}`)), 30000)
    const collect = chunk => {
      output = (output + chunk).slice(-16000)
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)
      if (match) { clearTimeout(timer); resolve(match[0]) }
    }
    host.stdout.on('data', collect)
    host.stderr.on('data', collect)
    host.once('error', error => { clearTimeout(timer); reject(error) })
    host.once('exit', code => { clearTimeout(timer); reject(new Error(`Host exited ${code}: ${redact(output)}`)) })
  })
  const auth = await fetch(url, { redirect: 'manual' })
  assert.equal(auth.status, 303)
  const cookie = auth.headers.get('set-cookie')?.split(';')[0]
  assert(cookie)
  const base = new URL(url).origin
  async function snapshot(payload) {
    const response = await fetch(`${base}/context-visualizer/snapshot`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'snapshot', payload }),
      signal: AbortSignal.timeout(10000),
    })
    assert.equal(response.status, 200)
    const envelope = await response.json()
    assert.equal(envelope.result.ok, true)
    return envelope.result.value
  }
  const live = await snapshot({ sessionId: 'context-smoke' })
  assert.equal(live.sessionId, 'context-smoke')
  assert.equal(live.requests[0].promptTokens, 160)
  assert.equal(live.usage.input, 160)
  assert.equal(live.usage.output, 20)
  const historical = await snapshot({ sessionId: 'context-smoke', requestSeq: live.requests[0].seq })
  assert(historical.items.some(row => row.content.includes('original smoke question')))
  assert(!historical.items.some(row => row.content.includes('original smoke answer')))
  assert.equal(historical.pressure.kind, 'estimated')
  assert.equal(await snapshot({ sessionId: 'absent-smoke-session' }), null)
  const index = await (await fetch(base, { headers: { cookie } })).text()
  assert(index.includes('dsh-plugin-context-client'), 'Client module missing from actual boot manifest')
  console.log('PASS: packed plugins, real DSH composition, authenticated RPC, history, missing-session fallback, client manifest.')
} finally {
  if (host && host.exitCode === null) {
    const stopped = once(host, 'exit')
    host.kill('SIGINT')
    const timer = setTimeout(() => host.kill('SIGKILL'), 5000)
    await stopped
    clearTimeout(timer)
  }
  await rm(home, { recursive: true, force: true })
}
```

## scripts/source-book.mjs

```javascript
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['node_modules', 'lib', 'artifacts', 'docs', '.git', 'coverage'])
const files = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (entry.isFile() && entry.name !== 'pnpm-lock.yaml' && !entry.name.endsWith('.tsbuildinfo')) files.push(path)
  }
}
await collect(root)
const sections = ['# 完整源码：文件路径与内容', '', '安装依赖后运行 `pnpm check`。根目录 `pnpm-lock.yaml` 为自动生成的锁文件，未重复展开。', '']
for (const path of files.sort()) {
  const language = { '.ts': 'typescript', '.tsx': 'tsx', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.mjs': 'javascript', '.md': 'markdown' }[extname(path)] ?? 'text'
  const content = await readFile(path, 'utf8')
  const fences = content.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...fences.map(value => value.length + 1)))
  sections.push(`## ${relative(root, path)}`, '', `${fence}${language}`, content.trimEnd(), fence, '')
}
await mkdir(join(root, 'docs'), { recursive: true })
await writeFile(join(root, 'docs/SOURCE.md'), sections.join('\n'))
console.log(`docs/SOURCE.md: ${files.length} complete files`)
```

## tests/browser-bundle.spec.ts

```typescript
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { TextEncoder } from 'node:util'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'

it('loads the published browser factory and reclaims every registration on unload', async () => {
  let definition: { id: string; factory: (require: (id: string) => unknown) => any } | undefined
  runInNewContext(readFileSync('packages/client/context-visualizer/lib/client.js', 'utf8'), {
    window: { __ModuleLoader__: { load: (value: typeof definition) => { definition = value } } },
    AbortController, AbortSignal, document, TextEncoder, setTimeout, clearTimeout,
  })
  expect(definition?.id).toBe('dsh-plugin-context-client')
  const module = definition!.factory(id => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return jsx
    throw new Error(`Unexpected browser external: ${id}`)
  })
  const root = new Context()
  const registrations = new Set<string>()
  const own = (id: string) => { registrations.add(id); return () => { registrations.delete(id) } }
  let props: { load: (seq: undefined, signal: AbortSignal) => Promise<unknown> } | undefined
  let command: any
  let pendingSignal: AbortSignal | undefined
  root.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (options: any) => {
      if (options.name === 'conversation.view') props = options.inject('bundle-test')
      return own(options.name)
    },
  })
  root.provide('locale', { register: () => own('locale'), bind: () => (key: string) => key })
  root.provide('connection', { rpc: { call: vi.fn(async (_channel, _endpoint, _payload, signal) => {
    pendingSignal = signal
    return { ok: true, value: null }
  }) } })
  const openTabIn = vi.fn()
  root.provide('sidebarRightTabs', { register: () => own('sidebar') })
  root.provide('sidebarRight', { openTabIn })
  root.provide('inputTriggers', { registerSource: (source: unknown) => { command = source; return own('command') } })
  const fiber = await root.plugin(module)
  try {
    await vi.waitFor(() => expect(registrations.size).toBe(5))
    expect(document.head.querySelector('style[data-context-visualizer]')).not.toBeNull()
    const claim = await command.matchEnter({ sessionId: 'bundle-test' }, '/context-viz')
    await claim.claim.submit()
    expect(openTabIn).toHaveBeenCalledWith('bundle-test', 'dsh-plugin-context-client')
    await props!.load(undefined, new AbortController().signal)
    expect(pendingSignal?.aborted).toBe(false)
  } finally {
    await fiber.dispose()
    await root.fiber.dispose()
  }
  expect(pendingSignal?.aborted).toBe(true)
  expect(registrations.size).toBe(0)
  expect(document.head.querySelector('style[data-context-visualizer]')).toBeNull()
})
```

## tests/seed.mjs

```javascript
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
```

## tsconfig.base.client.json

```json
{
  "extends": "./tsconfig.base.json"
}
```

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "ESNext.Disposable"],
    "strict": true,
    "skipLibCheck": true,
    "composite": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx"
  }
}
```

## tsconfig.client.json

```json
{
  "files": [],
  "references": [{ "path": "./packages/client/context-visualizer" }]
}
```

## tsconfig.host.json

```json
{
  "files": [],
  "references": [{ "path": "./packages/host/context-visualizer" }]
}
```

## tsconfig.tests.json

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "composite": false, "emitDeclarationOnly": false, "noEmit": true },
  "include": ["packages/*/*/src/**/*", "packages/*/*/tests/**/*", "tests/**/*.ts"]
}
```

## vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['packages/*/*/tests/**/*.spec.{ts,tsx}', 'tests/**/*.spec.ts'] },
})
```
