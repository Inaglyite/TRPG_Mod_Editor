import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}

export function FormField({ label, hint, wide, children }: FormFieldProps) {
  return (
    <label className={`form-field${wide ? " is-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

interface CheckGridProps {
  label: string;
  emptyText: string;
  children: ReactNode;
}

export function CheckGrid({ label, emptyText, children }: CheckGridProps) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <fieldset className="check-fieldset">
      <legend>{label}</legend>
      <div className="check-grid">{hasChildren ? children : <span>{emptyText}</span>}</div>
    </fieldset>
  );
}
