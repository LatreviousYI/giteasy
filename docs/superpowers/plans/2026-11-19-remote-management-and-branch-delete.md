# 远程管理与远程分支删除修复实施计划

- 状态：进行中
- 日期：2026-11-19
- 设计：[2026-11-19-remote-management-and-branch-delete-design.md](../specs/2026-11-19-remote-management-and-branch-delete-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 后端 remote 增删改 impl

- [ ] 扩展 remote add/update/remove 可测试实现函数。
- [ ] 新增 `remote_update` command 和 IPC。
- [ ] 校验名称、URL 和部分完成错误语义。
- [ ] 补本地真实仓库集成测试。

## TASK-02 完整远程管理界面

- [ ] RemotesDialog 支持现有 remote 编辑表单。
- [ ] 支持名称和 URL 保存、取消。
- [ ] 新增和删除 remote 行为保持正常。
- [ ] 补组件测试。

## TASK-03 远程管理入口

- [ ] Sidebar 区分新增和完整管理两种模式。
- [ ] 远程区域入口打开完整管理。
- [ ] 仓库菜单增加“管理远程…”。
- [ ] 更新 SidebarRepoMenu 测试。

## TASK-04 多层远程分支删除

- [ ] 删除参数从完整 branch.name 推导。
- [ ] 不再使用树形叶子显示名。
- [ ] 补 `feature/login` 多层分支删除测试。

## TASK-05 test 仓库真实验收

- [ ] 在 `test` 仓库添加临时 remote。
- [ ] 修改临时 remote 名称和 URL。
- [ ] 删除临时 remote，确认原 `gitee` 不变。
- [ ] 创建并推送临时多层远程分支。
- [ ] 通过实际后端删除远程分支并确认两端清理。
- [ ] 更新 Changelog。

## 最终验证

- [ ] `npm run test:all`
- [ ] `npm run lint`
- [ ] 本次变更文件 Prettier 检查
- [ ] `cargo clippy --all-targets -- -D warnings`
- [ ] `cargo fmt -- --check`
- [ ] `git diff --check`
- [ ] 重新构建本地 AppImage
