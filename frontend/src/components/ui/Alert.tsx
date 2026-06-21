import React from 'react';

type AlertVariant = 'error' | 'success';

interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

export default function Alert({ variant = 'error', children, className = '' }: AlertProps) {
  return <div className={`ui-alert ui-alert-${variant} ${className}`}>{children}</div>;
}
