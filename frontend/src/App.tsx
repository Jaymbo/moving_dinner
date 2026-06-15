import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MyMeetingsPage from './pages/MyMeetingsPage';
import ProfilePage from './pages/ProfilePage';
import AdminMeetingsPage from './pages/AdminMeetingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminScoresPage from './pages/AdminScoresPage';
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdminAnywhere, isSuperAdmin } = useAuth();
  if (loading) return <div className="loading">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminAnywhere && !isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return <div className="loading">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading, logout, isAdminAnywhere, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="app-layout">
      {user && (
        <nav className="navbar">
          <div className="nav-inner container flex items-center justify-between">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="nav-brand">🍽️ Moving Dinner</NavLink>
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Meine Treffen
              </NavLink>
              <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Gruppen
              </NavLink>
              {(isAdminAnywhere || isSuperAdmin) && (
                <NavLink to="/admin/meetings" className={({ isActive }) => isActive || location.pathname.startsWith('/admin') ? 'nav-link active' : 'nav-link'}>
                  Admin
                </NavLink>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">Hallo, {user.name}{isSuperAdmin ? ' ⭐' : ''}</span>
              <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Profil
              </NavLink>
              <button className="btn-sm" onClick={logout}>Abmelden</button>
            </div>
          </div>
        </nav>
      )}

      <main className="container" style={{ paddingTop: user ? '24px' : '0', paddingBottom: '48px' }}>
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
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Navigate to="/admin/meetings" replace />} />
            <Route path="meetings" element={<AdminMeetingsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="scores" element={<AdminScoresPage />} />
            <Route path="assignment/:meetingId" element={<AdminAssignmentPage />} />
            <Route path="feature-requests" element={<SuperAdminRoute><AdminFeatureRequestsPage /></SuperAdminRoute>} />
          </Route>
        </Routes>
      </main>
      {user && <FeatureRequestChatWidget />}
    </div>
  );
}