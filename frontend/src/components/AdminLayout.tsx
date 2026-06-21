import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div>
      <div
        className="admin-tabs"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0,
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '1.5rem',
        }}
      >
        <AdminTab to="/admin/users">👥 Benutzer</AdminTab>
        <AdminTab to="/admin/feature-requests">📬 Requests</AdminTab>
      </div>
      <Outlet />
    </div>
  );
}

function AdminTab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `admin-tab${isActive ? ' admin-tab-active' : ''}`}
      style={({ isActive }) => ({
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#7c3aed' : '#6b7280',
        borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
        marginBottom: -2,
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      })}
    >
      {children}
    </NavLink>
  );
}
