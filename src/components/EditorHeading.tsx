import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface EditorHeadingProps {
  eyebrow: string;
  title: string;
  id?: string;
  icon: ReactNode;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}

export function EditorHeading(props: EditorHeadingProps) {
  return (
    <div className="editor-heading">
      <div className="editor-heading-icon">{props.icon}</div>
      <div>
        <span>{props.eyebrow}</span>
        <h1>{props.title}</h1>
        {props.id && <code>{props.id}</code>}
      </div>
      {props.onDelete && (
        <button
          type="button"
          className="danger-icon-button"
          onClick={props.onDelete}
          disabled={props.deleteDisabled}
          title={props.deleteDisabled ? "入口场景不能删除" : "删除实体"}
          aria-label="删除实体"
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}
