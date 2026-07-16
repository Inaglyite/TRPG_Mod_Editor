# 架构文档

## 1. 定位

TRPG Mod Editor 是 TRPG Master 的独立作者工具。前端负责高频编辑体验和即时诊断，TRPG Master
后端继续负责 Pydantic 语义校验、素材安全检查、确定性打包、版本化安装和试玩世界创建。

```text
EditorProject
  ├─ manifest              作者态包元数据
  ├─ module                NPC / 场景 / 线索 / 结局
  ├─ keeperDocument        守秘人 Markdown
  ├─ theme                 主题配置
  └─ lorebook?             Character Card V3 条目
          │
          ├─ AJV + 前端语义诊断
          └─ 后端权威校验 → .trpgmod → 版本化安装 → 隔离试玩世界
```

编辑器不保存玩家世界状态，也不在浏览器端复制 Python packager 的安全逻辑。

TRPG Master 的模组契约是版本化外部依赖，不是复制后永久不变的源码。编辑器必须显式记录所消费的
Schema 版本和来源提交，不能只写“与主项目同源”。当前 UI 完整覆盖 v1；v2 `progression` 与
Lorebook v3 进入 E0.5 契约同步阶段。

## 2. 前端分层

| 层 | 路径 | 职责 |
|---|---|---|
| 应用 | `src/app` | 工作台装配、全局样式、快捷键和自动草稿 |
| 组件 | `src/components` | 顶栏、实体树、主编辑区和诊断检查器 |
| 功能 | `src/features` | 实体表单、工程读取和工程下载 |
| 领域 | `src/domain` | 版本化作者模型、迁移适配器、默认项目、Schema 与交叉引用诊断 |
| 状态 | `src/store` | 项目快照、选择、撤销/重做和 revision |

状态修改通过仓库动作完成，每次动作写入一个不可变工程快照。历史最多保留 80 步；草稿保存不会清空
撤销栈，导入或新建工程会建立新的历史边界。

## 3. 校验

校验分三层：

1. AJV 按工程 `format_version` 选择 `schemas/trpgmod/*.schema.json`，报告类型、必填字段和格式错误。
2. `validation.ts` 检查入口场景、出口、NPC、线索、发现规则、Lorebook 与初始状态之间的引用，
   并提供 warning/advice。
3. TRPG Master 编译 API 返回权威 Pydantic 诊断、`source_path -> output_path` trace 与编译预览。

前端校验不替代服务端。E3 导出时，工程必须重新通过 TRPG Master 的 Pydantic 模型、ZIP 安全、
checksum、capability 和引擎版本检查。

### 3.1 Schema 供应链

Schema 只能通过 TRPG Master 的生成命令同步，禁止在编辑器仓库手工修改：

```text
TRPG Master Pydantic models
  → tools/module_packager.py schema
  → schemas/trpgmod/{manifest,module}-v{1,2}.schema.json
  → lorebook-v3.schema.json
  → schema-lock.json（来源仓库、commit、文件 SHA-256）
```

CI 校验 lock 中的哈希、默认工程和迁移 fixture。主项目新增版本时，编辑器先增加只读导入/迁移适配，
再把新版本设为默认作者格式；不得静默用最新 Schema 解释旧工程。

## 4. 工程持久化

E0 使用 `.trpgmod-project.json` 作为编辑器草稿交换文件，并在 LocalStorage 保存最近工程。该文件不是
发布包，也不能被游戏直接导入。

工程容器自身需要独立的 `editor_project_version`，与模组 `format_version`、Lorebook spec 和游戏世界
`schema_version` 分开。打开旧工程时先迁移编辑器容器，再由模组适配器迁移作者数据；保存不得直接
覆盖无法无损降级的原文件。

E1 将增加后端工程会话：

```text
PATCH /api/editor/projects/{session}
{
  "expected_revision": 12,
  "operations": [...]
}
```

服务端以 revision 拒绝静默覆盖，Electron 文件选择通过窄权限 preload/IPC 完成。

## 5. 安全边界

- Markdown 预览不执行原始 HTML、脚本、iframe 或远程资源。
- 资产引用只能保存包内相对路径。
- 第三方包先经 TRPG Master inspect，再转换成可编辑工程。
- 自定义 Skill 始终显示模型上下文风险。
- 玩家预览不得包含 NPC `secret`、未发现线索和 `discovery_notes`。
- 浏览器工程 JSON 不能直接声明本机绝对路径。
- manifest 的作者、主页、许可证及素材来源是发布检查项；缺少许可证不得被误标为“可自由复用”。

## 6. 集成边界

后续通过适配器访问 TRPG Master，不在组件里直接拼接 HTTP：

```text
EditorBackend
  openProject()
  saveProject(expectedRevision, operations)
  validateProject()
  exportPackage()
  startPlaytest()
```

浏览器开发环境和 Electron 使用同一个接口，分别由 HTTP 与 preload 实现。

## 7. 游戏运行时边界

编辑器描述“有哪些场景、人物、线索、发现规则、结局和叙事素材”，不实现游戏时间线。以下能力
完全属于 TRPG Master：

- `turn_id` / `parent_turn_id`、行动前决策点和世界分支；
- 结构化 choices 的运行时持久化与恢复；
- SAN、技能检定、骰点、工具执行和失败推进；
- `world_id`、存档、消息历史、玩家笔记和权威世界快照。

编辑器只需帮助作者确保关键推进具有可发现路径、失败替代入口和稳定实体 ID。预览可以可视化场景
与发现规则图，但不得自行模拟另一套分支/结算引擎。

## 8. 前端边界

编辑器和游戏前端都使用 React、TypeScript、Vite 与 Zustand，但不共享业务 store 或组件源码。
可以共享的只有发布为明确版本的协议类型、Schema 和无 UI 领域工具。编辑器组件不得 import
TRPG Master 的 `frontend/src/*`，主游戏也不得依赖编辑器内部表单模型。
