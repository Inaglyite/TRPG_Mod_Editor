import {
  ArrowRight,
  BookKey,
  CircleCheck,
  CircleUserRound,
  Clapperboard,
  Flag,
  ListChecks,
  Network,
  PenLine,
  Plus,
} from "lucide-react";
import {
  authoringSteps,
  entityLabels,
  reachableSceneIds,
} from "../../domain/authoring";
import type { TreeEntityKind } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";

const icons = {
  scene: Clapperboard,
  npc: CircleUserRound,
  clue: BookKey,
  ending: Flag,
};

export function Overview() {
  const project = useEditorStore((state) => state.project);
  const select = useEditorStore((state) => state.select);
  const add = useEditorStore((state) => state.addEntity);
  const steps = authoringSteps(project);
  const collections = {
    scene: project.module.scenes,
    npc: project.module.npcs,
    clue: project.module.clues,
    ending: project.module.endings,
  };
  const reached = reachableSceneIds(project);
  const scenes = Object.entries(project.module.scenes);
  return (
    <div className="editor-document overview-document">
      <div className="page-intro">
        <span className="eyebrow">
          <PenLine size={16} /> YOUR STORY STARTS HERE
        </span>
        <h1>创作总览</h1>
        <p>让每条线索，都通向一个故事。</p>
      </div>
      <section className="project-overview-card">
        <div className="project-cover" aria-hidden="true">
          <BookKey size={34} strokeWidth={1.2} />
          <span>
            TRPG
            <br />
            STORY ARCHIVE
          </span>
        </div>
        <div className="overview-project-copy">
          <div className="section-heading">
            <h2>{project.manifest.title}</h2>
            <button
              className="quiet-button"
              onClick={() => select({ kind: "manifest" })}
              aria-label="编辑模组信息"
            >
              <PenLine size={16} />
            </button>
          </div>
          <p>
            {project.manifest.description ||
              "你的故事正在开始。先写一段简介，告诉调查员这次冒险将带他们去哪里。"}
          </p>
          <div className="tag-row">
            <span>{project.manifest.system}</span>
            <span>{project.manifest.era || "时代待定"}</span>
            <span>v{project.manifest.version}</span>
            {project.manifest.tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="overview-metrics">
          {(Object.keys(collections) as TreeEntityKind[]).map((kind) => {
            const Icon = icons[kind];
            const count = Object.keys(collections[kind]).length;
            return (
              <button
                className={`metric-card metric-${kind}`}
                key={kind}
                onClick={() =>
                  count
                    ? select({ kind, id: Object.keys(collections[kind])[0] })
                    : add(kind)
                }
              >
                <Icon size={22} />
                <strong>{count}</strong>
                <span>{entityLabels[kind]}</span>
                <small>
                  {count ? "查看与编辑" : "创建第一项"}
                  <ArrowRight size={12} />
                </small>
              </button>
            );
          })}
        </div>
      </section>
      <div className="overview-columns">
        <section className="surface-card">
          <div className="section-heading">
            <h2>
              <ListChecks size={18} /> 从这里开始
            </h2>
            <span className="small-muted">
              {steps.filter((step) => step.done).length} / {steps.length} 完成
            </span>
          </div>
          <ol className="authoring-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <button
                  onClick={() => {
                    if (
                      (step.selection.kind === "clue" ||
                        step.selection.kind === "ending") &&
                      !step.selection.id
                    )
                      add(step.selection.kind);
                    else select(step.selection);
                  }}
                >
                  <span
                    className={`step-number${step.done ? " is-complete" : ""}`}
                  >
                    {step.done ? <CircleCheck size={18} /> : index + 1}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              </li>
            ))}
          </ol>
          <p className="card-footnote">顺序由你决定，随时从左侧自由编辑。</p>
        </section>
        <section className="surface-card">
          <div className="section-heading">
            <h2>
              <Network size={18} /> 故事路线
            </h2>
            <button
              className="text-button"
              onClick={() => select({ kind: "graph" })}
            >
              进入关系图 <ArrowRight size={14} />
            </button>
          </div>
          <div className="mini-route">
            {scenes.slice(0, 4).map(([id, scene]) => (
              <button key={id} onClick={() => select({ kind: "scene", id })}>
                <span
                  className={`route-marker${id === project.module.entry_scene_id ? " is-entry" : ""}`}
                />
                <span>
                  <strong>{scene.name}</strong>
                  <small>
                    {id === project.module.entry_scene_id
                      ? "故事入口"
                      : reached.has(id)
                        ? `${scene.exits.length} 个出口`
                        : "尚未连接到入口"}
                  </small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
            {scenes.length > 4 && (
              <button
                className="text-button"
                onClick={() => select({ kind: "graph" })}
              >
                查看其余 {scenes.length - 4} 个场景
              </button>
            )}
          </div>
          <div className="route-summary">
            <span>
              {reached.size} / {scenes.length} 场景可达
            </span>
            <button className="text-button" onClick={() => add("scene")}>
              <Plus size={14} /> 添加场景
            </button>
          </div>
        </section>
      </div>
      <section className="surface-card">
        <div className="section-heading">
          <h2>
            <Clapperboard size={18} /> 内容速览
          </h2>
          <span className="small-muted">选择内容，继续写作</span>
        </div>
        <div className="content-overview-list">
          {(Object.keys(collections) as TreeEntityKind[]).flatMap((kind) =>
            Object.entries(collections[kind])
              .slice(0, 2)
              .map(([id, entity]) => {
                const Icon = icons[kind];
                const label =
                  "name" in entity
                    ? entity.name
                    : "title" in entity
                      ? entity.title
                      : entity.text;
                return (
                  <button
                    key={`${kind}:${id}`}
                    onClick={() => select({ kind, id })}
                  >
                    <span className={`entity-type type-${kind}`}>
                      <Icon size={15} />
                      {entityLabels[kind]}
                    </span>
                    <strong>{label || "未命名"}</strong>
                    <code>{id}</code>
                    <ArrowRight size={14} />
                  </button>
                );
              }),
          )}
        </div>
      </section>
    </div>
  );
}
