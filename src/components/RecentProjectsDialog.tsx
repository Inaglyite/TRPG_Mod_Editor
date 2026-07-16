import { Clock3, X } from "lucide-react";
import type { ProjectSummary } from "../services/editor-backend";

export function RecentProjectsDialog(props: {
  projects: ProjectSummary[];
  onOpen: (sessionId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="recent-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><Clock3 size={18} /><strong id="recent-title">最近工程</strong></div>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="recent-project-list">
          {props.projects.map((project) => (
            <button type="button" key={project.session_id} onClick={() => props.onOpen(project.session_id)}>
              <span><strong>{project.title}</strong><small>{project.package_id} · v{project.version}</small></span>
              <time>{new Date(project.updated_at).toLocaleString()}</time>
            </button>
          ))}
          {props.projects.length === 0 && <p>还没有服务端工程会话。</p>}
        </div>
      </section>
    </div>
  );
}
