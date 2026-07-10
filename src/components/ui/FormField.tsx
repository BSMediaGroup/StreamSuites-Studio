import type { InputHTMLAttributes } from "react";
import { useId } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly hint?: string;
}

export function FormField({ label, hint, id, ...props }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <label className="form-field" htmlFor={fieldId}>
      <span className="form-field__label">{label}</span>
      <input id={fieldId} aria-describedby={hintId} {...props} />
      {hint && (
        <span className="form-field__hint" id={hintId}>
          {hint}
        </span>
      )}
    </label>
  );
}
