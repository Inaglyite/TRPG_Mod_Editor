import {
  BookKey,
  Boxes,
  Braces,
  ChevronDown,
  CircleUserRound,
  Clapperboard,
  Copy,
  Eye,
  FileText,
  Flag,
  Home,
  Network,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type {
  EditorProject,
  EntitySelection,
  TreeEntityKind,
} from "../domain/types";

interface EntityTreeProps {
  project: EditorProject;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onAdd: (kind: TreeEntityKind) => void;
  onRename: (kind: TreeEntityKind, id: string, nextId: string) => boolean;
  onDuplicate: (kind: TreeEntityKind, id: string) => void;
}
interface TreeSectionProps extends Omit<EntityTreeProps, "project"> {
  label: string;
  kind: TreeEntityKind;
  icon: ReactNode;
  entities: Array<[string, string]>;
  total: number;
  entryId?: string;
  searching: boolean;
}
function TreeSection(props: TreeSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const expanded = props.searching || !collapsed;
  return (
    <section className="tree-section">
      <div className="tree-section-heading">
        <button
          className="tree-section-toggle"
          aria-expanded={expanded}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronDown className={expanded ? "" : "is-collapsed"} size={13} />
          {props.icon}
          <span>{props.label}</span>
          <small>
            {props.searching
              ? `${props.entities.length}/${props.total}`
              : props.total}
          </small>
        </button>
        <button
          className="tree-add-button"
          onClick={() => props.onAdd(props.kind)}
          title={`新建${props.label}`}
          aria-label={`新建${props.label}`}
        >
          <Plus size={15} />
        </button>
      </div>
      {expanded && (
        <div className="tree-items">
          {props.entities.map(([id, label]) => (
            <div
              className={`tree-item${props.selection.kind === props.kind && props.selection.id === id ? " is-active" : ""}`}
              key={id}
            >
              <button
                className="tree-item-main"
                onClick={() => props.onSelect({ kind: props.kind, id })}
                title={`${label}\n${id}`}
                aria-current={
                  props.selection.kind === props.kind &&
                  props.selection.id === id
                    ? "page"
                    : undefined
                }
              >
                <span>
                  {id === props.entryId && (
                    <i className="entry-dot" title="故事入口" />
                  )}
                  {label || "未命名"}
                </span>
                <code>{id}</code>
              </button>
              {props.selection.kind === props.kind &&
                props.selection.id === id && (
                  <span className="tree-item-actions">
                    <button
                      title="复制实体"
                      aria-label="复制实体"
                      onClick={() => props.onDuplicate(props.kind, id)}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      title="重命名 ID"
                      aria-label="重命名 ID"
                      onClick={() => {
                        const next = window.prompt(
                          "输入新 ID（引用会自动更新）",
                          id,
                        );
                        if (next && !props.onRename(props.kind, id, next))
                          window.alert("ID 格式无效或已存在");
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </span>
                )}
            </div>
          ))}
          {props.entities.length === 0 && (
            <div className="tree-empty">
              {props.searching ? "没有匹配内容" : "还没有内容，点击 + 创建"}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
export function EntityTree(props: EntityTreeProps) {
  const { project, selection, onSelect } = props;
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filter = (
    entities: Record<string, { name?: string; text?: string; title?: string }>,
  ) =>
    Object.entries(entities)
      .map(
        ([id, entity]) =>
          [id, entity.name ?? entity.title ?? entity.text ?? id] as [
            string,
            string,
          ],
      )
      .filter(
        ([id, label]) =>
          !normalized ||
          `${id} ${label}`.toLocaleLowerCase().includes(normalized),
      );
  const roots = [
    { kind: "overview", label: "创作总览", icon: Home },
    { kind: "graph", label: "故事关系图", icon: Network },
    { kind: "preview", label: "阅读与预览", icon: Eye },
  ] as const;
  const tools = [
    { kind: "manifest", label: "模组设置", icon: FileText },
    { kind: "content", label: "世界与素材", icon: Settings2 },
    { kind: "spatial", label: "空间调查", icon: Boxes },
    { kind: "skills", label: "自定义技能", icon: Sparkles },
    { kind: "source", label: "完整源码", icon: Braces },
  ] as const;
  return (
    <aside className="entity-tree" aria-label="模组实体">
      <div className="sidebar-project">
        <div className="sidebar-project-mark">
          <BookKey size={24} />
        </div>
        <div>
          <strong title={project.manifest.title}>
            {project.manifest.title}
          </strong>
          <small>
            {project.manifest.system} · {project.manifest.era || "自由时代"}
          </small>
        </div>
      </div>
      <label className="tree-search">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称或 ID"
          aria-label="搜索实体"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="清空搜索">
            ×
          </button>
        )}
      </label>
      <nav className="tree-scroll" aria-label="模组内容导航">
        <div className="primary-navigation">
          {roots.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              className={`tree-root-item${selection.kind === kind ? " is-active" : ""}`}
              aria-current={selection.kind === kind ? "page" : undefined}
              onClick={() => onSelect({ kind })}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="nav-section-label">模组内容</div>
        <TreeSection
          {...props}
          label="场景"
          kind="scene"
          icon={<Clapperboard size={15} />}
          entities={filter(project.module.scenes)}
          total={Object.keys(project.module.scenes).length}
          entryId={project.module.entry_scene_id}
          searching={!!normalized}
        />
        <TreeSection
          {...props}
          label="人物"
          kind="npc"
          icon={<CircleUserRound size={15} />}
          entities={filter(project.module.npcs)}
          total={Object.keys(project.module.npcs).length}
          searching={!!normalized}
        />
        <TreeSection
          {...props}
          label="线索"
          kind="clue"
          icon={<BookKey size={15} />}
          entities={filter(project.module.clues)}
          total={Object.keys(project.module.clues).length}
          searching={!!normalized}
        />
        <TreeSection
          {...props}
          label="结局"
          kind="ending"
          icon={<Flag size={15} />}
          entities={filter(project.module.endings)}
          total={Object.keys(project.module.endings).length}
          searching={!!normalized}
        />
        <div className="nav-section-label">扩展与工具</div>
        {tools.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            className={`tree-root-item${selection.kind === kind ? " is-active" : ""}`}
            aria-current={selection.kind === kind ? "page" : undefined}
            onClick={() => onSelect({ kind })}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
        <div className="sidebar-note">
          <span>把灵感，写成可以探索的世界。</span>
          <small>格式 {project.module.format_version} · 本地草稿自动保留</small>
        </div>
      </nav>
    </aside>
  );
}
