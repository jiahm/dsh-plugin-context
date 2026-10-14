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
