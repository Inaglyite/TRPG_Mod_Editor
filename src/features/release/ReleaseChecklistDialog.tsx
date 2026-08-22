import { ClipboardCheck, Download, X } from "lucide-react";
import type { Diagnostic, EditorProject } from "../../domain/types";
import type { UpdateStatus } from "../../services/host";
import { buildChecklist } from "./release-checklist";

export function ReleaseChecklistDialog(props: {
  project: EditorProject;
  diagnostics: Diagnostic[];
  appVersion: string;
  isElectron: boolean;
  updateStatus: UpdateStatus | null;
  onCheckUpdates: () => void;
  onExportReport: () => void;
  onClose: () => void;
}) {
  const items = buildChecklist(props.project, props.diagnostics);
  const failures = items.filter((item) => item.status === "fail").length;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="project-dialog release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><ClipboardCheck size={18} /><strong id="release-title">发布检查单</strong></div>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="release-body">
          <p className="release-meta">
            TRPG Mod Editor {props.appVersion} · {props.isElectron ? "桌面版" : "浏览器版"}
            {props.updateStatus && (
              <span className={`update-chip update-${props.updateStatus.available ? "available" : "current"}`}>
                {props.updateStatus.checking ? "正在检查更新…" :
                  props.updateStatus.error ? props.updateStatus.error :
                  props.updateStatus.available ? `发现新版本 ${props.updateStatus.nextVersion}` :
                  `已是最新（${props.updateStatus.currentVersion}）`}
              </span>
            )}
          </p>
          <ul className="release-items">
            {items.map((item) => (
              <li key={item.label} className={`release-item is-${item.status}`}>
                <span className="release-status" aria-hidden="true">{item.status === "pass" ? "✓" : item.status === "warn" ? "!" : "✕"}</span>
                <span className="release-label">{item.label}</span>
                <small>{item.note}</small>
              </li>
            ))}
          </ul>
          <div className="release-actions">
            {props.isElectron && (
              <button type="button" className="tool-button" onClick={props.onCheckUpdates}>检查更新</button>
            )}
            <button type="button" className="primary-button" onClick={props.onExportReport}>
              <Download size={15} /> 导出错误报告
            </button>
            {failures > 0 && <p className="release-failures">有 {failures} 项未通过，建议修复后再发布。</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
