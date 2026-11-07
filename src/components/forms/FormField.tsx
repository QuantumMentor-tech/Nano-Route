import React, { useId } from "react";

export interface FormFieldProps {
  id?: string;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children:
    | React.ReactNode
    | ((props: {
        id: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
        disabled?: boolean;
      }) => React.ReactNode);
}

export const FormField: React.FC<FormFieldProps> = ({
  id: explicitId,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className = "",
  style,
  children,
}) => {
  const generatedId = useId();
  const fieldId = explicitId || generatedId;
  const descriptionId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-err` : undefined;

  const describedBy = [errorId, descriptionId].filter(Boolean).join(" ") || undefined;

  const controlProps = {
    id: fieldId,
    "aria-describedby": describedBy,
    "aria-invalid": Boolean(error),
    disabled,
  };

  return (
    <div
      className={`nr-form-field ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        width: "100%",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: error ? "var(--nr-status-error)" : "var(--nr-text-secondary)",
            fontFamily: "var(--nr-font-sans)",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            userSelect: "none",
          }}
        >
          <span>{label}</span>
          {required && (
            <span
              style={{ color: "var(--nr-status-error)", fontWeight: 700 }}
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {/* Render children as function (render-prop) or clone element with accessibility props */}
      {typeof children === "function" ? (
        children(controlProps)
      ) : React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          id: (children.props as { id?: string }).id || fieldId,
          "aria-describedby":
            (children.props as { "aria-describedby"?: string })["aria-describedby"] || describedBy,
          "aria-invalid": Boolean(error),
          disabled: (children.props as { disabled?: boolean }).disabled ?? disabled,
        })
      ) : (
        children
      )}

      {description && !error && (
        <p
          id={descriptionId}
          style={{
            fontSize: "0.75rem",
            color: "var(--nr-text-muted)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            fontSize: "0.75rem",
            color: "var(--nr-status-error)",
            margin: 0,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

FormField.displayName = "FormField";

