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
