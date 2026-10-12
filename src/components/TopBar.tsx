import {
  BookOpenText,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  CopyPlus,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  Menu,
  Package,
  PanelRight,
  PlayCircle,
  Redo2,
  RefreshCw,
  Save,
  Undo2,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface TopBarProps {
  title: string;
  version: string;
  formatVersion: string;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  errorCount: number;
  connected: boolean;
  onNew: () => void;
  onOpen: () => void;
  onExport: () => void;
  onExportModule: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onValidate: () => void;
  onRecent: () => void;
  onCompile: () => void;
  onSaveAs: () => void;
  onRelease: () => void;
  onSave: () => void;
  onToggleNav: () => void;
  onToggleInspector: () => void;
  onCheckEditorUpdate: () => void;
}

export function TopBar(props: TopBarProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  const items = [
    { label: "新建工程", icon: FilePlus2, action: props.onNew },
    { label: "打开工程 JSON", icon: FolderOpen, action: props.onOpen },
    {
      label: "最近工程",
      icon: History,
      action: props.onRecent,
      disabled: !props.connected,
    },
    { label: "导出工程 JSON", icon: Download, action: props.onExport },
    {
      label: "另存为新的工程会话",
      icon: CopyPlus,
      action: props.onSaveAs,
      disabled: !props.connected,
    },
    { label: "检查结构与引用", icon: CheckCheck, action: props.onValidate },
    {
      label: "后端权威编译",
      icon: PlayCircle,
      action: props.onCompile,
      disabled: !props.connected,
    },
    { label: "发布检查单", icon: ClipboardCheck, action: props.onRelease },
    {
      label: "检查编辑器更新",
      icon: RefreshCw,
      action: props.onCheckEditorUpdate,
    },
    {
      label: "撤销修改",
      icon: Undo2,
      action: props.onUndo,
      disabled: !props.canUndo,
    },
    {
      label: "重做修改",
      icon: Redo2,
      action: props.onRedo,
      disabled: !props.canRedo,
    },
  ];
  return (
    <header className="top-bar">
      <button
        className="quiet-button nav-toggle"
        onClick={props.onToggleNav}
        aria-label="切换内容导航"
      >
        <Menu size={20} />
      </button>
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <BookOpenText size={22} strokeWidth={1.7} />
        </div>
        <div className="brand-copy">
          <strong>模组工坊</strong>
          <span>TRPG MOD EDITOR</span>
        </div>
      </div>
      <details ref={menu} className="file-menu">
        <summary>
          文件 <ChevronDown size={14} />
        </summary>
        <div className="file-menu-items">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                disabled={item.disabled}
                title={item.disabled ? "连接工程服务后可用" : undefined}
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  item.action();
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </details>
      <div className="project-identity">
        <span className={`dirty-dot${props.dirty ? " is-dirty" : ""}`} />
        <strong title={props.title}>{props.title}</strong>
        <span>v{props.version}</span>
      </div>
      <div className="top-actions">
        <div className="history-actions">
          <button
            className="quiet-button"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            title="撤销（Ctrl / ⌘ + Z）"
            aria-label="撤销"
          >
            <Undo2 size={17} />
            <span>撤销</span>
          </button>
          <button
            className="quiet-button"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            title="重做（Ctrl / ⌘ + Shift + Z）"
            aria-label="重做"
          >
            <Redo2 size={17} />
            <span>重做</span>
          </button>
        </div>
        <button
          className="secondary-button save-button"
          aria-label="保存工程"
          onClick={props.onSave}
          title="保存已应用的工程（Ctrl / ⌘ + S）"
        >
          <Save size={16} />
          <span>保存工程</span>
        </button>
        <button
          className="primary-button package-button"
          disabled={!props.connected}
          title={
            props.connected
              ? "保存并导出 .trpgmod 模组包"
              : "打包需要连接 TRPG Master 工程服务，可先从文件菜单导出工程 JSON"
          }
          onClick={props.onExportModule}
        >
          <Package size={16} />
          <span>打包导出</span>
        </button>
        <button
          className={`quiet-button inspector-toggle${props.errorCount ? " has-errors" : ""}`}
          onClick={props.onToggleInspector}
          aria-label="切换创作助手"
          title={
            props.errorCount
              ? `${props.errorCount} 项错误`
              : "创作助手与工程检查"
          }
        >
          <PanelRight size={19} />
          {props.errorCount > 0 && <small>{props.errorCount}</small>}
        </button>
      </div>
    </header>
  );
}
