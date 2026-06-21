import React, { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'danger' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'outline',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const base = 'ui-btn';
  const variantClass = `ui-btn-${variant}`;
  const sizeClass = `ui-btn-${size}`;
  const widthClass = fullWidth ? 'ui-btn-full' : '';
  const isDisabled = disabled || loading;

  return (
    <button
      className={`${base} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      disabled={isDisabled}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className="ui-btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
