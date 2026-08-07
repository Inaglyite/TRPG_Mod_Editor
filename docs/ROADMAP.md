# 开发路线图

- 更新日期：2026-08-07
- 当前基线：E4 桌面发布（0.3），Schema 锁定到 TRPG Master `da55ed0`
- 当前优先级：E3 打包导出打通 `.trpgmod` 闭环，然后 E2 素材与关系图

## E0：可运行骨架

状态：已完成。

- React、TypeScript、Vite、Zustand、React Hook Form 与 AJV 工程。
- 三栏工作台、实体树、表单编辑和响应式检查器。
- Schema/语义诊断、撤销重做、本地草稿和工程 JSON 导入导出。
- 单元测试、ESLint、生产构建与 GitHub Actions。

## E0.5：契约同步与版本适配

- 从指定 TRPG Master commit 同步 manifest/module v1、v2 与 Lorebook v3 Schema。
- 增加 `schema-lock.json` 和 CI 哈希漂移检查，禁止手工维护 Schema 副本。
- 为编辑器工程容器增加独立版本，不与 `.trpgmod format_version` 混用。
- 增加 v1 → v2 无损迁移、旧工程备份、迁移报告和 fixture。
- 扩展领域类型以覆盖 v2 `progression`、结构化 `discovery_rules`、资产 reveal 路径和 Lorebook v3。
- 接入 TRPG Master compile API，展示稳定诊断 code、字段 path 和编译 trace。
- 明确 choices/决策点/时间线属于游戏引擎，编辑器只校验可达性和失败替代入口。

状态：已完成（E1.5 收敛）。五份权威 Schema、hash lock、EditorProject v2 迁移、compile API 已接入；
v2 完整作者态类型（`progression`、`encounters`、`discovery_rules`、`flag_effects`、`required_flags`、
`reveal_on` 等）、按版本路由的 Schema 校验、Lorebook v3 结构校验与引用检查、v1 → v2 无损迁移
（task 线索选为主线、补插 grant_clue fallback、浏览器备份与迁移报告）全部落地；新建工程默认 v2。

## E1：工程会话与完整表单

- FastAPI 工程会话、revision、自动保存和崩溃恢复；会话保存版本化 EditorProject，而不是运行时世界。
- 新建向导、最近工程、另存为和脏状态关闭确认。
- Keeper Markdown 编辑器与安全预览。
- Flags、案件时钟、初始调查员、素材映射、Lorebook、progression 和主题完整表单。
- ID 重命名重构、复制实体和可撤销的快速修复。

状态：E1 基线已完成，E1.5 修复了基线遗留缺陷：默认 v1 工程写入 v1 Schema 禁止的 `progression`
导致的永久诊断错误、复制线索不同步 `known_clue_ids`、NPC 属性/技能/状态/法术无编辑入口、
Ctrl+S 与导出语义混淆、结构化配置草稿被无关动作清空、manifest 文件引用与编辑器内容不一致、
文档过时。

## E2：素材与关系图

- 图片拖入、缩略图、尺寸、格式、未引用与重复检测。
- 场景出口图和线索关系图。
- 玩家可见信息边界预览与主题预览。
- 发现规则/场景/线索可达性图；不在编辑器复制 TurnJournal 或世界分支算法。
- 100 NPC、200 场景、500 线索性能基线。

## E3：打包与试玩

- 调用 TRPG Master 权威 packager 导出 `.trpgmod`。
- 导入现有 `.trpgmod` 为编辑工程。
- 编译预览 `module.md` 与 `world_state_initial.json`。
- 一键安装并创建隔离试玩世界。
- 旧 `module.md` 迁移报告。

## E4：桌面发布

- Electron 主进程与最小 preload API。
- Windows/Linux 工程目录选择和导出位置选择。
- 自动恢复、发布检查单和错误报告导出。
- 安装包、升级兼容和大型模组稳定性验收。

状态：已完成（0.3）。Electron 43 桌面壳（原生 Vite 8 + tsc 构建，不引入 electron-vite）：
`contextIsolation`/`sandbox` 窄权限 preload IPC、系统对话框打开/保存/导出、工程目录选择与最近目录
记忆（userData/settings.json）、原生菜单、单实例锁、窗口状态记忆、生产 CSP 注入；渲染进程新增发布
检查单（结构/许可证/作者/主页/SemVer/引擎版本/素材与 capability 一致性）与一键错误报告导出；
electron-updater（GitHub provider）集成，检查更新对已安装桌面版启用。Linux AppImage + deb 已实际
构建验证；Windows NSIS 安装包已在 Windows 机器构建产出。自动更新完整链路（发布 Release、签名）
与大型模组稳定性验收留待正式发布时进行。
