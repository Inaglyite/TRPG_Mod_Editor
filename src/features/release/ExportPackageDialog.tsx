import { Download, Package, PlayCircle, X } from "lucide-react";

export type ExportDialogData =
  | { kind: "ready"; blob: Blob; filename: string }
  | { kind: "failed"; message: string; details: string[] };

export type InstallState = {
  busy: boolean;
  message: string;
  failed: boolean;
};

/** 导出 .trpgmod 结果对话框：成功提供下载/安装试玩，失败逐条列出后端诊断。 */
export function ExportPackageDialog(props: {
  data: ExportDialogData;
  installState: InstallState;
  onDownload: () => void;
  onInstall: () => void;
  onClose: () => void;
}) {
  const { data, installState } = props;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => { if (!installState.busy) props.onClose(); }}>
      <section className="project-dialog release-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><Package size={18} /><strong id="export-title">导出 .trpgmod</strong></div>
          <button type="button" className="icon-button" onClick={props.onClose} disabled={installState.busy} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="release-body">
          {data.kind === "ready" && (
            <>
              <p className="release-meta">
                打包成功：<code>{data.filename}</code>（{(data.blob.size / 1024).toFixed(1)} KiB）
              </p>
              <div className="release-actions">
                <button type="button" className="primary-button" onClick={props.onDownload}>
                  <Download size={15} /> 下载模组包
                </button>
                <button type="button" className="tool-button" onClick={props.onInstall} disabled={installState.busy}>
                  <PlayCircle size={15} /> 安装到后端并试玩
                </button>
              </div>
              {installState.message && (
                <p className={installState.failed ? "release-failures" : "release-meta"}>
                  {installState.message}
                </p>
              )}
            </>
          )}
          {data.kind === "failed" && (
            <>
              <p className="release-failures">{data.message}</p>
              {data.details.length > 0 && (
                <ul className="release-items">
                  {data.details.map((detail, index) => (
                    <li key={index} className="release-item is-fail">
                      <span className="release-status" aria-hidden="true">✕</span>
                      <span className="release-label">{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="release-meta">修复以上问题后重新导出。</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
