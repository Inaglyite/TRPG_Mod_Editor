import { DatabaseZap, Eye, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EditorHeading } from "../../components/EditorHeading";
import { inspectProjectEdit } from "../../domain/authoring";
import type {
  AssetDefinition,
  AssetGroups,
  EditorProject,
  FlagValue,
  ModuleDefinition,
} from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FormField } from "./FormControls";
import { useWorkspaceDrafts } from "../../store/workspace-drafts";

type JsonKey = "theme" | "initialState" | "assets" | "lorebook" | "progression";
type Draft = Record<JsonKey, string> & { keeperDocument: string };
type Tab = "keeper" | "state" | "assets" | "progression" | "advanced";
const format = (value: unknown) => JSON.stringify(value, null, 2);
function makeDraft(project: EditorProject): Draft {
  return {
    keeperDocument: project.keeperDocument,
    theme: format(project.theme),
    initialState: format(project.module.initial_state),
    assets: format(project.module.assets),
    lorebook: format(project.lorebook),
    progression: format(
      project.module.progression ?? { essential_clue_ids: [] },
    ),
  };
}
const tabs: Array<[Tab, string]> = [
  ["keeper", "守秘人文档"],
  ["state", "调查员与世界"],
  ["assets", "素材映射"],
  ["progression", "主线线索"],
  ["advanced", "高级 JSON"],
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function ProjectContentEditor() {
  const project = useEditorStore((state) => state.project);
  const update = useEditorStore((state) => state.updateProjectContent);
  const [draftState, setDraftState] = useState(() => ({
    draft: makeDraft(project),
    base: makeDraft(project),
  }));
  const { draft, base } = draftState;
  const setDraft = (draft: Draft | ((current: Draft) => Draft)) =>
    setDraftState((current) => ({
      ...current,
      draft: typeof draft === "function" ? draft(current.draft) : draft,
    }));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("keeper");
  const [flagName, setFlagName] = useState("");
  const [flagValue, setFlagValue] = useState("false");
  const [clockName, setClockName] = useState("");
  const [group, setGroup] = useState<keyof AssetGroups>("scenes");
  const [assetId, setAssetId] = useState("");
  const incoming = makeDraft(project);
  const [observed, setObserved] = useState(() => format(incoming));
  const conflicts = (Object.keys(draft) as Array<keyof Draft>).filter(
    (key) =>
      incoming[key] !== base[key] &&
      draft[key] !== base[key] &&
      incoming[key] !== draft[key],
  );
  useEffect(() => {
    useWorkspaceDrafts
      .getState()
      .setPending("content", format(draft) !== format(base));
    return () => useWorkspaceDrafts.getState().setPending("content", false);
  }, [draft, base]);
  if (format(incoming) !== observed) {
    const merged = { ...draft };
    const nextBase = { ...base };
    for (const key of Object.keys(incoming) as Array<keyof Draft>) {
      if (draft[key] === base[key] || draft[key] === incoming[key]) {
        merged[key] = incoming[key];
        nextBase[key] = incoming[key];
      }
    }
    setObserved(format(incoming));
    setDraftState({ draft: merged, base: nextBase });
  }
  const set = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  const save = () => {
    try {
      if (conflicts.length)
        throw new Error(
          "这些配置同时被其他编辑改动：" +
            conflicts.join("、") +
            "。请在高级 JSON 中核对后重新载入，草稿会继续保留。",
        );
      const candidate = structuredClone(project);
      candidate.keeperDocument = draft.keeperDocument;
      candidate.theme = JSON.parse(draft.theme);
      candidate.lorebook = JSON.parse(draft.lorebook);
      candidate.module.initial_state = JSON.parse(draft.initialState);
      candidate.module.assets = JSON.parse(draft.assets);
      if (candidate.module.format_version === "2.0")
        candidate.module.progression = JSON.parse(draft.progression);
      const checked = inspectProjectEdit(format(candidate)).project;
      update({
        keeperDocument: checked.keeperDocument,
        theme: checked.theme,
        lorebook: checked.lorebook,
        initialState: checked.module.initial_state,
        assets: checked.module.assets,
        progression: checked.module.progression ?? { essential_clue_ids: [] },
      });
      const fresh = makeDraft(checked);
      setDraftState({ base: fresh, draft: fresh });
      setError("");
      setMessage("世界与素材已应用，可撤销。工程将继续自动保存。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `无法应用：${caught.message}`
          : "JSON 无法保存",
      );
    }
  };
  let state: ModuleDefinition["initial_state"] | null = null;
  let assets: AssetGroups | null = null;
  let essential: string[] = [];
  try {
    const value: unknown = JSON.parse(draft.initialState);
    if (
      isRecord(value) &&
      isRecord(value.pc) &&
      isRecord(value.flags) &&
      isRecord(value.case_clocks)
    )
      state = value as unknown as ModuleDefinition["initial_state"];
  } catch {
    /* 保留 JSON 草稿，改由高级页面修复。 */
  }
  try {
    const value: unknown = JSON.parse(draft.assets);
    if (
      isRecord(value) &&
      ["scenes", "npcs", "clues"].every(
        (key) =>
          isRecord(value[key]) &&
          Object.values(value[key]).every(
            (asset) => isRecord(asset) && typeof asset.file === "string",
          ),
      )
    )
      assets = value as unknown as AssetGroups;
  } catch {
    /* 同上 */
  }
  try {
    const value = JSON.parse(draft.progression) as {
      essential_clue_ids?: unknown;
    };
    if (Array.isArray(value.essential_clue_ids))
      essential = value.essential_clue_ids.filter(
        (id): id is string => typeof id === "string",
      );
  } catch {
    /* 同上 */
  }
  const updateState = (next: ModuleDefinition["initial_state"]) =>
    set("initialState", format(next));
  const parsedFlag = (text: string): FlagValue =>
    text === "true"
      ? true
      : text === "false"
        ? false
        : /^-?\d+$/.test(text)
          ? Number(text)
          : text;
  const patchAsset = (id: string, patch: Partial<AssetDefinition>) => {
    if (assets)
      set(
        "assets",
        format({
          ...assets,
          [group]: {
            ...assets[group],
            [id]: { ...assets[group][id], ...patch },
          },
        }),
      );
  };
  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="WORLD BUILDING"
        title="世界与素材"
        icon={<DatabaseZap size={23} />}
      />
      <div className="world-tabs" aria-label="世界配置分类">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {conflicts.length > 0 && (
        <p className="inline-warning">
          {conflicts.join("、")}{" "}
          在其他页面发生变化。你的草稿仍保留，请核对冲突后再应用。
        </p>
      )}
      {tab === "keeper" && (
        <section className="form-section">
          <h2>守秘人文档</h2>
          <p className="section-help">
            记录真相、节奏、人物扮演和失败推进。右侧按纯文本安全预览。
          </p>
          <div className="keeper-grid">
            <FormField label="Markdown 源文档">
              <textarea
                rows={23}
                value={draft.keeperDocument}
                onChange={(event) => set("keeperDocument", event.target.value)}
              />
            </FormField>
            <FormField label="文档预览" hint="HTML、脚本与外部资源不会执行">
              <article className="keeper-preview">
                {draft.keeperDocument || "从故事的真相开始写。"}
              </article>
            </FormField>
          </div>
        </section>
      )}
      {tab === "state" &&
        (state ? (
          <div className="editor-form">
            <section className="form-section">
              <h2>初始调查员</h2>
              <div className="form-grid">
                <FormField label="调查员姓名">
                  <input
                    value={state.pc.name}
                    onChange={(event) =>
                      updateState({
                        ...state!,
                        pc: { ...state!.pc, name: event.target.value },
                      })
                    }
                  />
                </FormField>
                <FormField label="职业">
                  <input
                    value={state.pc.occupation}
                    onChange={(event) =>
                      updateState({
                        ...state!,
                        pc: { ...state!.pc, occupation: event.target.value },
                      })
                    }
                  />
                </FormField>
                {(
                  [
                    ["hp", "HP"],
                    ["max_hp", "最大 HP"],
                    ["san", "SAN"],
                    ["max_san", "最大 SAN"],
                  ] as const
                ).map(([key, label]) => (
                  <FormField key={key} label={label}>
                    <input
                      type="number"
                      min={0}
                      value={state!.pc[key]}
                      onChange={(event) => {
                        if (Number.isFinite(event.target.valueAsNumber))
                          updateState({
                            ...state!,
                            pc: {
                              ...state!.pc,
                              [key]: event.target.valueAsNumber,
                            },
                          });
                      }}
                    />
                  </FormField>
                ))}
              </div>
              <p className="section-help" style={{ marginTop: 16 }}>
                属性、技能、物品与私有记忆可在「高级 JSON」完整配置。
              </p>
            </section>
            <section className="form-section">
              <h2>世界旗标</h2>
              <p className="section-help">
                先声明状态，再在线索、人物遭遇和结局中引用。值支持布尔值、整数和文本。
              </p>
              <div className="kv-rows">
                {Object.entries(state.flags).map(([name, value]) => (
                  <div
                    className="kv-row"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) minmax(80px, 1fr) 28px",
                    }}
                    key={name}
                  >
                    <input value={name} readOnly aria-label="已声明旗标" />
                    <input
                      value={String(value)}
                      aria-label={`世界旗标 ${name} 的值`}
                      onChange={(event) =>
                        updateState({
                          ...state!,
                          flags: {
                            ...state!.flags,
                            [name]: parsedFlag(event.target.value),
                          },
                        })
                      }
                    />
                    <button
                      className="row-remove"
                      aria-label={`删除世界旗标 ${name}`}
                      onClick={() => {
                        if (project.module.spatial && !window.confirm(`删除旗标 ${name} 及相关空间条件/效果引用？`)) return;
                        const flags = { ...state!.flags };
                        delete flags[name];
                        updateState({ ...state!, flags });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="connection-form">
                <label>
                  旗标名
                  <input
                    value={flagName}
                    onChange={(event) => setFlagName(event.target.value)}
                    placeholder="如：archive_unlocked"
                  />
                </label>
                <label>
                  初始值
                  <input
                    value={flagValue}
                    onChange={(event) => setFlagValue(event.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={!flagName.trim() || flagName.trim() in state.flags}
                  onClick={() => {
                    updateState({
                      ...state!,
                      flags: {
                        ...state!.flags,
                        [flagName.trim()]: parsedFlag(flagValue),
                      },
                    });
                    setFlagName("");
                  }}
                >
                  <Plus size={14} /> 添加旗标
                </button>
              </div>
            </section>
            <section className="form-section">
              <h2>案件时钟</h2>
              <p className="section-help">用于 Spatial 的 advance_clock 代价时，必须声明整数上限 max。</p>
              <div className="kv-rows">
                {Object.entries(state.case_clocks).map(([name, value]) => (
                  <div
                    className="kv-row"
                    style={{ gridTemplateColumns: "minmax(0, 1fr) 80px 100px 28px" }}
                    key={name}
                  >
                    <input value={name} readOnly />
                    <input
                      type="number"
                      min={0}
                      value={value}
                      aria-label={`案件时钟 ${name}`}
                      onChange={(event) => {
                        if (Number.isInteger(event.target.valueAsNumber))
                          updateState({
                            ...state!,
                            case_clocks: {
                              ...state!.case_clocks,
                              [name]: event.target.valueAsNumber,
                            },
                          });
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={typeof state.case_clock_definitions?.[name]?.max === "number" ? state.case_clock_definitions[name].max : ""}
                      aria-label={`时钟 ${name} 上限`}
                      placeholder="max"
                      onChange={(event) => {
                        const definitions = { ...state!.case_clock_definitions };
                        const definition = { ...definitions[name] };
                        if (Number.isInteger(event.target.valueAsNumber))
                          definition.max = event.target.valueAsNumber;
                        else delete definition.max;
                        definitions[name] = definition;
                        updateState({ ...state!, case_clock_definitions: definitions });
                      }}
                    />
                    <button
                      className="row-remove"
                      aria-label={`删除时钟 ${name}`}
                      onClick={() => {
                        if (project.module.spatial && !window.confirm(`删除时钟 ${name} 及相关空间条件/效果引用？`)) return;
                        const clocks = { ...state!.case_clocks };
                        const definitions = { ...state!.case_clock_definitions };
                        delete clocks[name];
                        delete definitions[name];
                        updateState({ ...state!, case_clocks: clocks, case_clock_definitions: definitions });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="connection-form">
                <label>
                  时钟名称
                  <input
                    value={clockName}
                    onChange={(event) => setClockName(event.target.value)}
                    placeholder="如：危险逼近"
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={
                    !clockName.trim() || clockName.trim() in state.case_clocks
                  }
                  onClick={() => {
                    updateState({
                      ...state!,
                      case_clocks: {
                        ...state!.case_clocks,
                        [clockName.trim()]: 0,
                      },
                    });
                    setClockName("");
                  }}
                >
                  <Plus size={14} /> 添加时钟
                </button>
              </div>
            </section>
          </div>
        ) : (
          <p className="inline-warning">
            调查员与世界 JSON 无法读取，请在「高级 JSON」中修复，草稿仍保留。
          </p>
        ))}
      {tab === "assets" && (
        <section className="form-section">
          <h2>素材映射</h2>
          <p className="section-help">
            登记包内图片或文档路径，再在场景、人物与线索的「素材
            ID」中引用。实际文件需由模组包提供。
          </p>
          <div className="segmented-control">
            {(
              [
                ["scenes", "场景素材"],
                ["npcs", "人物肖像"],
                ["clues", "线索素材"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={group === key}
                onClick={() => setGroup(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {assets ? (
            <>
              {Object.entries(assets[group]).map(([id, asset]) => (
                <div className="asset-row" key={id}>
                  <div className="section-heading">
                    <strong>{id}</strong>
                    <button
                      className="quiet-button"
                      aria-label={`删除素材 ${id}`}
                      onClick={() => {
                        const next = structuredClone(assets!);
                        delete next[group][id];
                        set("assets", format(next));
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <FormField
                      label="包内文件路径"
                      hint="如：assets/scenes/archive.webp"
                      wide
                    >
                      <input
                        value={asset.file}
                        onChange={(event) =>
                          patchAsset(id, { file: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="素材名称">
                      <input
                        value={asset.label ?? ""}
                        onChange={(event) =>
                          patchAsset(id, { label: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="媒体类型">
                      <input
                        value={asset.media_type ?? ""}
                        onChange={(event) =>
                          patchAsset(id, { media_type: event.target.value })
                        }
                        placeholder="image/webp"
                      />
                    </FormField>
                    <FormField label="替代文本" wide>
                      <input
                        value={asset.alt ?? ""}
                        onChange={(event) =>
                          patchAsset(id, { alt: event.target.value })
                        }
                      />
                    </FormField>
                  </div>
                  <small className="small-muted">
                    {Array.isArray(asset.reveal_on)
                      ? asset.reveal_on.length
                      : 0}{" "}
                    条自动揭示规则，可在高级 JSON 中编辑。
                  </small>
                </div>
              ))}
              <div className="connection-form">
                <label>
                  新的素材 ID
                  <input
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                    placeholder="如：archive_cover"
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={
                    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(assetId) ||
                    assetId in assets[group]
                  }
                  onClick={() => {
                    set(
                      "assets",
                      format({
                        ...assets!,
                        [group]: {
                          ...assets![group],
                          [assetId]: {
                            file: "",
                            label: "",
                            alt: "",
                            media_type: "",
                            reveal_on: [],
                          },
                        },
                      }),
                    );
                    setAssetId("");
                  }}
                >
                  <Plus size={14} /> 添加素材映射
                </button>
              </div>
            </>
          ) : (
            <p className="inline-warning">
              素材 JSON 无法读取，请在高级 JSON 中修复。
            </p>
          )}
        </section>
      )}
      {tab === "progression" && (
        <section className="form-section">
          <h2>主线线索</h2>
          <p className="section-help">
            勾选不可缺少的线索。编辑器会检查发现规则与检定失败替代路径。
          </p>
          <div className="check-grid">
            {Object.entries(project.module.clues).map(([id, clue]) => (
              <label className="check-option" key={id}>
                <input
                  type="checkbox"
                  checked={essential.includes(id)}
                  onChange={(event) =>
                    set(
                      "progression",
                      format({
                        essential_clue_ids: event.target.checked
                          ? [...new Set([...essential, id])]
                          : essential.filter((value) => value !== id),
                      }),
                    )
                  }
                />
                {clue.text}
              </label>
            ))}
          </div>
          {!Object.keys(project.module.clues).length && (
            <p className="small-muted">先从左侧创建线索，再安排主线。</p>
          )}
        </section>
      )}
      {tab === "advanced" && (
        <section className="form-section">
          <h2>完整世界配置</h2>
          <p className="section-help">
            保留契约中的全部字段。JSON 错误会阻止应用，不会覆盖工程。
          </p>
          <div className="content-json-grid">
            {(
              [
                ["initialState", "初始调查员、Flags 与案件时钟"],
                ["assets", "素材映射 JSON"],
                ["lorebook", "Lorebook v3"],
                ["progression", "主线配置 JSON"],
                ["theme", "主题 JSON"],
              ] as Array<[JsonKey, string]>
            ).map(([key, label]) => (
              <FormField key={key} label={label}>
                <textarea
                  className="mono-input"
                  rows={key === "initialState" ? 18 : 9}
                  value={draft[key]}
                  onChange={(event) => set(key, event.target.value)}
                />
              </FormField>
            ))}
          </div>
          <button
            className="secondary-button"
            style={{ marginTop: 18 }}
            onClick={() => {
              if (
                window.confirm("放弃尚未应用的世界配置草稿，重新载入当前工程？")
              ) {
                const fresh = makeDraft(project);
                setDraftState({ base: fresh, draft: fresh });
                setError("");
              }
            }}
          >
            <Eye size={15} /> 重新载入当前配置
          </button>
        </section>
      )}
      {error && (
        <p className="content-save-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="inline-success" role="status">
          {message}
        </p>
      )}
      <div className="world-actions">
        <button className="primary-button" onClick={save}>
          <Save size={16} /> 应用世界与素材
        </button>
        <span className="small-muted">
          切换分类或页面会保留草稿，应用后才写入工程。
        </span>
      </div>
    </div>
  );
}
