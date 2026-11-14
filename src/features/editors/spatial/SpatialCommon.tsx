import type { ReactNode } from "react";
import { FormField } from "../FormControls";

export function SpatialIdInput({
  value,
  onRename,
}: {
  value: string;
  onRename: (next: string) => boolean;
}) {
  return (
    <FormField label="稳定 ID" hint="重命名会同步更新现有条件和效果引用">
      <input
        key={value}
        className="mono-input"
        defaultValue={value}
        maxLength={64}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          if (next === value) return;
          if (onRename(next)) return;
          event.currentTarget.value = value;
          window.alert("ID 格式无效或已存在；应使用字母/数字开头，仅含字母、数字、_、-");
        }}
      />
    </FormField>
  );
}

export function SpatialList({
  label,
  entries,
  selectedId,
  onSelect,
  action,
}: {
  label: string;
  entries: Array<{ id: string; title: string; detail?: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  action?: ReactNode;
}) {
  return (
    <section className="spatial-entity-list" aria-label={label}>
      <div className="section-heading">
        <h2>{label}</h2>
        {action}
      </div>
      <div className="spatial-entity-items">
        {entries.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={entry.id === selectedId ? "is-active" : ""}
            aria-pressed={entry.id === selectedId}
            onClick={() => onSelect(entry.id)}
          >
            <strong>{entry.title}</strong>
            <code>{entry.id}</code>
            {entry.detail && <small>{entry.detail}</small>}
          </button>
        ))}
        {!entries.length && <p className="small-muted">尚未创建内容。</p>}
      </div>
    </section>
  );
}
