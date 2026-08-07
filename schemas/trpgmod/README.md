# Schema 来源

本目录的 JSON Schema 是从 TRPG Master 指定提交生成的版本化契约快照，编辑器只读使用：

```text
来源仓库： https://github.com/Inaglyite/TRPG-Master
基线提交： da55ed0bceee1d0ee6602d5b55c40bc5f2fee2a2
生成命令： tools/module_packager.py schema
```

包含 5 份 Draft 2020-12 Schema：

- `module-manifest-v1.schema.json` / `module-manifest-v2.schema.json`
- `module-v1.schema.json` / `module-v2.schema.json`
- `lorebook-v3.schema.json`

权威模型位于 TRPG Master 的 `src/module_format.py` 与 `src/lorebook.py`。这里的 JSON 文件用于编辑器
即时反馈，不能手工修改。同步必须通过 TRPG Master 的生成命令并更新 `schema-lock.json`（来源 commit
与每个文件的 SHA-256）；CI 的 `scripts/verify-schema-lock.mjs` 会拒绝与 lock 不符的本地改动。同步后
必须运行 `npm run check`，确保默认工程、迁移 fixture 和诊断器仍符合对应版本契约。

正式导出时，TRPG Master 后端仍会使用 Pydantic 模型和安全 packager 重新校验。
