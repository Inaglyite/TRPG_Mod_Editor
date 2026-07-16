import { useState } from "react";
import { X } from "lucide-react";

export type NewProjectValues = { title: string; id: string; author: string; system: string };

export function NewProjectDialog(props: { onCreate: (values: NewProjectValues) => void; onClose: () => void }) {
  const [values, setValues] = useState<NewProjectValues>({ title: "未命名模组", id: "local.untitled", author: "", system: "COC7" });
  const valid = values.title.trim() && /^[a-z0-9][a-z0-9._-]+$/i.test(values.id);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onClose}>
      <form className="project-dialog new-project-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) props.onCreate(values); }}>
        <header><div><strong>新建模组工程</strong></div><button type="button" className="icon-button" onClick={props.onClose} aria-label="关闭"><X size={18} /></button></header>
        <div className="new-project-fields">
          <label>模组名称<input autoFocus value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></label>
          <label>包 ID<input className="mono-input" value={values.id} onChange={(event) => setValues({ ...values, id: event.target.value })} /></label>
          <label>作者<input value={values.author} onChange={(event) => setValues({ ...values, author: event.target.value })} /></label>
          <label>规则系统<input value={values.system} onChange={(event) => setValues({ ...values, system: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={!valid}>创建工程会话</button>
        </div>
      </form>
    </div>
  );
}
