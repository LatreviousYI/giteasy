# Fork 风格三窗格冲突解决器实施计划

- 状态：进行中
- 日期：2026-11-19
- 设计：[2026-11-19-fork-style-conflict-resolver-design.md](../specs/2026-11-19-fork-style-conflict-resolver-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 冲突会话与撤销模型

- [ ] 创建稳定的多块冲突会话模型。
- [ ] 实现单块、全部采用和结果内容更新。
- [ ] 实现按文件隔离的快照撤销栈。
- [ ] 实现编辑过程分组和块导航。
- [ ] 补纯函数与会话测试。

## TASK-02 三窗格冲突组件

- [ ] 新建 `ConflictMergeEditor`。
- [ ] 实现 Theirs / optional Base / Ours 代码窗格。
- [ ] 实现当前块高亮和滚动定位。
- [ ] 实现块导航、状态和操作按钮。
- [ ] 实现带行号的结果编辑器和撤销按钮。
- [ ] 补组件交互测试。

## TASK-03 页面接入与保存保护

- [ ] `ConflictsView` 管理每个文件的独立会话。
- [ ] 切换文件恢复内容、当前块和撤销栈。
- [ ] 未解决块存在时禁用保存。
- [ ] 保存成功后清理对应文件会话。
- [ ] 保留继续/中止、外部工具和二进制冲突路径。
- [ ] 补页面集成测试。

## TASK-04 视觉与 E2E

- [ ] 更新冲突页样式。
- [ ] 使用三块冲突验证块导航、单块采用、撤销和布局。
- [ ] 更新冲突页视觉基线。
- [ ] 检查桌面和窄窗口无重叠或横向溢出。

## TASK-05 打包与真实验收

- [ ] 运行完整测试和静态检查。
- [ ] 更新 Changelog。
- [ ] 构建 `0.2.3-dev.1` AppImage。
- [ ] 在 `/home/kerwin/workspace/python/test` 重新保留一个三块冲突。
- [ ] 启动打包版供本地查看。

## 最终验证

- [ ] `npm run test:all`
- [ ] `npm run lint`
- [ ] 本次变更文件 Prettier 检查
- [ ] `cargo clippy --all-targets -- -D warnings`
- [ ] `cargo fmt -- --check`
- [ ] `git diff --check`
