# 关闭确认与进程清理实施计划

- 状态：已完成
- 日期：2026-11-19
- 设计：[2026-11-19-graceful-shutdown-process-cleanup-design.md](../specs/2026-11-19-graceful-shutdown-process-cleanup-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 后端 Git 操作计数

- [x] 新增 RAII 操作计数器。
- [x] 仓库写锁守卫自动增加和减少计数。
- [x] 仓库会话注册表支持清空。
- [x] 补成功、失败、提前返回和并发计数测试。

## TASK-02 统一退出与关闭事件

- [x] `AppState` 增加操作计数器和正在关闭标记。
- [x] 新增同步资源清理函数。
- [x] 新增 Tauri `CloseRequested` 拦截。
- [x] 无操作时直接退出；有操作时发送一次关闭确认事件。
- [x] 新增 `app_exit` IPC 命令。
- [x] 补退出清理和重复退出测试。

## TASK-03 前端关闭确认

- [x] `ipc.ts` 增加退出命令。
- [x] App 级监听 `app://close-requested`。
- [x] 复用 `ConfirmDialog` 显示操作数量和中断警告。
- [x] 取消保持运行，确认调用退出命令。
- [x] 补关闭确认组件或 Hook 测试。

## TASK-04 Git 子进程终止

- [x] Tokio Git command 启用 `kill_on_drop`。
- [x] Linux 设置父进程死亡信号 `SIGTERM`。
- [x] 普通执行和流式执行共用清理配置。
- [x] 补 command builder 和子进程配置测试。

## TASK-05 打包版真实验收

- [x] 重新构建 AppImage。
- [x] 验证正常关闭后 `giteasy`、WebKit 和 AppImage 启动层全部消失。
- [x] 验证关闭事件能够显示操作确认框。
- [x] 验证取消和确认路径。
- [x] 更新 Changelog。

## 最终验证

- [x] `npm run test:frontend`
- [x] `npm run test:backend`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `npm run lint`
- [x] 本次变更文件 Prettier 检查
- [x] `cargo clippy --all-targets -- -D warnings`
- [x] `cargo fmt -- --check`
- [x] `git diff --check`
