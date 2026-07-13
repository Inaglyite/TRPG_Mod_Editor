import { CircleCheck, CircleX, Lightbulb, TriangleAlert } from "lucide-react";
import type { Diagnostic, EditorProject, EntitySelection } from "../domain/types";

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  project: EditorProject;
  onSelect: (selection: EntitySelection) => void;
}

const levelMeta = {
  error: { label: "错误", icon: CircleX },
  warning: { label: "警告", icon: TriangleAlert },
  advice: { label: "建议", icon: Lightbulb },
} as const;

export function DiagnosticsPanel({ diagnostics, project, onSelect }: DiagnosticsPanelProps) {
  const errors = diagnostics.filter((item) => item.level === "error").length;
  const warnings = diagnostics.filter((item) => item.level === "warning").length;

  return (
    <aside className="diagnostics-panel" aria-label="工程检查器">
      <div className="panel-title-row">
        <div>
          <TriangleAlert size={16} />
          <strong>工程检查</strong>
        </div>
        <span className="diagnostic-total">{diagnostics.length}</span>
      </div>

      <div className="project-metrics">
        <div><strong>{Object.keys(project.module.scenes).length}</strong><span>场景</span></div>
        <div><strong>{Object.keys(project.module.npcs).length}</strong><span>人物</span></div>
        <div><strong>{Object.keys(project.module.clues).length}</strong><span>线索</span></div>
      </div>

      <div className="diagnostic-summary">
        <span className={errors ? "error-text" : "ok-text"}>{errors} 错误</span>
        <span className={warnings ? "warning-text" : "muted-text"}>{warnings} 警告</span>
      </div>

      <div className="diagnostic-list">
        {diagnostics.length === 0 && (
          <div className="diagnostic-empty">
            <CircleCheck size={26} />
            <strong>结构与引用均有效</strong>
          </div>
        )}
        {diagnostics.map((diagnostic) => {
          const meta = levelMeta[diagnostic.level];
          const Icon = meta.icon;
          return (
            <button
              type="button"
              className={`diagnostic-item ${diagnostic.level}`}
              key={diagnostic.id}
              onClick={() => diagnostic.selection && onSelect(diagnostic.selection)}
              disabled={!diagnostic.selection}
            >
              <Icon size={16} />
              <span>
                <strong>{meta.label}</strong>
                <span>{diagnostic.message}</span>
                <code>{diagnostic.path}</code>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
