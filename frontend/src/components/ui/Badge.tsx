import React from 'react';

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${variant} ${className}`}>{children}</span>;
}
