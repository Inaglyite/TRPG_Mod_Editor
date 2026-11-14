import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { spatialLeafId } from "../../../domain/spatial";
import type { SpatialConnection, SpatialEffect } from "../../../domain/types";
import { useEditorStore } from "../../../store/editor-store";
import { FormField } from "../FormControls";
import { ConditionEditor, ReferenceSelect } from "./ConditionEditor";
import { EffectListEditor } from "./EffectEditor";
import { SpatialIdInput, SpatialList } from "./SpatialCommon";

export function ConnectionsEditor() {
  const project = useEditorStore((state) => state.project);
  const updateSpatial = useEditorStore((state) => state.updateSpatial);
  const addEntity = useEditorStore((state) => state.addSpatialEntity);
  const renameEntity = useEditorStore((state) => state.renameSpatialEntity);
  const removeEntity = useEditorStore((state) => state.removeSpatialEntity);
  const spatial = project.module.spatial!;
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const connectionIds = Object.keys(spatial.connections);
  const selectedId = requestedId && spatial.connections[requestedId]
    ? requestedId
    : connectionIds[0] ?? null;
  const connection = selectedId ? spatial.connections[selectedId] : null;
  const sceneOptions = Object.entries(project.module.scenes).map(([id, scene]) => ({ id, label: scene.name }));
  const update = (next: SpatialConnection) => {
    if (!selectedId) return;
    updateSpatial({ ...spatial, connections: { ...spatial.connections, [selectedId]: next } });
  };
  const legacyPairs = connection
    ? [
        [spatialLeafId(spatial, connection.source_scene_id), spatialLeafId(spatial, connection.target_scene_id)],
        ...(connection.bidirectional
          ? [[spatialLeafId(spatial, connection.target_scene_id), spatialLeafId(spatial, connection.source_scene_id)]]
          : []),
      ].filter(([source, target]) => project.module.scenes[source]?.exits.includes(target))
    : [];

  return (
    <div className="spatial-collection-layout">
      <SpatialList
        label="通路"
        entries={Object.entries(spatial.connections).map(([id, item]) => ({
          id,
          title: `${project.module.scenes[item.source_scene_id]?.name ?? item.source_scene_id} → ${project.module.scenes[item.target_scene_id]?.name ?? item.target_scene_id}`,
          detail: item.remember_unlock ? "记住开锁" : item.bidirectional ? "双向" : "单向",
        }))}
        selectedId={selectedId}
        onSelect={setRequestedId}
        action={
          <button
            type="button"
            className="secondary-button"
            disabled={Object.keys(project.module.scenes).length < 2}
            onClick={() => {
              const id = addEntity("connection");
              if (id) setRequestedId(id);
            }}
          >
            <Plus size={14} /> 添加通路
          </button>
        }
      />
      {!connection || !selectedId ? (
        <section className="form-section spatial-empty-editor">
          <ArrowLeftRight size={28} />
          <h2>连接两个场景</h2>
          <p>显式通路优先于同方向的旧 exits，适合配置暗门和门锁。</p>
        </section>
      ) : (
        <div className="spatial-detail-column">
          <section className="form-section">
            <div className="section-heading">
              <h2>通路设置</h2>
              <button
                type="button"
                className="danger-icon-button"
                aria-label="删除通路"
                title="删除通路"
                onClick={() => {
                  if (window.confirm("删除这条通路及其解锁效果引用？")) {
                    removeEntity("connection", selectedId);
                    setRequestedId(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              <SpatialIdInput
                value={selectedId}
                onRename={(next) => {
                  const renamed = renameEntity("connection", selectedId, next);
                  if (renamed) setRequestedId(next);
                  return renamed;
                }}
              />
              <FormField label="方向">
                <label className="switch-row compact-switch">
                  <input
                    type="checkbox"
                    checked={connection.bidirectional}
                    onChange={(event) => update({ ...connection, bidirectional: event.target.checked })}
                  />
                  <span>双向通行，共用开锁状态</span>
                </label>
              </FormField>
              <ReferenceSelect
                label="起点场景或容器"
                value={connection.source_scene_id}
                options={sceneOptions}
                onChange={(sceneId) => update({ ...connection, source_scene_id: sceneId })}
              />
              <ReferenceSelect
                label="终点场景或容器"
                value={connection.target_scene_id}
                options={sceneOptions}
                onChange={(sceneId) => update({ ...connection, target_scene_id: sceneId })}
              />
            </div>
            {legacyPairs.length > 0 && (
              <p className="inline-help">
                检测到同方向旧 exits。导出时保留兼容声明，本体只使用这里的显式通路条件，不会生成另一条开放连接。
              </p>
            )}
          </section>
          <section className="form-section">
            <h2>可以知道这个入口</h2>
            <p className="section-help">只控制入口是否可见，不代表满足通行条件。</p>
            <ConditionEditor
              project={project}
              value={connection.visible_when}
              onChange={(visibleWhen) => update({ ...connection, visible_when: visibleWhen })}
            />
          </section>
          <section className="form-section">
            <h2>满足条件才能通过</h2>
            <p className="section-help">钥匙条件判断当前持有的独立物品实例及其实际状态。</p>
            <ConditionEditor
              project={project}
              value={connection.requires}
              onChange={(requires) => update({ ...connection, requires })}
            />
            <label className="switch-row">
              <input
                type="checkbox"
                checked={connection.remember_unlock}
                onChange={(event) => update({ ...connection, remember_unlock: event.target.checked })}
              />
              <span>首次通过后记住开锁，后续不再重复收取代价</span>
            </label>
          </section>
          <section className="form-section">
            <h2>开锁代价</h2>
            <p className="section-help">例如持有 charge ≥ 1 的钥匙，首次通过扣除 1；条件与消耗绑定同一实例。</p>
            <EffectListEditor
              project={project}
              mode="costs"
              effects={connection.costs}
              onChange={(effects) => update({
                ...connection,
                costs: effects.filter((effect): effect is Extract<SpatialEffect, { kind: "adjust_item_state" }> => effect.kind === "adjust_item_state"),
              })}
            />
          </section>
        </div>
      )}
    </div>
  );
}
