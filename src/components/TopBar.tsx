import {
  BookOpenText,
  Download,
  FilePlus2,
  FolderOpen,
  Redo2,
  ShieldCheck,
  Undo2,
} from "lucide-react";

interface TopBarProps {
  title: string;
  version: string;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  errorCount: number;
  onNew: () => void;
  onOpen: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onValidate: () => void;
}

export function TopBar(props: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <BookOpenText size={21} strokeWidth={1.8} />
        </div>
        <div className="brand-copy">
          <strong>TRPG Mod Editor</strong>
          <span>FORMAT 1.0</span>
        </div>
      </div>

      <div className="project-identity">
        <span className={`dirty-dot${props.dirty ? " is-dirty" : ""}`} aria-hidden="true" />
        <strong>{props.title}</strong>
        <span>v{props.version}</span>
      </div>

      <div className="top-actions">
        <div className="action-group" aria-label="工程操作">
          <button type="button" className="tool-button" onClick={props.onNew} title="新建工程">
            <FilePlus2 size={17} />
            <span>新建</span>
          </button>
          <button type="button" className="tool-button" onClick={props.onOpen} title="打开工程 JSON">
            <FolderOpen size={17} />
            <span>打开</span>
          </button>
          <button type="button" className="tool-button" onClick={props.onExport} title="导出工程 JSON">
            <Download size={17} />
            <span>导出</span>
          </button>
        </div>
        <div className="action-group compact" aria-label="历史操作">
          <button
            type="button"
            className="icon-button"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            title="撤销"
            aria-label="撤销"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            title="重做"
            aria-label="重做"
          >
            <Redo2 size={18} />
          </button>
        </div>
        <button
          type="button"
          className={`validate-button${props.errorCount > 0 ? " has-errors" : ""}`}
          onClick={props.onValidate}
        >
          <ShieldCheck size={17} />
          <span>{props.errorCount > 0 ? `${props.errorCount} 项错误` : "校验通过"}</span>
        </button>
      </div>
    </header>
  );
}
