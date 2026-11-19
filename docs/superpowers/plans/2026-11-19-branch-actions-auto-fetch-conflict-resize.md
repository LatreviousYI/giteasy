# 分支操作、自动 Fetch 与冲突区调整实施计划

- 状态：已完成
- 日期：2026-11-19
- 设计：[2026-11-19-branch-actions-auto-fetch-conflict-resize-design.md](../specs/2026-11-19-branch-actions-auto-fetch-conflict-resize-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 远程分支右键创建本地分支

- [x] 为远程分支接入右键菜单回调。
- [x] 新增远程分支创建对话框，默认名称和切换选项符合设计。
- [x] 处理同名本地分支已存在时的切换与提示。
- [x] 补组件测试和 Sidebar 菜单测试。
- [x] 更新 Changelog。

## TASK-02 本地分支右键拉取上游

- [x] 本地菜单增加“拉取对应远程分支”。
- [x] 无有效上游时禁用并展示原因。
- [x] 非当前分支先安全切换，再进入现有 Pull 策略流程。
- [x] 切换失败时不得执行 Pull。
- [x] 补非当前分支和失败路径测试。
- [x] 更新 Changelog。

## TASK-03 删除本地分支时可选删除远程

- [x] 扩展 IPC DTO 和后端 `branch_delete` 参数。
- [x] 在同一仓库写锁内执行本地删除和可选远程删除。
- [x] 明确处理远程删除失败后的部分完成状态。
- [x] 新增带远程删除选项的删除确认框。
- [x] 补 Rust 单元/集成测试和前端对话框测试。
- [x] 使用 `/home/kerwin/workspace/python/test_tree` 的 `gitee` 远程做真实分支删除验收并清理临时分支。
- [x] 更新 Changelog。

## TASK-04 自动 Fetch 默认 60 分钟

- [x] 将 Rust 设置默认值改为 60，并补默认值测试。
- [x] 将前端设置回退值改为 60。
- [x] 调整当前仓库定时器为串行调度，避免并发 Fetch。
- [x] 补设置和调度相关测试。
- [x] 更新 Changelog。

## TASK-05 冲突区可调高度

- [x] 增加版本区与结果区之间的水平分割条。
- [x] 支持鼠标、触控和键盘调整。
- [x] 增加上下限和窗口尺寸约束。
- [x] 持久化合法比例并安全读取损坏值。
- [x] 补比例计算和交互测试。
- [x] 更新 Changelog，必要时更新视觉基线。

## 最终验证

- [x] `npm run test:frontend`
- [x] `npm run test:backend`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `npm run lint`
- [!] `npm run format:check`：仅被未跟踪的 `.openidea/changelists.json` 阻塞；本次变更文件已通过 Prettier。
- [x] `npm run rust:clippy`
- [x] `npm run rust:fmt:check`
- [x] `git diff --check`
- [x] 检查 `docs/visual-baselines/` 只包含有意变更。
