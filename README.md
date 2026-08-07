# TRPG Mod Editor

TRPG Master 的独立模组编辑器。当前版本为 E1.5（0.3）：在 E1 工程会话基线之上，完成契约收敛——
新建工程默认 `.trpgmod v2`，v1 工程打开时无损迁移，v2 与 Lorebook v3 的 Schema 与语义校验全部
接入编辑器。

## 当前能力

- 编辑 `manifest.json` 对应的名称、包 ID、版本、作者、规则、开场指令和 capability。
- 通过向导新建工程（默认 `format_version 2.0`），编辑、复制、引用安全重命名和级联删除场景、NPC、
  线索与结局。
- 按工程 `format_version` 选择 manifest/module v1 或 v2 的固定版本 Draft 2020-12 JSON Schema 做实时
  结构校验；CI 必须检测它与指定 TRPG Master 基线的哈希漂移。
- 检查入口场景与可达性、出口、NPC 位置、在场人物、遭遇、线索关联、发现规则与 fallback、主线
  progression、旗标/案件时钟预声明、素材映射和 Lorebook 引用。
- 打开 v1 工程自动无损迁移到 v2（对齐 TRPG Master `module_migrations.migrate_v1_to_v2`：task 线索
  选为主线、为检定失败路径补插 grant_clue fallback），原工程备份到浏览器本地并提示迁移报告。
- 提供最多 80 步撤销/重做；浏览器保留崩溃恢复草稿，服务端以 revision 自动保存并防止多窗口覆盖。
- 支持最近工程、另存为、冲突恢复、脏状态关闭提醒和 TRPG Master 权威编译诊断；Ctrl+S 保存到会话
  或本地草稿。
- 编辑 Keeper 文档并进行不执行 HTML 的安全预览；无损编辑初始调查员、Flags、案件时钟、素材映射、
  Lorebook、progression 与主题结构；NPC 的属性、技能、状态、法术与初始揭示条目为细粒度表单。
- 导入、导出 `.trpgmod-project.json` 编辑工程。

编辑器不直接生成 `.trpgmod` ZIP。正式压包、素材复制和本地试玩将在 E3 通过 TRPG Master 后端的
权威 packager/API 完成，避免浏览器端维护第二套打包规则。

## 开发

环境要求：Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

默认开发地址为 `http://127.0.0.1:4173/`。

提交前运行：

```bash
npm run check
```

也可以分别执行：

```bash
npm run lint
npm run test:run
npm run build
```

## 目录

```text
src/
├── app/                 应用装配与工作台样式
├── components/          三栏布局、工具栏、实体树和检查器
├── domain/              版本化类型、默认工程和诊断规则
├── features/editors/    Manifest、场景、NPC、线索与结局编辑器
├── features/project/    草稿、v1→v2 迁移、工程导入和工程导出
├── services/            TRPG Master 工程会话与编译适配器
└── store/               Zustand 命令历史、编辑与同步状态
schemas/trpgmod/          从指定 TRPG Master 基线生成的版本化 JSON Schema
examples/                 可打包的示例模组源文件
docs/                     架构和开发路线图
```

## 数据边界

编辑器工程与游戏运行状态严格分离：

- 目标工程模型保存作者态的 `manifest`、`module`、`keeperDocument`、`theme` 和可选 `lorebook`。
- 游戏世界的 HP、SAN、已发现线索、战斗状态和存档不会进入编辑工程。
- Schema 提供即时反馈，最终 `.trpgmod` 导出仍由 TRPG Master 后端重新校验。
- 时间线、决策点、存档、骰点和世界快照属于 TRPG Master 引擎，不进入模组工程。

详见 [架构文档](docs/ARCHITECTURE.md) 和 [开发路线图](docs/ROADMAP.md)。
