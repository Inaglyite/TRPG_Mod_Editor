import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { FlagValue } from "../../domain/types";

export function FlagConditions({
  value,
  declared,
  onChange,
  label = "旗标条件",
}: {
  value: Record<string, FlagValue>;
  declared: Record<string, unknown>;
  onChange: (value: Record<string, FlagValue>) => void;
  label?: string;
}) {
  const [key, setKey] = useState("");
  const available = Object.keys(declared).filter((name) => !(name in value));
  return (
    <div className="form-field">
      <span className="field-label">{label}</span>
      {Object.entries(value).map(([name, current]) => (
        <div
          className="kv-row"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(80px, 1fr) 28px",
          }}
          key={name}
        >
          <input aria-label={`${label}名称`} value={name} readOnly />
          <input
            aria-label={`${name} 的${label}值`}
            defaultValue={String(current)}
            key={`${name}:${String(current)}`}
            onBlur={(event) => {
              const text = event.target.value;
              const next =
                text === "true"
                  ? true
                  : text === "false"
                    ? false
                    : /^-?\d+$/.test(text)
                      ? Number(text)
                      : text;
              if (next !== current) onChange({ ...value, [name]: next });
            }}
          />
          <button
            className="row-remove"
            aria-label={`删除旗标 ${name}`}
            onClick={() => {
              const next = { ...value };
              delete next[name];
              onChange(next);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div
        className="kv-row"
        style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}
      >
        <select
          aria-label={`添加${label}`}
          value={available.includes(key) ? key : ""}
          onChange={(event) => setKey(event.target.value)}
        >
          <option value="">选择已声明的旗标</option>
          {available.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button
          className="secondary-button"
          aria-label={`添加${label}`}
          disabled={!available.includes(key)}
          onClick={() => {
            const initial = declared[key];
            onChange({
              ...value,
              [key]:
                typeof initial === "boolean" ||
                typeof initial === "number" ||
                typeof initial === "string"
                  ? initial
                  : true,
            });
            setKey("");
          }}
        >
          <Plus size={14} /> 添加
        </button>
      </div>
      <small>
        值支持 true / false、整数或文本。新旗标在「世界与素材」中声明。
      </small>
    </div>
  );
}
