import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { EditorProject, SpatialEffect } from "../../../domain/types";
import { FormField } from "../FormControls";
import { ReferenceSelect, ScalarValueEditor } from "./ConditionEditor";

const effectLabels: Record<SpatialEffect["kind"], string> = {
  grant_clue: "获得线索信息",
  give_item: "取得实物",
  adjust_item_state: "调整物品状态",
  set_flag: "设置旗标",
  reveal_scene: "揭示场景",
  unlock_connection: "解锁通路",
  advance_clock: "推进时钟 / 支付代价",
};

type EffectKind = SpatialEffect["kind"];

function initialFlagValue(project: EditorProject, flagId: string) {
  const value = project.module.initial_state.flags[flagId];
  return typeof value === "boolean" ? false : typeof value === "number" ? 0 : "";
}

function makeEffect(
  kind: EffectKind,
  project: EditorProject,
): SpatialEffect {
  const spatial = project.module.spatial!;
  const itemId = Object.keys(spatial.items)[0] ?? "";
  const state = Object.keys(spatial.items[itemId]?.states ?? {})[0] ?? "";
  const flagId = Object.keys(project.module.initial_state.flags)[0] ?? "";
  switch (kind) {
    case "grant_clue":
      return { kind, clue_id: Object.keys(project.module.clues)[0] ?? "" };
    case "give_item":
      return { kind, item_id: itemId, quantity: 1 };
    case "adjust_item_state":
      return { kind, item_id: itemId, state, delta: 1 };
    case "set_flag":
      return { kind, flag_id: flagId, value: initialFlagValue(project, flagId) };
    case "reveal_scene":
      return { kind, scene_id: Object.keys(project.module.scenes)[0] ?? "" };
    case "unlock_connection":
      return { kind, connection_id: Object.keys(spatial.connections)[0] ?? "" };
    case "advance_clock":
      return { kind, clock_id: Object.keys(project.module.initial_state.case_clocks)[0] ?? "", amount: 1 };
  }
}

function EffectFields({
  project,
  effect,
  onChange,
  cost,
}: {
  project: EditorProject;
  effect: SpatialEffect;
  onChange: (effect: SpatialEffect) => void;
  cost: boolean;
}) {
  const spatial = project.module.spatial!;
  const itemOptions = Object.entries(spatial.items).map(([id, item]) => ({ id, label: item.label }));
  if (effect.kind === "grant_clue") {
    return (
      <ReferenceSelect
        label="线索信息"
        value={effect.clue_id}
        options={Object.entries(project.module.clues).map(([id, clue]) => ({ id, label: clue.text }))}
        empty="请先创建线索"
        onChange={(clueId) => onChange({ ...effect, clue_id: clueId })}
      />
    );
  }
  if (effect.kind === "give_item") {
    const stateful = Object.keys(spatial.items[effect.item_id]?.states ?? {}).length > 0;
    return (
      <div className="form-grid compact-grid">
        <ReferenceSelect
          label="实物定义"
          value={effect.item_id}
          options={itemOptions}
          empty="请先创建物品定义"
          onChange={(itemId) => onChange({ ...effect, item_id: itemId, quantity: 1 })}
        />
        <FormField label="数量" hint={stateful ? "有状态物品逐件登记，数量固定为 1" : undefined}>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={effect.quantity}
            disabled={stateful}
            onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })}
          />
        </FormField>
      </div>
    );
  }
  if (effect.kind === "adjust_item_state") {
    return (
      <div className="form-grid compact-grid three-columns">
        <ReferenceSelect
          label="物品定义"
          value={effect.item_id}
          options={itemOptions}
          onChange={(itemId) => onChange({
            ...effect,
            item_id: itemId,
            state: Object.keys(spatial.items[itemId]?.states ?? {})[0] ?? "",
          })}
        />
        <ReferenceSelect
          label="数值状态"
          value={effect.state}
          options={Object.keys(spatial.items[effect.item_id]?.states ?? {}).map((id) => ({ id }))}
          onChange={(state) => onChange({ ...effect, state })}
        />
        <FormField label={cost ? "消耗数量（负数）" : "变化量"}>
          <input
            type="number"
            min={-100000}
            max={cost ? -1 : 100000}
            step={1}
            value={effect.delta}
            onChange={(event) => onChange({ ...effect, delta: Number(event.target.value) })}
          />
        </FormField>
      </div>
    );
  }
  if (effect.kind === "set_flag") {
    return (
      <div className="form-grid compact-grid">
        <ReferenceSelect
          label="旗标"
          value={effect.flag_id}
          options={Object.keys(project.module.initial_state.flags).map((id) => ({ id }))}
          onChange={(flagId) => onChange({ ...effect, flag_id: flagId, value: initialFlagValue(project, flagId) })}
        />
        <ScalarValueEditor
          project={project}
          flagId={effect.flag_id}
          value={effect.value}
          onChange={(value) => onChange({ ...effect, value })}
        />
      </div>
    );
  }
  if (effect.kind === "reveal_scene") {
    return (
      <ReferenceSelect
        label="揭示场景"
        value={effect.scene_id}
        options={Object.entries(project.module.scenes).map(([id, scene]) => ({ id, label: scene.name }))}
        onChange={(sceneId) => onChange({ ...effect, scene_id: sceneId })}
      />
    );
  }
  if (effect.kind === "unlock_connection") {
    return (
      <ReferenceSelect
        label="解锁通路"
        value={effect.connection_id}
        options={Object.keys(spatial.connections).map((id) => ({ id }))}
        onChange={(connectionId) => onChange({ ...effect, connection_id: connectionId })}
      />
    );
  }
  const definition = project.module.initial_state.case_clock_definitions?.[effect.clock_id];
  return (
    <div className="form-grid compact-grid">
      <ReferenceSelect
        label="案件时钟"
        value={effect.clock_id}
        options={Object.keys(project.module.initial_state.case_clocks).map((id) => ({ id }))}
        onChange={(clockId) => onChange({ ...effect, clock_id: clockId })}
      />
      <FormField label="推进量" hint="必须在时钟 max 范围内实际支付">
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          value={effect.amount}
          onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })}
        />
      </FormField>
      {effect.clock_id && !Number.isInteger(definition?.max) && (
        <p className="inline-warning form-grid-wide">该时钟尚未声明整数 max，请先在世界设置中补齐。</p>
      )}
    </div>
  );
}

export function EffectListEditor({
  project,
  effects,
  onChange,
  mode = "effects",
}: {
  project: EditorProject;
  effects: SpatialEffect[];
  onChange: (effects: SpatialEffect[]) => void;
  mode?: "effects" | "costs";
}) {
  const costs = mode === "costs";
  const [nextKind, setNextKind] = useState<EffectKind>(costs ? "adjust_item_state" : "grant_clue");
  const limit = costs ? 8 : 16;
  return (
    <div className="effect-list">
      {effects.map((effect, index) => (
        <div className="effect-row" key={index}>
          <div className="effect-row-heading">
            <FormField label="效果类型">
              <select
                value={effect.kind}
                disabled={costs}
                onChange={(event) => {
                  const next = makeEffect(event.target.value as EffectKind, project);
                  if (costs && next.kind === "adjust_item_state") next.delta = -1;
                  onChange(effects.map((current, effectIndex) => effectIndex === index ? next : current));
                }}
              >
                {Object.entries(effectLabels)
                  .filter(([kind]) => !costs || kind === "adjust_item_state")
                  .map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}
              </select>
            </FormField>
            <button
              type="button"
              className="danger-icon-button"
              aria-label="删除效果"
              title="删除效果"
              onClick={() => onChange(effects.filter((_, effectIndex) => effectIndex !== index))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <EffectFields
            project={project}
            effect={effect}
            cost={costs}
            onChange={(next) => onChange(effects.map((current, effectIndex) => effectIndex === index ? next : current))}
          />
        </div>
      ))}
      <div className="effect-add-row">
        {!costs && (
          <select aria-label="待添加效果" value={nextKind} onChange={(event) => setNextKind(event.target.value as EffectKind)}>
            {Object.entries(effectLabels).map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}
          </select>
        )}
        <button
          type="button"
          className="row-add"
          disabled={effects.length >= limit}
          onClick={() => {
            const effect = makeEffect(costs ? "adjust_item_state" : nextKind, project);
            if (costs && effect.kind === "adjust_item_state") effect.delta = -1;
            onChange([...effects, effect]);
          }}
        >
          <Plus size={14} /> {costs ? "添加开锁状态消耗" : "添加效果"}
        </button>
      </div>
    </div>
  );
}
