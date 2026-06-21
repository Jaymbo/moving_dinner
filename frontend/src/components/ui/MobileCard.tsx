import React from 'react';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCard({ children, className = '' }: MobileCardProps) {
  return <div className={`ui-mobile-card ${className}`}>{children}</div>;
}

interface MobileCardRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  action?: React.ReactNode;
}

export function MobileCardRow({ label, value, action }: MobileCardRowProps) {
  return (
    <div className="ui-mobile-card-row">
      <div className="ui-mobile-card-main">
        <span className="ui-mobile-card-label">{label}</span>
        <span className="ui-mobile-card-value">{value}</span>
      </div>
      {action ? <div className="ui-mobile-card-action">{action}</div> : null}
    </div>
  );
}

export function MobileCardActions({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`ui-mobile-card-actions ${className}`}>{children}</div>;
}
