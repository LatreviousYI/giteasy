# 分支语义提交图配色实施计划

- 状态：进行中
- 日期：2026-11-19
- 设计：[2026-11-19-branch-aware-commit-graph-colors-design.md](../specs/2026-11-19-branch-aware-commit-graph-colors-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 分支颜色分配

- [ ] 从完整 `BranchDto[]` 收集本地、远程和 HEAD 分支。
- [ ] 按 HEAD、本地、远程优先级分配颜色。
- [ ] 分支名哈希碰撞时寻找下一个空色。
- [ ] 支持超过 8 个分支后的颜色循环。
- [ ] 补优先级、碰撞和稳定性测试。

## TASK-02 First-parent 与 Merge 传播

- [ ] 用分支 tip OID 初始化提交颜色种子。
- [ ] 沿 first-parent 传播分支颜色。
- [ ] Merge 额外父边使用父分支色或稳定回退色。
- [ ] 处理共享提交、Tag-only 和已删除分支。
- [ ] 补线性、Merge 和回退测试。

## TASK-03 Lane 颜色与绘制

- [ ] `GraphRow` 保存每条 lane 的传播颜色。
- [ ] 贯穿线使用传播颜色，不再临时哈希 OID。
- [ ] 提交节点、主线和边统一读取同一颜色数据。
- [ ] 补 lane 持久性测试。

## TASK-04 历史页接入

- [ ] HistoryView 读取完整分支列表。
- [ ] `buildGraph` 接收分支列表。
- [ ] 搜索、过滤和分批加载场景使用完整分支种子。
- [ ] 更新历史页视觉基线。

## TASK-05 验证与文档

- [ ] 运行前端测试、后端测试、构建和 E2E。
- [ ] 运行 ESLint、Prettier、rustfmt、Clippy 和 diff 检查。
- [ ] 重建 AppImage。
- [ ] 更新 Changelog 和实施计划。

## 最终验证

- [ ] `npm run test:all`
- [ ] `npm run lint`
- [ ] 本次变更文件 Prettier 检查
- [ ] `cargo clippy --all-targets -- -D warnings`
- [ ] `cargo fmt -- --check`
- [ ] `git diff --check`
