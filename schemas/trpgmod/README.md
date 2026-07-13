# Schema 来源

本目录的 JSON Schema 来自 TRPG Master 提交：

```text
1bc9827 feat: 可导入的版本化模组包与编辑器契约
```

权威模型位于 TRPG Master 的 `src/module_format.py`。这里的 JSON 文件用于编辑器即时反馈，不能手工
修改。同步 Schema 后必须运行 `npm run test:run`，确保默认工程和诊断器仍符合最新契约。

正式导出时，TRPG Master 后端仍会使用 Pydantic 模型和安全 packager 重新校验。
