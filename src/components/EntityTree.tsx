import {
  BookKey,
  Boxes,
  ChevronDown,
  CircleUserRound,
  Clapperboard,
  FileText,
  Settings2,
  Flag,
  Plus,
  Copy,
  Pencil,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { EditorProject, EntityKind, EntitySelection } from "../domain/types";

interface EntityTreeProps {
  project: EditorProject;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onAdd: (kind: Exclude<EntityKind, "manifest" | "content">) => void;
  onRename: (kind: Exclude<EntityKind, "manifest" | "content">, id: string, nextId: string) => boolean;
  onDuplicate: (kind: Exclude<EntityKind, "manifest" | "content">, id: string) => void;
}

interface TreeSectionProps {
  label: string;
  kind: Exclude<EntityKind, "manifest" | "content">;
  icon: ReactNode;
  entities: Array<[string, string]>;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onAdd: (kind: Exclude<EntityKind, "manifest" | "content">) => void;
  onRename: EntityTreeProps["onRename"];
  onDuplicate: EntityTreeProps["onDuplicate"];
}

function TreeSection(props: TreeSectionProps) {
  return (
    <section className="tree-section">
      <div className="tree-section-heading">
        <div>
          <ChevronDown size={14} />
          {props.icon}
          <span>{props.label}</span>
          <small>{props.entities.length}</small>
        </div>
        <button
          type="button"
          className="tree-add-button"
          onClick={() => props.onAdd(props.kind)}
          title={`新建${props.label}`}
          aria-label={`新建${props.label}`}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="tree-items">
        {props.entities.map(([id, label]) => (
          <div className={`tree-item${props.selection.kind === props.kind && props.selection.id === id ? " is-active" : ""}`} key={id}>
          <button
            type="button"
            className="tree-item-main"
            onClick={() => props.onSelect({ kind: props.kind, id })}
          >
            <span>{label || "未命名"}</span>
            <code>{id}</code>
          </button>
          {props.selection.kind === props.kind && props.selection.id === id && <span className="tree-item-actions">
            <button type="button" title="复制实体" onClick={() => props.onDuplicate(props.kind, id)}><Copy size={13} /></button>
            <button type="button" title="重命名 ID" onClick={() => {
              const next = window.prompt("输入新 ID（引用会自动重构）", id);
              if (next && !props.onRename(props.kind, id, next)) window.alert("ID 格式无效或已存在");
            }}><Pencil size={13} /></button>
          </span>}
          </div>
        ))}
        {props.entities.length === 0 && <div className="tree-empty">暂无内容</div>}
      </div>
    </section>
  );
}

export function EntityTree({ project, selection, onSelect, onAdd, onRename, onDuplicate }: EntityTreeProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filterEntities = (entities: Record<string, { name?: string; text?: string; title?: string }>) =>
    Object.entries(entities)
      .map(([id, entity]) => [id, entity.name ?? entity.title ?? entity.text ?? id] as [string, string])
      .filter(([id, label]) =>
        !normalizedQuery || `${id} ${label}`.toLocaleLowerCase().includes(normalizedQuery));

  const sections = {
    scenes: filterEntities(project.module.scenes),
    npcs: filterEntities(project.module.npcs),
    clues: filterEntities(project.module.clues),
    endings: filterEntities(project.module.endings),
  };

  return (
    <aside className="entity-tree" aria-label="模组实体">
      <div className="panel-title-row">
        <div>
          <Boxes size={16} />
          <strong>内容结构</strong>
        </div>
      </div>
      <label className="tree-search">
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称或 ID"
          aria-label="搜索实体"
        />
      </label>
      <nav className="tree-scroll">
        <button
          type="button"
          className={`tree-root-item${selection.kind === "manifest" ? " is-active" : ""}`}
          onClick={() => onSelect({ kind: "manifest" })}
        >
          <FileText size={16} />
          <span>模组设置</span>
        </button>
        <button
          type="button"
          className={`tree-root-item${selection.kind === "content" ? " is-active" : ""}`}
          onClick={() => onSelect({ kind: "content" })}
        >
          <Settings2 size={16} />
          <span>世界与素材</span>
        </button>
        <TreeSection
          label="场景"
          kind="scene"
          icon={<Clapperboard size={14} />}
          entities={sections.scenes}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDuplicate={onDuplicate}
        />
        <TreeSection
          label="人物"
          kind="npc"
          icon={<CircleUserRound size={14} />}
          entities={sections.npcs}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDuplicate={onDuplicate}
        />
        <TreeSection
          label="线索"
          kind="clue"
          icon={<BookKey size={14} />}
          entities={sections.clues}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDuplicate={onDuplicate}
        />
        <TreeSection
          label="结局"
          kind="ending"
          icon={<Flag size={14} />}
          entities={sections.endings}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDuplicate={onDuplicate}
        />
      </nav>
    </aside>
  );
}
