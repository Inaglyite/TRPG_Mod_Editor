# 开发路线图

## E0：可运行骨架

状态：已完成。

- React、TypeScript、Vite、Zustand、React Hook Form 与 AJV 工程。
- 三栏工作台、实体树、表单编辑和响应式检查器。
- Schema/语义诊断、撤销重做、本地草稿和工程 JSON 导入导出。
- 单元测试、ESLint、生产构建与 GitHub Actions。

## E1：工程会话与完整表单

- FastAPI 工程会话、revision、自动保存和崩溃恢复。
- 新建向导、最近工程、另存为和脏状态关闭确认。
- Keeper Markdown 编辑器与安全预览。
- Flags、案件时钟、初始调查员、素材映射和主题完整表单。
- ID 重命名重构、复制实体和可撤销的快速修复。

## E2：素材与关系图

- 图片拖入、缩略图、尺寸、格式、未引用与重复检测。
- 场景出口图和线索关系图。
- 玩家可见信息边界预览与主题预览。
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
