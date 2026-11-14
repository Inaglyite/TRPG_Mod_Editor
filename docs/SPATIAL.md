# Spatial v1 空间调查编辑

## 使用入口与兼容

在左侧「扩展与工具 → 空间调查」打开编辑页。平面 v2 工程需要点击「启用空间调查」；启用时才创建
`module.spatial`，并自动声明 `spatial_investigation` capability 和至少 `1.1.0` 的
`min_engine_version`。没有 `spatial` 的旧工程不会被强制迁移，也不需要自定义 Skill。

编辑器沿用模组格式 v2，不定义另一套空间工程格式。字段、默认值、枚举和数量限制以本体
`src/modules/spatial_format.py` 与锁定的 `module-v2.schema.json` 为准。当前 Schema 来源为：

- 本体分支：`feat/spatial-investigation`
- 对接提交：`84024322f4f417161ca738bd377693cf117efb41`
- 五份文件的实际 SHA-256：`schemas/trpgmod/schema-lock.json`

## 四个编辑面

- **场景树**：编辑 `spatial.nodes`。名称和公开描述仍保存于 `module.scenes`；container 必须选择
  自己的子孙 location 作为入口。父子层级不自动开放子房间，也不共享 NPC 在场状态。
- **通路**：编辑 `spatial.connections` 的起终点、双向、可见条件、通行条件、记住开锁和状态代价。
  容器端点按入口叶场景解析。显式通路覆盖同方向旧 `exits`，不会额外生成可绕过门锁的开放边。
- **调查点与动作**：编辑 `spatial.points` 及其 `actions`。调查点只能属于 location 叶场景；动作区分
  查看、搜索、阅读、拿取、交谈、进入和使用。检定只声明技能与难度，实际骰点和结果由本体产生。
  `grant_clue` 与 `give_item` 是不同效果，查看信息不会自动取得实物。主线线索需要无检定路径，
  或同一检定动作的成功/失败分支均可授予；失败保底可与真实时钟/物品代价并列。
- **物品与状态**：编辑 `spatial.items` 的稳定 ID、唯一 label 和数值状态范围。条件读取当前实际持有
  实例；带状态物品的每个实例数量为 1，多把钥匙不共享 charge。编辑器显式校验
  `minimum ≤ initial ≤ maximum`，并将初值越界或上下限倒置定位到对应字段。

### 条件与效果

条件表单支持 `always`、`all`、`any`、`not`、`flag`、`item`、`clue`、`clock`、`completed`，
效果列表支持 `grant_clue`、`give_item`、`adjust_item_state`、`set_flag`、`reveal_scene`、
`unlock_connection`、`advance_clock`。组合树、引用 ID 和参数均使用控件编辑，不接受任意脚本或
自由 JSONPath。通路 costs 只能添加负数 `adjust_item_state`。

`advance_clock` 使用的时钟必须已在「世界与素材」声明初始值和整数 `max`；自动线索时钟及带
`time_advance` 的时钟不能由空间效果重复推进。编辑器只显示校验结果，不自行宣告动作成功。

## 引用与保存

场景、线索、调查点、动作、通路、物品及物品状态重命名会同步更新现有引用。删除实体时会提示影响；
被删除对象所属的通路与调查点一并清理。父场景或容器入口仍被使用时，删除会被阻止并要求先调整。
只要条件树的任意层级引用了被删除对象，整条条件就会安全地变为 `always: false`，需由作者明确重配；
不会只移除钥匙叶条件或清空 `minimum_states` 门槛而意外开放门锁。

Spatial 字段参与同一工程快照、撤销/重做、本地草稿、会话保存、JSON 打开/导出及 `.trpgmod`
导入/导出。规范化只补模型默认值；所有已声明的嵌套条件与效果均保留。生成的主持说明不是规则正本。

## 最小开发验收

```bash
npm run schema:check
npm run lint
npm run test:run -- \
  src/domain/spatial.test.ts src/domain/validation.test.ts \
  src/domain/authoring.test.ts src/store/spatial-store.test.ts \
  src/store/editor-store.test.ts src/features/project/spatial-io.test.ts \
  src/features/project/project-io.test.ts
npx playwright test e2e/spatial.spec.ts e2e/authoring.spec.ts
npm run build:electron
```

真实联调使用本体示例包，通过编辑器修改一个房间名和一项钥匙条件，保存并重开会话后导出。
导出的 `.trpgmod` 再由本体 `tools/module_packager.py` 校验、编译和打包；不需要付费模型或正式环境。

## 对接复核

2026-11-14 接入复核指出的组合条件删除放宽门锁、数值状态跨字段范围漏检均已补上专项测试并修复。
本体 `docs/SPATIAL_EXAMPLE.md` 也已修正为先 `pack` 再 `validate <包路径>`；当前无遗留契约差异，
本编辑器分支不修改本体文档或实现。
