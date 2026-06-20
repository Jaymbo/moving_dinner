import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MyMeetingsPage from './pages/MyMeetingsPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminGroupsPage from './pages/AdminGroupsPage';
import AdminAssignmentPage from './pages/AdminAssignmentPage';
import AdminFeatureRequestsPage from './pages/AdminFeatureRequestsPage';
import RsvpPage from './pages/RsvpPage';
import JoinGroupPage from './pages/JoinGroupPage';
import PublicRegisterPage from './pages/PublicRegisterPage';
import FeatureRequestChatWidget from './components/FeatureRequestChatWidget';
import AdminLayout from './components/AdminLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return <div className="loading">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Navbar() {
  const { user, logout, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const navLinks = [
    { to: '/', label: 'Meine Treffen' },
    { to: '/groups', label: 'Gruppen' },
    ...(isSuperAdmin ? [{ to: '/admin/users', label: 'Admin' }] : []),
    { to: '/profile', label: 'Profil' },
  ];

  return (
    <nav className="navbar">
      <div className="nav-inner container">
        <div className="nav-top">
          <NavLink to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
            🍽️ Moving Dinner
          </NavLink>
          <button
            className="nav-burger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
          >
            <span className={menuOpen ? 'open' : ''} />
            <span className={menuOpen ? 'open' : ''} />
            <span className={menuOpen ? 'open' : ''} />
          </button>
        </div>

        <div className={`nav-menu ${menuOpen ? 'open' : ''}`}>

          <div className="nav-section nav-section-links">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  isActive || (link.to === '/admin/users' && location.pathname.startsWith('/admin'))
                    ? 'nav-link active'
                    : 'nav-link'
                }
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="nav-section nav-section-user">
            <NavLink








              to="/profile"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={() => setMenuOpen(false)}
            >

              Profil
            </NavLink>



            <span className="nav-user-name text-sm text-muted">Hallo, {user.name}{isSuperAdmin ? ' ⭐' : ''}</span>
            <button className="btn-sm nav-logout" onClick={logout}>Abmelden</button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="app-layout">
      <Navbar />

      <main className="container app-main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/rsvp/:token" element={<RsvpPage />} />
          <Route path="/join/:code" element={<JoinGroupPage />} />
          <Route path="/public/register/:meetingId" element={<PublicRegisterPage />} />
          <Route path="/" element={<ProtectedRoute><MyMeetingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><AdminGroupsPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId/assignment/:meetingId" element={<ProtectedRoute><AdminAssignmentPage /></ProtectedRoute>} />
          <Route path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="feature-requests" element={<AdminFeatureRequestsPage />} />
          </Route>
        </Routes>
      </main>
      {user && <FeatureRequestChatWidget />}
    </div>
  );
}
