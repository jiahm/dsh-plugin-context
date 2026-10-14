# dsh-plugin-context-host

为 DSH 0.2.0-rc.2 提供只读上下文快照 RPC。与 `dsh-plugin-context-client` 一起安装。

入口为具名 `apply(ctx)`；依赖 `connection`、`webServer`、`sessionQuery`、`sessions` 服务。
`/context-visualizer/snapshot` 使用 DSH 已有的浏览器认证，不开放独立服务器。
所有失败返回空快照，卸载时回收通道，读取结束时释放 SessionObservation。

完整使用与接线说明见项目根目录 README.md。
