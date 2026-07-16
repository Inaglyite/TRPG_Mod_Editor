# TRPG Mod Editor

TRPG Master 的独立模组编辑器。当前版本为 E1（0.2）：在 E0 三栏工作台之上，已经接入
TRPG Master 的版本化 Schema、权威编译器和持久工程会话。

## 当前能力

- 编辑 `manifest.json` 对应的名称、包 ID、版本、作者、规则、开场指令和 capability。
- 通过向导新建工程，编辑、复制、引用安全重命名和级联删除场景、NPC、线索与结局。
- 使用仓库内固定版本的 Draft 2020-12 JSON Schema 做实时结构校验；CI 必须检测它与指定
  TRPG Master 基线的哈希漂移。
- 检查入口场景、出口、NPC 位置、在场人物、线索关联和初始线索引用。
- 提供最多 80 步撤销/重做；浏览器保留崩溃恢复草稿，服务端以 revision 自动保存并防止多窗口覆盖。
- 支持最近工程、另存为、冲突恢复、脏状态关闭提醒和 TRPG Master 权威编译诊断。
- 编辑 Keeper 文档并进行不执行 HTML 的安全预览；无损编辑初始调查员、Flags、案件时钟、素材映射、
  Lorebook、progression 与主题结构。
- 导入、导出 `.trpgmod-project.json` 编辑工程。

当前可视化实体表单以 `.trpgmod v1` 为基线，v2 `progression` 与 Lorebook v3 已有无损 JSON 编辑入口，
尚未全部拆成细粒度控件，也不直接生成 `.trpgmod` ZIP。正式压包、素材复制和本地试玩将在 E3 通过 TRPG Master
后端的权威 packager/API 完成，避免浏览器端维护第二套打包规则。

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
├── features/project/    草稿、工程导入和工程导出
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
