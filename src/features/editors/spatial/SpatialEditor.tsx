import { Boxes, GitBranch, Map, Package, Search } from "lucide-react";
import { useState } from "react";
import { EditorHeading } from "../../../components/EditorHeading";
import { useEditorStore } from "../../../store/editor-store";
import { ConnectionsEditor } from "./ConnectionsEditor";
import { ItemsEditor } from "./ItemsEditor";
import { PointsEditor } from "./PointsEditor";
import { SceneTreeEditor } from "./SceneTreeEditor";

const tabs = [
  { id: "scenes", label: "场景树", icon: Map },
  { id: "connections", label: "通路", icon: GitBranch },
  { id: "points", label: "调查点与动作", icon: Search },
  { id: "items", label: "物品与状态", icon: Package },
] as const;

type SpatialTab = (typeof tabs)[number]["id"];

export function SpatialEditor() {
  const project = useEditorStore((state) => state.project);
  const enableSpatial = useEditorStore((state) => state.enableSpatial);
  const [tab, setTab] = useState<SpatialTab>("scenes");
  const spatial = project.module.spatial;

  return (
    <div className="editor-document spatial-document">
      <EditorHeading
        eyebrow="SPATIAL INVESTIGATION · V1"
        title="空间调查"
        icon={<Boxes size={21} />}
      />
      <p className="page-intro spatial-intro">
        用场景、通路、调查点和物品状态组织调查流程。条件判断、骰点和效果结算由 TRPG Master 本体负责。
      </p>
      {!spatial ? (
        <section className="form-section spatial-enable-panel">
          <Boxes size={34} />
          <h2>为当前 v2 模组启用 Spatial v1</h2>
          <p>
            添加可选的 module.spatial，并声明 spatial_investigation 与最低本体版本 1.1.0。
            不需要自定义 Skill，也不会改写旧平面模组的玩法。
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={project.module.format_version !== "2.0"}
            onClick={() => enableSpatial()}
          >
            启用空间调查
          </button>
          {project.module.format_version !== "2.0" && (
            <p className="inline-warning">Spatial v1 只支持模组格式 v2；旧工程不会被强制迁移。</p>
          )}
        </section>
      ) : (
        <>
          <div className="spatial-capability-strip" aria-label="Spatial 启用状态">
            <span>Spatial v1 已启用</span>
            <code>min_engine_version ≥ 1.1.0</code>
            <span>无需 custom_skills</span>
          </div>
          <div className="spatial-tabs" role="tablist" aria-label="空间调查编辑面">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "is-active" : ""}
                key={id}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="spatial-tab-panel" role="tabpanel">
            {tab === "scenes" && <SceneTreeEditor />}
            {tab === "connections" && <ConnectionsEditor />}
            {tab === "points" && <PointsEditor />}
            {tab === "items" && <ItemsEditor />}
          </div>
        </>
      )}
    </div>
  );
}
