import React, {
  useId,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type InputLike =
  | ({ as?: 'input' } & InputHTMLAttributes<HTMLInputElement>)
  | ({ as: 'select' } & SelectHTMLAttributes<HTMLSelectElement>)
  | ({ as: 'textarea' } & TextareaHTMLAttributes<HTMLTextAreaElement>);

interface BaseFormFieldProps {
  label: React.ReactNode;
  id?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
}

export default function FormField({
  label,
  id,
  hint,
  error,
  ...inputProps
}: BaseFormFieldProps & InputLike) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy =
    [hint ? `${inputId}-hint` : '', error ? `${inputId}-error` : ''].filter(Boolean).join(' ') ||
    undefined;

  const renderInput = () => {
    const baseProps = {
      id: inputId,
      className: `ui-input ${error ? 'ui-input-error' : ''}`,
      'aria-invalid': !!error,
      'aria-describedby': describedBy,
    };

    if (inputProps.as === 'select') {
      const { as: _as, ...rest } = inputProps;
      return <select {...baseProps} {...rest} />;
    }
    if (inputProps.as === 'textarea') {
      const { as: _as, ...rest } = inputProps;
      return <textarea {...baseProps} {...rest} />;
    }
    const { as: _as, ...rest } = inputProps as {
      as?: 'input';
    } & InputHTMLAttributes<HTMLInputElement>;
    return <input {...baseProps} {...rest} />;
  };

  return (
    <div className="ui-form-field">
      <label htmlFor={inputId} className="ui-label">
        {label}
      </label>
      {renderInput()}
      {hint && !error ? (
        <span id={`${inputId}-hint`} className="ui-field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} className="ui-field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
