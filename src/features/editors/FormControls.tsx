import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
} from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}

export function FormField({ label, hint, wide, children }: FormFieldProps) {
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const hintId = `${controlId}-hint`;
  const hasControl = Children.toArray(children).some(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type),
  );
  const controls = Children.map(children, (child) => {
    if (
      isValidElement<Record<string, unknown>>(child) &&
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type)
    ) {
      return cloneElement(child, {
        id: controlId,
        "aria-describedby": hint ? hintId : undefined,
      });
    }
    return child;
  });
  return (
    <div
      className={`form-field${wide ? " is-wide" : ""}`}
      role={hasControl ? undefined : "group"}
      aria-labelledby={hasControl ? undefined : labelId}
    >
      {hasControl ? (
        <label id={labelId} className="field-label" htmlFor={controlId}>
          {label}
        </label>
      ) : (
        <span id={labelId} className="field-label">
          {label}
        </span>
      )}
      {controls}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}

interface CheckGridProps {
  label: string;
  emptyText: string;
  children: ReactNode;
}

export function CheckGrid({ label, emptyText, children }: CheckGridProps) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <fieldset className="check-fieldset">
      <legend>{label}</legend>
      <div className="check-grid">
        {hasChildren ? children : <span>{emptyText}</span>}
      </div>
    </fieldset>
  );
}
