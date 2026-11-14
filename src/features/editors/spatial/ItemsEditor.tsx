import { Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "../../../store/editor-store";
import { FormField } from "../FormControls";
import { SpatialIdInput, SpatialList } from "./SpatialCommon";

export function ItemsEditor() {
  const project = useEditorStore((state) => state.project);
  const updateSpatial = useEditorStore((state) => state.updateSpatial);
  const addEntity = useEditorStore((state) => state.addSpatialEntity);
  const renameEntity = useEditorStore((state) => state.renameSpatialEntity);
  const removeEntity = useEditorStore((state) => state.removeSpatialEntity);
  const spatial = project.module.spatial!;
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const itemIds = Object.keys(spatial.items);
  const itemId = requestedId && spatial.items[requestedId] ? requestedId : itemIds[0] ?? null;
  const item = itemId ? spatial.items[itemId] : null;

  return (
    <div className="spatial-collection-layout">
      <SpatialList
        label="物品定义"
        entries={Object.entries(spatial.items).map(([id, definition]) => ({
          id,
          title: definition.label,
          detail: `${Object.keys(definition.states).length} 项数值状态`,
        }))}
        selectedId={itemId}
        onSelect={setRequestedId}
        action={
          <button
            type="button"
            className="secondary-button"
            disabled={itemIds.length >= 256}
            onClick={() => {
              const id = addEntity("item");
              if (id) setRequestedId(id);
            }}
          >
            <Plus size={14} /> 添加物品
          </button>
        }
      />
      {!item || !itemId ? (
        <section className="form-section spatial-empty-editor">
          <Package size={28} />
          <h2>定义可持有的物品</h2>
          <p>物品 ID 是定义 ID；运行时的独立实例由本体库存登记。</p>
        </section>
      ) : (
        <div className="spatial-detail-column">
          <section className="form-section">
            <div className="section-heading">
              <h2>物品身份</h2>
              <button
                type="button"
                className="danger-icon-button"
                aria-label="删除物品"
                title="删除物品"
                onClick={() => {
                  if (window.confirm("删除物品及其条件、效果和通路代价引用？相关条件不会自动变为开放。")) {
                    removeEntity("item", itemId);
                    setRequestedId(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              <SpatialIdInput
                value={itemId}
                onRename={(next) => {
                  const renamed = renameEntity("item", itemId, next);
                  if (renamed) setRequestedId(next);
                  return renamed;
                }}
              />
              <FormField label="唯一物品名称" hint="用于匹配旧背包；不能与另一项物品定义重复">
                <input
                  key={`${itemId}:${item.label}`}
                  defaultValue={item.label}
                  maxLength={160}
                  onBlur={(event) => updateSpatial({
                    ...spatial,
                    items: { ...spatial.items, [itemId]: { ...item, label: event.target.value } },
                  })}
                />
              </FormField>
            </div>
            <p className="inline-help">
              有条件判断和开锁消耗都读取当前实际持有的实例。带状态的物品数量固定为 1，多把钥匙不会共用同一份充能值。
            </p>
          </section>
          <section className="form-section">
            <div className="section-heading">
              <h2>数值状态</h2>
              <button
                type="button"
                className="secondary-button"
                onClick={() => addEntity("state", itemId)}
              >
                <Plus size={14} /> 添加状态
              </button>
            </div>
            {!Object.keys(item.states).length && (
              <p className="small-muted">无状态物品可以按数量持有；添加 charge 等状态后将逐件登记。</p>
            )}
            <div className="item-state-list">
              {Object.entries(item.states).map(([stateId, state]) => (
                <div className="item-state-card" key={stateId}>
                  <div className="section-heading">
                    <h3>{stateId}</h3>
                    <button
                      type="button"
                      className="danger-icon-button"
                      aria-label={`删除状态 ${stateId}`}
                      title="删除状态"
                      onClick={() => {
                        if (window.confirm(`删除状态 ${stateId} 及其条件/效果引用？`)) {
                          removeEntity("state", stateId, itemId);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="form-grid compact-grid item-state-fields">
                    <SpatialIdInput
                      value={stateId}
                      onRename={(next) => renameEntity("state", stateId, next, itemId)}
                    />
                    {(["initial", "minimum", "maximum"] as const).map((field) => (
                      <FormField label={{ initial: "初始值", minimum: "下限", maximum: "上限" }[field]} key={field}>
                        <input
                          type="number"
                          step={1}
                          min={field === "maximum" ? 0 : undefined}
                          max={field === "maximum" ? 100000 : undefined}
                          value={state[field]}
                          onChange={(event) => updateSpatial({
                            ...spatial,
                            items: {
                              ...spatial.items,
                              [itemId]: {
                                ...item,
                                states: {
                                  ...item.states,
                                  [stateId]: { ...state, [field]: Number(event.target.value) },
                                },
                              },
                            },
                          })}
                        />
                      </FormField>
                    ))}
                  </div>
                  <p className="small-muted">要求：下限 ≤ 初始值 ≤ 上限；本体拒绝溢出，不会免费钳制数值。</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
