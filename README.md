# TRPG Mod Editor

TRPG Master 的独立模组编辑器。当前仓库已经完成 E0 的 v1 三栏工作台、实体编辑、语义诊断、
撤销/重做、本地草稿和工程 JSON 导入导出；下一阶段首先同步 TRPG Master 当前的版本化 Schema、
Lorebook v3 与编译诊断契约，再扩展完整表单和后端工程会话。

## 当前能力

- 编辑 `manifest.json` 对应的名称、包 ID、版本、作者、规则、开场指令和 capability。
- 新建、编辑和级联删除场景、NPC、线索与结局。
- 使用仓库内固定版本的 Draft 2020-12 JSON Schema 做实时结构校验；CI 必须检测它与指定
  TRPG Master 基线的哈希漂移。
- 检查入口场景、出口、NPC 位置、在场人物、线索关联和初始线索引用。
- 提供最多 80 步撤销/重做，并自动把当前工程草稿保存到浏览器本地。
- 导入、导出 `.trpgmod-project.json` 编辑工程。

当前编辑器 UI 仍只完整支持 `.trpgmod v1`，尚未支持 v2 `progression`、Lorebook v3 编辑或直接生成
`.trpgmod` ZIP。正式压包、素材复制和本地试玩将在 E3 通过 TRPG Master
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
├── domain/              v1 类型、默认工程和诊断规则
├── features/editors/    Manifest、场景、NPC、线索与结局编辑器
├── features/project/    草稿、工程导入和工程导出
└── store/               Zustand 命令历史与编辑状态
schemas/trpgmod/          从指定 TRPG Master 基线生成的版本化 JSON Schema
examples/                 可打包的示例模组源文件
docs/                     架构和开发路线图
```

## 数据边界

编辑器工程与游戏运行状态严格分离：

- 目标工程模型保存作者态的 `manifest`、`module`、`keeperDocument`、`theme` 和可选 `lorebook`；
  当前 v1 工程文件尚未写入 lorebook。
- 游戏世界的 HP、SAN、已发现线索、战斗状态和存档不会进入编辑工程。
- Schema 提供即时反馈，最终 `.trpgmod` 导出仍由 TRPG Master 后端重新校验。
- 时间线、决策点、存档、骰点和世界快照属于 TRPG Master 引擎，不进入模组工程。

详见 [架构文档](docs/ARCHITECTURE.md) 和 [开发路线图](docs/ROADMAP.md)。
