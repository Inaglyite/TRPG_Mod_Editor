import {
  BookKey,
  Boxes,
  ChevronDown,
  CircleUserRound,
  Clapperboard,
  FileText,
  Flag,
  Plus,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { EditorProject, EntityKind, EntitySelection } from "../domain/types";

interface EntityTreeProps {
  project: EditorProject;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onAdd: (kind: Exclude<EntityKind, "manifest">) => void;
}

interface TreeSectionProps {
  label: string;
  kind: Exclude<EntityKind, "manifest">;
  icon: ReactNode;
  entities: Array<[string, string]>;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onAdd: (kind: Exclude<EntityKind, "manifest">) => void;
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
          <button
            type="button"
            className={`tree-item${props.selection.kind === props.kind && props.selection.id === id ? " is-active" : ""}`}
            key={id}
            onClick={() => props.onSelect({ kind: props.kind, id })}
          >
            <span>{label || "未命名"}</span>
            <code>{id}</code>
          </button>
        ))}
        {props.entities.length === 0 && <div className="tree-empty">暂无内容</div>}
      </div>
    </section>
  );
}

export function EntityTree({ project, selection, onSelect, onAdd }: EntityTreeProps) {
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
        <TreeSection
          label="场景"
          kind="scene"
          icon={<Clapperboard size={14} />}
          entities={sections.scenes}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
        />
        <TreeSection
          label="人物"
          kind="npc"
          icon={<CircleUserRound size={14} />}
          entities={sections.npcs}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
        />
        <TreeSection
          label="线索"
          kind="clue"
          icon={<BookKey size={14} />}
          entities={sections.clues}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
        />
        <TreeSection
          label="结局"
          kind="ending"
          icon={<Flag size={14} />}
          entities={sections.endings}
          selection={selection}
          onSelect={onSelect}
          onAdd={onAdd}
        />
      </nav>
    </aside>
  );
}
