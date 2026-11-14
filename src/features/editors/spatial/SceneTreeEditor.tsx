import { EyeOff, Folder, MapPin } from "lucide-react";
import { useState } from "react";
import {
  containerDescendants,
  defaultNode,
  isLeafScene,
} from "../../../domain/spatial";
import type { SpatialNode } from "../../../domain/types";
import { useEditorStore } from "../../../store/editor-store";
import { FormField } from "../FormControls";
import { ReferenceSelect } from "./ConditionEditor";

export function SceneTreeEditor() {
  const project = useEditorStore((state) => state.project);
  const updateSpatial = useEditorStore((state) => state.updateSpatial);
  const updateScene = useEditorStore((state) => state.updateScene);
  const setEntryScene = useEditorStore((state) => state.setEntryScene);
  const select = useEditorStore((state) => state.select);
  const spatial = project.module.spatial!;
  const [requestedId, setRequestedId] = useState(project.module.entry_scene_id);
  const sceneIds = Object.keys(project.module.scenes);
  const selectedId = sceneIds.includes(requestedId)
    ? requestedId
    : sceneIds[0];
  const scene = project.module.scenes[selectedId];
  const node = spatial.nodes[selectedId] ?? defaultNode();

  const updateNode = (patch: Partial<SpatialNode>) => {
    updateSpatial({
      ...spatial,
      nodes: {
        ...spatial.nodes,
        [selectedId]: { ...node, ...patch },
      },
    });
  };

  const childrenOf = (parentId: string | null) =>
    sceneIds.filter((id) => {
      if (id === parentId) return false;
      const parent = spatial.nodes[id]?.parent_scene_id ?? null;
      return parent === parentId;
    });
  const hasParentCycle = (id: string) => {
    const seen = new Set([id]);
    let parent = spatial.nodes[id]?.parent_scene_id;
    while (parent) {
      if (seen.has(parent)) return true;
      seen.add(parent);
      parent = spatial.nodes[parent]?.parent_scene_id;
    }
    return false;
  };
  const roots = sceneIds.filter((id) => {
    const parent = spatial.nodes[id]?.parent_scene_id;
    return !parent || !project.module.scenes[parent] || parent === id || hasParentCycle(id);
  });

  const renderTree = (ids: string[], ancestors: Set<string>, depth: number) => (
    <ul className="spatial-scene-tree" data-depth={depth}>
      {ids.map((id) => {
        const current = spatial.nodes[id] ?? defaultNode();
        const cyclic = ancestors.has(id);
        const children = cyclic ? [] : childrenOf(id);
        return (
          <li key={id}>
            <button
              type="button"
              className={id === selectedId ? "is-active" : ""}
              aria-pressed={id === selectedId}
              onClick={() => setRequestedId(id)}
            >
              {current.kind === "container" ? <Folder size={15} /> : <MapPin size={15} />}
              <span>{project.module.scenes[id].name}</span>
              <code>{id}</code>
              {current.hidden && <EyeOff size={13} aria-label="隐藏场景" />}
            </button>
            {children.length > 0 && renderTree(children, new Set([...ancestors, id]), depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  const descendants = containerDescendants(spatial, selectedId);
  const parentOptions = Object.entries(spatial.nodes)
    .filter(([id, candidate]) =>
      id !== selectedId &&
      candidate.kind === "container" &&
      !descendants.has(id) &&
      id in project.module.scenes,
    )
    .map(([id]) => ({ id, label: project.module.scenes[id].name }));
  const entryOptions = [...descendants]
    .filter((id) => isLeafScene(spatial, id) && id in project.module.scenes)
    .map((id) => ({ id, label: project.module.scenes[id].name }));

  return (
    <div className="spatial-scene-layout">
      <section className="form-section spatial-tree-panel">
        <div className="section-heading">
          <h2>场景层级</h2>
          <span className="small-muted">{sceneIds.length} 个场景</span>
        </div>
        {renderTree(roots, new Set(), 0)}
        <p className="section-help">容器用于组织场景；location 是调查员实际所在的叶场景。</p>
      </section>

      <section className="form-section spatial-node-editor">
        <div className="section-heading">
          <h2>编辑场景</h2>
          {project.module.entry_scene_id !== selectedId && (
            <button type="button" className="text-button" onClick={() => setEntryScene(selectedId)}>
              设为故事入口
            </button>
          )}
        </div>
        <div className="form-grid">
          <FormField label="场景名称" hint="名称保存在现有 module.scenes 中">
            <input
              key={`${selectedId}:name:${scene.name}`}
              defaultValue={scene.name}
              onBlur={(event) => updateScene(selectedId, { ...scene, name: event.target.value })}
            />
          </FormField>
          <FormField label="节点类型">
            <select
              value={node.kind}
              onChange={(event) => {
                const kind = event.target.value as SpatialNode["kind"];
                updateNode({
                  kind,
                  entry_scene_id: kind === "container" ? entryOptions[0]?.id ?? null : null,
                });
              }}
            >
              <option value="location">location · 叶场景</option>
              <option value="container">container · 容器</option>
            </select>
          </FormField>
          <FormField label="场景描述" wide>
            <textarea
              key={`${selectedId}:description:${scene.description}`}
              rows={5}
              defaultValue={scene.description}
              onBlur={(event) => updateScene(selectedId, { ...scene, description: event.target.value })}
            />
          </FormField>
          <ReferenceSelect
            label="父场景（container）"
            value={node.parent_scene_id ?? ""}
            options={parentOptions}
            empty="无父场景（顶层）"
            onChange={(parentId) => updateNode({ parent_scene_id: parentId || null })}
          />
          {node.kind === "container" && (
            <ReferenceSelect
              label="容器入口叶场景"
              value={node.entry_scene_id ?? ""}
              options={entryOptions}
              empty="请先设置子场景及父链"
              onChange={(entryId) => updateNode({ entry_scene_id: entryId || null })}
            />
          )}
        </div>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={node.hidden}
            onChange={(event) => updateNode({ hidden: event.target.checked })}
          />
          <span>初始隐藏，需要通过 reveal_scene 等效果揭示</span>
        </label>
        <div className="inline-help spatial-contract-note">
          父子关系只表达层级：不会自动开放子房间，也不会让 NPC 自动共享在场状态。
          调查点只能挂在 location 叶场景。
        </div>
        <button type="button" className="secondary-button" onClick={() => select({ kind: "scene", id: selectedId })}>
          编辑出口、在场人物与遭遇
        </button>
      </section>
    </div>
  );
}
