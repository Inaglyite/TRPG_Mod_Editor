import { Eye, EyeOff, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { playerScenePreview } from "../../domain/authoring";
import { useEditorStore } from "../../store/editor-store";
import { EditorHeading } from "../../components/EditorHeading";

export function PlayerPreview() {
  const project = useEditorStore((state) => state.project);
  const select = useEditorStore((state) => state.select);
  const [sceneId, setSceneId] = useState(project.module.entry_scene_id);
  const [keeper, setKeeper] = useState(false);
  const currentId = project.module.scenes[sceneId]
    ? sceneId
    : project.module.entry_scene_id;
  const preview = playerScenePreview(project, currentId);
  return (
    <div className="editor-document">
      <EditorHeading
        eyebrow="INFORMATION BOUNDARIES"
        title="阅读与预览"
        icon={<Eye size={23} />}
      />
      <div className="preview-toolbar">
        <label>
          预览场景
          <select
            aria-label="预览场景"
            value={currentId}
            onChange={(event) => setSceneId(event.target.value)}
          >
            {Object.entries(project.module.scenes).map(([id, scene]) => (
              <option key={id} value={id}>
                {scene.name}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented-control" aria-label="预览视角">
          <button aria-pressed={!keeper} onClick={() => setKeeper(false)}>
            <Eye size={15} /> 玩家视角
          </button>
          <button aria-pressed={keeper} onClick={() => setKeeper(true)}>
            <EyeOff size={15} /> 守秘人视角
          </button>
        </div>
      </div>
      <p className="inline-help">
        <ShieldCheck size={17} />
        {keeper
          ? "守秘人视角包含未公开的秘密和发现条件，供作者核对。"
          : "按开局信息预览：仅展示场景描述、公开人物标签和已知线索。"}
      </p>
      {preview && (
        <article
          className={`reading-preview${keeper ? " keeper-preview-mode" : ""}`}
          aria-label={keeper ? "守秘人预览内容" : "玩家预览内容"}
        >
          <span className="reading-kicker">
            <MapPin size={14} /> {keeper ? "守秘人阅读" : "调查员阅读"}
          </span>
          <h2>{preview.name}</h2>
          <p className="scene-prose">
            {preview.description || "这个场景还没有描述。"}
          </p>
          {preview.people.length > 0 && (
            <section>
              <h3>在场人物</h3>
              {preview.people.map((person, index) => (
                <div className="preview-person" key={index}>
                  <strong>{person.name}</strong>
                  <span>{person.tags.join(" · ")}</span>
                </div>
              ))}
            </section>
          )}
          <section>
            <h3>已知线索</h3>
            {preview.clues.length ? (
              preview.clues.map((clue, index) => (
                <p key={index} className="preview-clue">
                  {clue}
                </p>
              ))
            ) : (
              <p className="small-muted">开局时暂无与此场景关联的已知线索。</p>
            )}
          </section>
          {keeper && (
            <section className="keeper-only">
              <h3>
                <EyeOff size={16} /> 守秘人信息
              </h3>
              {project.module.scenes[currentId].npcs_present.map(
                (id) =>
                  project.module.npcs[id] && (
                    <div key={id}>
                      <h4>{project.module.npcs[id].name}</h4>
                      <p>{project.module.npcs[id].secret || "暂无秘密。"}</p>
                    </div>
                  ),
              )}
              {Object.entries(project.module.clues)
                .filter(([, clue]) => clue.related_scenes.includes(currentId))
                .map(([id, clue]) => (
                  <div key={id}>
                    <h4>{clue.text}</h4>
                    <p>{clue.discovery_notes || "尚未填写发现提示。"}</p>
                    <small>
                      {clue.discovery_rules.length} 条发现规则 ·{" "}
                      {clue.initially_known ? "开局已知" : "尚未发现"}
                    </small>
                  </div>
                ))}
            </section>
          )}
        </article>
      )}
      <div className="preview-footer">
        <span className="small-muted">阅读预览不运行骰点或剧情结算。</span>
        <button
          className="secondary-button"
          onClick={() => select({ kind: "scene", id: currentId })}
        >
          编辑这个场景
        </button>
      </div>
    </div>
  );
}
