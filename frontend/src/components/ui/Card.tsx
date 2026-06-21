import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'default';
}

export function Card({ children, className = '', padding = 'default' }: CardProps) {
  return (
    <div className={`ui-card ${padding === 'none' ? 'ui-card-no-padding' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="ui-card-header">
      <div className="ui-card-header-text">
        <h2 className="ui-card-title">{title}</h2>
        {subtitle ? <p className="ui-card-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="ui-card-header-action">{action}</div> : null}
    </div>
  );
}

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
  borderTop?: boolean;
}

export function CardSection({ children, className = '', borderTop = false }: CardSectionProps) {
  return (
    <div className={`ui-card-section ${borderTop ? 'ui-card-section-border' : ''} ${className}`}>
      {children}
    </div>
  );
}
