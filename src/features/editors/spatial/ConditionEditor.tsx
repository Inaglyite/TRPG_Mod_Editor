import { Plus, Trash2 } from "lucide-react";
import type {
  EditorProject,
  FlagValue,
  SpatialCondition,
} from "../../../domain/types";
import { alwaysCondition } from "../../../domain/spatial";
import { FormField } from "../FormControls";

const conditionLabels: Record<SpatialCondition["op"], string> = {
  always: "始终满足 / 不满足",
  all: "全部满足（AND）",
  any: "任一满足（OR）",
  not: "不满足（NOT）",
  flag: "旗标值",
  item: "当前持有物品及状态",
  clue: "调查员已知线索",
  clock: "时钟至少达到",
  completed: "调查动作已完成",
};

interface ReferenceOption {
  id: string;
  label?: string;
}

export function ReferenceSelect({
  label,
  value,
  options,
  onChange,
  empty = "请选择",
}: {
  label: string;
  value: string;
  options: ReferenceOption[];
  onChange: (value: string) => void;
  empty?: string;
}) {
  const known = options.some((option) => option.id === value);
  return (
    <FormField label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{empty}</option>
        {!known && value && <option value={value}>{value}（无效引用）</option>}
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label ? `${option.label}（${option.id}）` : option.id}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function initialScalar(value: unknown): FlagValue {
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return 0;
  return "";
}

export function ScalarValueEditor({
  project,
  flagId,
  value,
  onChange,
}: {
  project: EditorProject;
  flagId: string;
  value: FlagValue;
  onChange: (value: FlagValue) => void;
}) {
  const declared = project.module.initial_state.flags[flagId];
  if (typeof declared === "boolean") {
    return (
      <FormField label="比较值">
        <select
          aria-label="旗标比较值"
          value={String(value)}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">是（true）</option>
          <option value="false">否（false）</option>
        </select>
      </FormField>
    );
  }
  if (typeof declared === "number") {
    return (
      <FormField label="比较值" hint="必须与初始旗标同为整数">
        <input
          aria-label="旗标比较值"
          type="number"
          step={1}
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </FormField>
    );
  }
  return (
    <FormField label="比较值" hint="文本比较使用严格相等">
      <input
        aria-label="旗标比较值"
        key={`${flagId}:${typeof declared}`}
        defaultValue={typeof value === "string" ? value : ""}
        onBlur={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

function defaultCondition(
  op: SpatialCondition["op"],
  project: EditorProject,
): SpatialCondition {
  const spatial = project.module.spatial!;
  const flagId = Object.keys(project.module.initial_state.flags)[0] ?? "";
  const itemId = Object.keys(spatial.items)[0] ?? "";
  const clueId = Object.keys(project.module.clues)[0] ?? "";
  const clockId = Object.keys(project.module.initial_state.case_clocks)[0] ?? "";
  const pointId = Object.keys(spatial.points)[0] ?? "";
  const actionId = Object.keys(spatial.points[pointId]?.actions ?? {})[0] ?? "";
  switch (op) {
    case "always":
      return alwaysCondition();
    case "all":
    case "any":
      return { op, conditions: [alwaysCondition()] };
    case "not":
      return { op, condition: alwaysCondition() };
    case "flag":
      return {
        op,
        flag_id: flagId,
        value: initialScalar(project.module.initial_state.flags[flagId]),
      };
    case "item":
      return { op, item_id: itemId, quantity: 1, minimum_states: {} };
    case "clue":
      return { op, clue_id: clueId };
    case "clock":
      return { op, clock_id: clockId, minimum: 0 };
    case "completed":
      return { op, point_id: pointId, action_id: actionId };
  }
}

export function ConditionEditor({
  project,
  value,
  onChange,
  depth = 0,
  onRemove,
}: {
  project: EditorProject;
  value: SpatialCondition;
  onChange: (value: SpatialCondition) => void;
  depth?: number;
  onRemove?: () => void;
}) {
  const spatial = project.module.spatial!;
  const flags = Object.keys(project.module.initial_state.flags);
  const scenes = project.module.scenes;
  const items = Object.entries(spatial.items).map(([id, item]) => ({ id, label: item.label }));
  const points = Object.entries(spatial.points).map(([id, point]) => ({ id, label: point.name }));
  const changeType = (op: SpatialCondition["op"]) => onChange(defaultCondition(op, project));

  return (
    <div className={`condition-node condition-${value.op}`}>
      <div className="condition-node-heading">
        <FormField label="条件类型">
          <select value={value.op} onChange={(event) => changeType(event.target.value as SpatialCondition["op"])}>
            {Object.entries(conditionLabels).map(([id, label]) => (
              <option value={id} key={id}>{label}</option>
            ))}
          </select>
        </FormField>
        {onRemove && (
          <button
            type="button"
            className="danger-icon-button"
            aria-label="删除条件"
            title="删除条件"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {value.op === "always" && (
        <FormField label="固定结果">
          <select
            value={String(value.value)}
            onChange={(event) => onChange({ op: "always", value: event.target.value === "true" })}
          >
            <option value="true">始终满足</option>
            <option value="false">始终不满足</option>
          </select>
        </FormField>
      )}

      {(value.op === "all" || value.op === "any") && (
        <div className="condition-children">
          {value.conditions.map((child, index) => (
            <ConditionEditor
              key={index}
              project={project}
              value={child}
              depth={depth + 1}
              onChange={(next) => {
                const conditions = [...value.conditions];
                conditions[index] = next;
                onChange({ ...value, conditions });
              }}
              onRemove={value.conditions.length > 1 ? () => {
                onChange({ ...value, conditions: value.conditions.filter((_, childIndex) => childIndex !== index) });
              } : undefined}
            />
          ))}
          <button
            type="button"
            className="row-add"
            disabled={value.conditions.length >= 16 || depth >= 8}
            onClick={() => onChange({ ...value, conditions: [...value.conditions, alwaysCondition()] })}
          >
            <Plus size={14} /> 添加子条件
          </button>
          {depth >= 8 && <small className="small-muted">已达到条件树最大深度。</small>}
        </div>
      )}

      {value.op === "not" && (
        <ConditionEditor
          project={project}
          value={value.condition}
          depth={depth + 1}
          onChange={(condition) => onChange({ op: "not", condition })}
        />
      )}

      {value.op === "flag" && (
        <div className="form-grid compact-grid">
          <ReferenceSelect
            label="旗标"
            value={value.flag_id}
            options={flags.map((id) => ({ id }))}
            empty="请先在「世界与素材」声明旗标"
            onChange={(flagId) => onChange({
              ...value,
              flag_id: flagId,
              value: initialScalar(project.module.initial_state.flags[flagId]),
            })}
          />
          <ScalarValueEditor
            project={project}
            flagId={value.flag_id}
            value={value.value}
            onChange={(scalar) => onChange({ ...value, value: scalar })}
          />
        </div>
      )}

      {value.op === "item" && (
        <div className="condition-item-fields">
          <div className="form-grid compact-grid">
            <ReferenceSelect
              label="物品定义"
              value={value.item_id}
              options={items}
              empty="请先创建物品定义"
              onChange={(itemId) => onChange({ ...value, item_id: itemId, minimum_states: {} })}
            />
            <FormField label="至少持有数量">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={value.quantity}
                onChange={(event) => onChange({ ...value, quantity: Number(event.target.value) })}
              />
            </FormField>
          </div>
          <div className="minimum-state-list">
            <span className="field-label">状态门槛（可选）</span>
            {Object.entries(value.minimum_states).map(([state, minimum]) => (
              <div className="minimum-state-row" key={state}>
                <ReferenceSelect
                  label="状态"
                  value={state}
                  options={Object.keys(spatial.items[value.item_id]?.states ?? {}).map((id) => ({ id }))}
                  onChange={(nextState) => {
                    const states = { ...value.minimum_states };
                    delete states[state];
                    states[nextState] = minimum;
                    onChange({ ...value, minimum_states: states });
                  }}
                />
                <FormField label="至少为">
                  <input
                    type="number"
                    step={1}
                    value={minimum}
                    onChange={(event) => {
                      onChange({ ...value, minimum_states: { ...value.minimum_states, [state]: Number(event.target.value) } });
                    }}
                  />
                </FormField>
                <button
                  type="button"
                  className="danger-icon-button"
                  aria-label={`移除状态门槛 ${state}`}
                  title="移除状态门槛"
                  onClick={() => {
                    const states = { ...value.minimum_states };
                    delete states[state];
                    onChange({ ...value, minimum_states: states });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <select
              aria-label="添加状态门槛"
              value=""
              disabled={!spatial.items[value.item_id]}
              onChange={(event) => {
                if (!event.target.value) return;
                const state = spatial.items[value.item_id].states[event.target.value];
                onChange({
                  ...value,
                  minimum_states: { ...value.minimum_states, [event.target.value]: state.initial },
                });
              }}
            >
              <option value="">添加状态门槛…</option>
              {Object.keys(spatial.items[value.item_id]?.states ?? {})
                .filter((id) => !(id in value.minimum_states))
                .map((id) => <option value={id} key={id}>{id}</option>)}
            </select>
          </div>
          <p className="section-help">判断当前调查员实际持有的物品实例，不代表“曾经获得”。</p>
        </div>
      )}

      {value.op === "clue" && (
        <ReferenceSelect
          label="线索"
          value={value.clue_id}
          options={Object.entries(project.module.clues).map(([id, clue]) => ({ id, label: clue.text }))}
          empty="请先创建线索"
          onChange={(clueId) => onChange({ ...value, clue_id: clueId })}
        />
      )}

      {value.op === "clock" && (
        <div className="form-grid compact-grid">
          <ReferenceSelect
            label="案件时钟"
            value={value.clock_id}
            options={Object.keys(project.module.initial_state.case_clocks).map((id) => ({ id }))}
            empty="请先声明案件时钟"
            onChange={(clockId) => onChange({ ...value, clock_id: clockId })}
          />
          <FormField label="最小值">
            <input
              type="number"
              min={0}
              max={100000}
              step={1}
              value={value.minimum}
              onChange={(event) => onChange({ ...value, minimum: Number(event.target.value) })}
            />
          </FormField>
        </div>
      )}

      {value.op === "completed" && (
        <div className="form-grid compact-grid">
          <ReferenceSelect
            label="调查点"
            value={value.point_id}
            options={points}
            onChange={(pointId) => onChange({
              ...value,
              point_id: pointId,
              action_id: Object.keys(spatial.points[pointId]?.actions ?? {})[0] ?? "",
            })}
          />
          <ReferenceSelect
            label="已完成动作"
            value={value.action_id}
            options={Object.keys(spatial.points[value.point_id]?.actions ?? {}).map((id) => ({ id }))}
            onChange={(actionId) => onChange({ ...value, action_id: actionId })}
          />
        </div>
      )}
      {Object.keys(scenes).length === 0 && <p className="inline-warning">请先创建场景。</p>}
    </div>
  );
}
