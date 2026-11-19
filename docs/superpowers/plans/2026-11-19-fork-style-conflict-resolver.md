# Fork 风格三窗格冲突解决器实施计划

- 状态：已完成
- 日期：2026-11-19
- 设计：[2026-11-19-fork-style-conflict-resolver-design.md](../specs/2026-11-19-fork-style-conflict-resolver-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 冲突会话与撤销模型

- [x] 创建稳定的多块冲突会话模型。
- [x] 实现单块、全部采用和结果内容更新。
- [x] 实现按文件隔离的快照撤销栈。
- [x] 实现编辑过程分组和块导航。
- [x] 补纯函数与会话测试。

## TASK-02 三窗格冲突组件

- [x] 新建 `ConflictMergeEditor`。
- [x] 实现 Theirs / optional Base / Ours 代码窗格。
- [x] 实现当前块高亮和滚动定位。
- [x] 实现块导航、状态和操作按钮。
- [x] 实现带行号的结果编辑器和撤销按钮。
- [x] 补组件交互测试。

## TASK-03 页面接入与保存保护

- [x] `ConflictsView` 管理每个文件的独立会话。
- [x] 切换文件恢复内容、当前块和撤销栈。
- [x] 未解决块存在时禁用保存。
- [x] 保存成功后清理对应文件会话。
- [x] 保留继续/中止、外部工具和二进制冲突路径。
- [x] 补页面集成测试。

## TASK-04 视觉与 E2E

- [x] 更新冲突页样式。
- [x] 使用三块冲突验证块导航、单块采用、撤销和布局。
- [x] 更新冲突页视觉基线。
- [x] 检查桌面和窄窗口无重叠或横向溢出。

## TASK-05 打包与真实验收

- [x] 运行完整测试和静态检查。
- [x] 更新 Changelog。
- [x] 构建 `0.2.3-dev.1` AppImage。
- [x] 在 `/home/kerwin/workspace/python/test` 重新保留一个三块冲突。
- [x] 启动打包版供本地查看。

## 最终验证

- [x] `npm run test:all`
- [x] `npm run lint`
- [x] 本次变更文件 Prettier 检查
- [x] `cargo clippy --all-targets -- -D warnings`
- [x] `cargo fmt -- --check`
- [x] `git diff --check`
