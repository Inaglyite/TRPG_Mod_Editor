# 架构文档

## 1. 定位

TRPG Mod Editor 是 TRPG Master 的独立作者工具。前端负责高频编辑体验和即时诊断，TRPG Master
后端继续负责 Pydantic 语义校验、素材安全检查、确定性打包、版本化安装和试玩世界创建。

```text
EditorProject
  ├─ manifest              作者态包元数据
  ├─ module                NPC / 场景 / 线索 / 结局
  ├─ keeperDocument        守秘人 Markdown
  └─ theme                 主题配置
          │
          ├─ AJV + 前端语义诊断
          └─ 后端权威校验 → .trpgmod → 版本化安装 → 隔离试玩世界
```

编辑器不保存玩家世界状态，也不在浏览器端复制 Python packager 的安全逻辑。

## 2. 前端分层

| 层 | 路径 | 职责 |
|---|---|---|
| 应用 | `src/app` | 工作台装配、全局样式、快捷键和自动草稿 |
| 组件 | `src/components` | 顶栏、实体树、主编辑区和诊断检查器 |
| 功能 | `src/features` | 实体表单、工程读取和工程下载 |
| 领域 | `src/domain` | v1 类型、默认项目、Schema 与交叉引用诊断 |
| 状态 | `src/store` | 项目快照、选择、撤销/重做和 revision |

状态修改通过仓库动作完成，每次动作写入一个不可变工程快照。历史最多保留 80 步；草稿保存不会清空
撤销栈，导入或新建工程会建立新的历史边界。

## 3. 校验

校验分两层：

1. AJV 消费 `schemas/trpgmod/*.schema.json`，报告类型、必填字段和格式错误。
2. `validation.ts` 检查入口场景、出口、NPC、线索和初始状态之间的引用，并提供 warning/advice。

前端校验不替代服务端。E3 导出时，工程必须重新通过 TRPG Master 的 Pydantic 模型、ZIP 安全、
checksum、capability 和引擎版本检查。

## 4. 工程持久化

E0 使用 `.trpgmod-project.json` 作为编辑器草稿交换文件，并在 LocalStorage 保存最近工程。该文件不是
发布包，也不能被游戏直接导入。

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
