# Schema 来源

本目录当前的 JSON Schema 最初来自 TRPG Master 提交：

```text
1bc9827 feat: 可导入的版本化模组包与编辑器契约
```

它们已经落后于 TRPG Master 当前生成结果，且尚未包含 manifest/module v2 与 Lorebook v3；在
E0.5 完成前只能代表编辑器当前支持的 v1 快照，不能再宣称是主项目最新 Schema。

权威模型位于 TRPG Master 的 `src/module_format.py` 与 `src/lorebook.py`。这里的 JSON 文件用于编辑器
即时反馈，不能手工修改。后续同步必须生成 `schema-lock.json`，记录来源 commit 和每个文件的 SHA-256；
CI 应拒绝无 lock 更新的 Schema 变化。同步后必须运行 `npm run check`，确保默认工程、迁移 fixture
和诊断器仍符合对应版本契约。

正式导出时，TRPG Master 后端仍会使用 Pydantic 模型和安全 packager 重新校验。
