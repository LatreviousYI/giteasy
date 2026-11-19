# GitEasy Development Constraints

本文件是 GitEasy 仓库的长期开发约束。后续模型或开发者开始修改代码前，必须先阅读本文件，再阅读相关模块和测试。

## 基本原则

- 先理解现有实现，再新增抽象。优先复用仓库已有模式，不引入平行架构。
- 改动保持小而完整，一次解决一个明确问题；不要把重构、功能、格式化和无关依赖升级混在同一个提交中。
- 不回退用户已有改动，不使用 `git reset --hard`、强制推送或改写已发布历史。
- 生产代码禁止 `any`、`@ts-ignore`、`dangerouslySetInnerHTML` 和无声吞错。
- 只在测试、启动入口或已验证不可失败的场景使用 Rust `unwrap`/`expect`；生产命令路径必须返回 `AppError`。
- 新逻辑必须有测试。修复 bug 时先补能复现问题的测试。
- 每项功能、修复或交互调整都要更新 `docs/CHANGELOG.md`。
- Linux 是主要开发和发布平台；新增能力优先保证 Ubuntu/Debian、X11/Wayland 和 AppImage 更新体验。

## 前端约定

技术栈：React 19、TypeScript、Vite、TanStack Query、Zustand。

- 页面和功能代码放在 `src/features/<domain>/`，通用 UI 放在 `src/components/`。
- Tauri 调用只能通过 `src/lib/ipc.ts`；组件中不得直接调用 `invoke`。
- 跨组件 DTO 统一定义在 `src/lib/types.ts`。
- 服务端状态使用 TanStack Query，不复制到 Zustand。Zustand 只存客户端 UI 状态。
- 查询 key 必须包含仓库路径和所有影响结果的参数；修改数据后通过统一的 repo invalidation helper 刷新。
- 新增对话框优先使用 `Modal`、`ConfirmDialog`、`PromptDialog`；不得复制遮罩、Escape 关闭和底部按钮模板。
- 剪贴板、错误标准化、日期/时间/大小格式化等稳定逻辑必须放入 `src/lib/`，不得在多个 feature 中重复实现。
- 不同业务动作的 `busy + toast + errorToast` 可以保留局部实现。只有恢复逻辑完全一致时才抽 Hook。
- `btn`、`input` 等 CSS class 可以重复使用；不要仅因出现次数多就创建无行为组件。只有需要统一行为、可访问性或复杂变体时才创建组件。
- 大型组件应拆为数据 Hook、命令处理函数和纯展示子组件。不要继续把独立功能塞进已超过约 500 行的组件。
- 新样式优先使用现有 CSS 变量和设计 token。不要在 JSX 中新增硬编码主题颜色。
- 所有对话框必须使用现有 `Modal` 及其 `useModalFocus`，保留 `role="dialog"`、`aria-modal`、可访问标题、焦点锁定和关闭后焦点恢复。

## Rust 后端约定

技术栈：Tauri 2、Rust、libgit2、system git、Tokio。

- Tauri command 只做参数校验、状态获取和调用 `*_impl`，业务逻辑放在可测试的 impl 函数中。
- 所有预期错误返回 `Result<T, AppError>`；只对出错类型和上下文做转换，详情通过 `with_detail` 附加。
- 不得在普通业务代码中新增 `Command::new("git")`。Git 命令环境、Activity 记录和错误映射必须通过共享 Git 执行层。
- 流式执行与普通执行必须共享同一个 Git command builder 和错误映射，不得各自维护环境变量列表。
- 共享状态加锁统一使用带 poisoning recovery 的 helper，不在 command 中散布 `lock().unwrap()`。
- 需要阻塞的 libgit2/文件系统读取通过 `tauri::async_runtime::spawn_blocking` 或现有 `blocking_read` 封装。
- 同一仓库的写操作必须经过 `session.rs` 的仓库级写锁；不得绕过锁直接修改工作区。
- 模块按领域拆分。`read.rs`、`write.rs` 已过大，后续新增独立读取/写入领域时应创建子模块。
- 不把网络、文件系统、Git 和 DTO 转换塞进同一个大型函数；保持数据获取、转换和执行分层。

## 复用判断

- 同一稳定逻辑出现 3 次以上再抽取，优先放到已有工具文件，而不是创建新的泛化框架。
- 抽象必须降低调用方的理解成本；只减少字符数、不减少概念数量的抽象应拒绝。
- 禁止创建“万能 hooks/utils/services”。工具应使用具体名称，例如 `copyTextWithToast`、`invalidateRepoQueries`。
- 新增基础组件时说明其行为边界，并至少补一个组件测试。

## 质量门禁

提交前至少运行：

```bash
npm run test:all
git diff --check
```

目标静态检查：

```bash
npm run lint
npm run format:check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

ESLint、Prettier、Clippy 和 rustfmt 已接入 CI；相关告警必须保持为零。

E2E 会改写 `docs/visual-baselines/`。如果只是验证而非有意更新视觉基线，测试后必须恢复这些生成文件，避免把测试副作用提交。

## 测试约定

- 前端纯函数：Vitest。
- 前端交互：Testing Library，按用户行为断言，不测试内部 state。
- Rust 业务逻辑：优先测试 `*_impl` 和临时真实 Git 仓库。
- 错误映射、设置持久化、查询 invalidation、Modal 可访问性和 updater 网络重试必须有专门测试。
- 测试不得依赖开发机固定路径、已有 Git 配置或公网；网络行为通过本地 fake server/mock 验证。

## 发布约定

- 合并到 `master` 自动生成下一版本并发布。默认 patch；PR 标题中出现 `[minor]` 或 `[major]` 时提升对应版本，匹配不区分大小写。
- 功能 PR 不手工修改版本文件，也不手工创建标签。
- 发布版本在 CI 构建工作区注入，正式版本以 Git 标签和 GitHub Release 为准。
- 不得提交 updater 私钥或密码。发布 Secret 只存在于 GitHub Actions Secrets。

## 当前质量债务与建议顺序

1. P2：按领域逐步拆分 `read.rs`、`write.rs`，每次迁移一个读取或写入子域。
2. P2：逐步拆分 `Sidebar.tsx`、`SidebarSections.tsx`、`DiffViewer.tsx` 和 `GitHubPanel.tsx`。
3. P3：补设置文件加载、持久化和损坏配置回退测试。
4. P3：补 updater 网络失败和限频交互测试。
5. P3：评估是否将全局 `styles.css` 按 feature 拆分；优先保持现有 CSS token 和视觉基线稳定。

重构必须小步进行，每一步保持测试通过。禁止为了“整洁”一次性重写整个模块。
