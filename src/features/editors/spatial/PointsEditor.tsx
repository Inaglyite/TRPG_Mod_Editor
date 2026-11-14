import { Search, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { isLeafScene } from "../../../domain/spatial";
import type { SpatialAction, SpatialPoint } from "../../../domain/types";
import { useEditorStore } from "../../../store/editor-store";
import { FormField } from "../FormControls";
import { ConditionEditor, ReferenceSelect } from "./ConditionEditor";
import { EffectListEditor } from "./EffectEditor";
import { SpatialIdInput, SpatialList } from "./SpatialCommon";

const intents: Array<{ id: SpatialAction["intent"]; label: string }> = [
  { id: "examine", label: "查看 · examine" },
  { id: "search", label: "搜索 · search" },
  { id: "read", label: "阅读 · read" },
  { id: "take", label: "拿取 · take" },
  { id: "talk", label: "交谈 · talk" },
  { id: "enter", label: "进入 · enter" },
  { id: "use", label: "使用 · use" },
];

export function PointsEditor() {
  const project = useEditorStore((state) => state.project);
  const updateSpatial = useEditorStore((state) => state.updateSpatial);
  const addEntity = useEditorStore((state) => state.addSpatialEntity);
  const renameEntity = useEditorStore((state) => state.renameSpatialEntity);
  const removeEntity = useEditorStore((state) => state.removeSpatialEntity);
  const spatial = project.module.spatial!;
  const [requestedPointId, setRequestedPointId] = useState<string | null>(null);
  const [requestedActionId, setRequestedActionId] = useState<string | null>(null);
  const pointIds = Object.keys(spatial.points);
  const pointId = requestedPointId && spatial.points[requestedPointId]
    ? requestedPointId
    : pointIds[0] ?? null;
  const point = pointId ? spatial.points[pointId] : null;
  const actionIds = Object.keys(point?.actions ?? {});
  const actionId = requestedActionId && point?.actions[requestedActionId]
    ? requestedActionId
    : actionIds[0] ?? null;
  const action = point && actionId ? point.actions[actionId] : null;
  const leafOptions = Object.entries(project.module.scenes)
    .filter(([id]) => isLeafScene(spatial, id))
    .map(([id, scene]) => ({ id, label: scene.name }));
  const updatePoint = (next: SpatialPoint) => {
    if (!pointId) return;
    updateSpatial({ ...spatial, points: { ...spatial.points, [pointId]: next } });
  };
  const updateAction = (next: SpatialAction) => {
    if (!point || !actionId) return;
    updatePoint({ ...point, actions: { ...point.actions, [actionId]: next } });
  };

  return (
    <div className="spatial-collection-layout">
      <SpatialList
        label="调查点"
        entries={Object.entries(spatial.points).map(([id, item]) => ({
          id,
          title: item.name,
          detail: `${project.module.scenes[item.scene_id]?.name ?? item.scene_id} · ${Object.keys(item.actions).length} 个动作`,
        }))}
        selectedId={pointId}
        onSelect={(id) => {
          setRequestedPointId(id);
          setRequestedActionId(null);
        }}
        action={
          <button
            type="button"
            className="secondary-button"
            disabled={!leafOptions.length}
            onClick={() => {
              const id = addEntity("point");
              if (id) {
                setRequestedPointId(id);
                setRequestedActionId(null);
              }
            }}
          >
            <Plus size={14} /> 添加调查点
          </button>
        }
      />
      {!point || !pointId ? (
        <section className="form-section spatial-empty-editor">
          <Search size={28} />
          <h2>在叶场景中放置调查点</h2>
          <p>查看、搜索、阅读、拿取和使用分别配置；信息不等于实物。</p>
        </section>
      ) : (
        <div className="spatial-detail-column">
          <section className="form-section">
            <div className="section-heading">
              <h2>调查点公开信息</h2>
              <button
                type="button"
                className="danger-icon-button"
                aria-label="删除调查点"
                title="删除调查点"
                onClick={() => {
                  if (window.confirm("删除调查点、其中动作及相关 completed 引用？")) {
                    removeEntity("point", pointId);
                    setRequestedPointId(null);
                    setRequestedActionId(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              <SpatialIdInput
                value={pointId}
                onRename={(next) => {
                  const renamed = renameEntity("point", pointId, next);
                  if (renamed) setRequestedPointId(next);
                  return renamed;
                }}
              />
              <ReferenceSelect
                label="所属叶场景"
                value={point.scene_id}
                options={leafOptions}
                onChange={(sceneId) => updatePoint({ ...point, scene_id: sceneId })}
              />
              <FormField label="调查点名称">
                <input
                  key={`${pointId}:name:${point.name}`}
                  defaultValue={point.name}
                  maxLength={160}
                  onBlur={(event) => updatePoint({ ...point, name: event.target.value })}
                />
              </FormField>
              <FormField label="公开描述" wide>
                <textarea
                  key={`${pointId}:description:${point.description}`}
                  rows={4}
                  defaultValue={point.description}
                  maxLength={1200}
                  onBlur={(event) => updatePoint({ ...point, description: event.target.value })}
                />
              </FormField>
            </div>
            <FormField label="调查点可见条件" wide>
              <ConditionEditor
                project={project}
                value={point.visible_when}
                onChange={(visibleWhen) => updatePoint({ ...point, visible_when: visibleWhen })}
              />
            </FormField>
          </section>

          <section className="form-section spatial-action-section">
            <div className="section-heading">
              <h2>调查动作</h2>
              <button
                type="button"
                className="secondary-button"
                disabled={actionIds.length >= 16}
                onClick={() => {
                  const id = addEntity("action", pointId);
                  if (id) setRequestedActionId(id);
                }}
              >
                <Plus size={14} /> 添加动作
              </button>
            </div>
            <div className="spatial-action-tabs" role="tablist" aria-label="调查点动作">
              {actionIds.map((id) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={id === actionId}
                  className={id === actionId ? "is-active" : ""}
                  key={id}
                  onClick={() => setRequestedActionId(id)}
                >
                  {id}<small>{point.actions[id].intent}</small>
                </button>
              ))}
            </div>
            {action && actionId && (
              <div className="spatial-action-editor">
                <div className="section-heading">
                  <h3>动作定义</h3>
                  <button
                    type="button"
                    className="danger-icon-button"
                    aria-label="删除动作"
                    title="删除动作"
                    disabled={actionIds.length <= 1}
                    onClick={() => {
                      if (window.confirm("删除该动作及相关 completed 引用？")) {
                        removeEntity("action", actionId, pointId);
                        setRequestedActionId(null);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="form-grid">
                  <SpatialIdInput
                    value={actionId}
                    onRename={(next) => {
                      const renamed = renameEntity("action", actionId, next, pointId);
                      if (renamed) setRequestedActionId(next);
                      return renamed;
                    }}
                  />
                  <FormField label="动作意图">
                    <select
                      value={action.intent}
                      onChange={(event) => updateAction({ ...action, intent: event.target.value as SpatialAction["intent"] })}
                    >
                      {intents.map((intent) => <option value={intent.id} key={intent.id}>{intent.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="动作别名" hint="英文逗号分隔，最多 16 个" wide>
                    <input
                      key={`${pointId}:${actionId}:aliases`}
                      defaultValue={action.aliases.join(", ")}
                      onBlur={(event) => updateAction({
                        ...action,
                        aliases: event.target.value.split(",").map((alias) => alias.trim()).filter(Boolean).slice(0, 16),
                      })}
                    />
                  </FormField>
                </div>
                <FormField label="动作前置条件" wide>
                  <ConditionEditor
                    project={project}
                    value={action.requires}
                    onChange={(requires) => updateAction({ ...action, requires })}
                  />
                </FormField>
                <div className="action-check-settings">
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={action.check !== null}
                      onChange={(event) => updateAction({
                        ...action,
                        check: event.target.checked ? { skill: "spot_hidden", difficulty: "regular" } : null,
                      })}
                    />
                    <span>需要本体实际检定</span>
                  </label>
                  {action.check && (
                    <div className="form-grid compact-grid">
                      <FormField label="技能 ID">
                        <input
                          className="mono-input"
                          key={`${pointId}:${actionId}:skill`}
                          defaultValue={action.check.skill}
                          onBlur={(event) => updateAction({ ...action, check: { ...action.check!, skill: event.target.value } })}
                        />
                      </FormField>
                      <FormField label="检定难度">
                        <select
                          value={action.check.difficulty}
                          onChange={(event) => updateAction({
                            ...action,
                            check: { ...action.check!, difficulty: event.target.value as "regular" | "hard" | "extreme" },
                          })}
                        >
                          <option value="regular">普通 · regular</option>
                          <option value="hard">困难 · hard</option>
                          <option value="extreme">极难 · extreme</option>
                        </select>
                      </FormField>
                    </div>
                  )}
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={action.repeat}
                      onChange={(event) => updateAction({ ...action, repeat: event.target.checked })}
                    />
                    <span>允许重复尝试；每次仍需新的真实检定回执</span>
                  </label>
                </div>
                <div className="effect-branch-grid">
                  <section>
                    <h3>成功后的结构化效果</h3>
                    <p className="section-help">grant_clue 只授予信息；拿取实物需另加 give_item。</p>
                    <EffectListEditor
                      project={project}
                      effects={action.success}
                      onChange={(success) => updateAction({ ...action, success })}
                    />
                  </section>
                  <section>
                    <h3>失败后的效果与保底</h3>
                    <p className="section-help">关键线索可在此授予，但必须先支付列出的真实代价。</p>
                    <EffectListEditor
                      project={project}
                      effects={action.failure}
                      onChange={(failure) => updateAction({ ...action, failure })}
                    />
                  </section>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
