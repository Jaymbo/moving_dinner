import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auth, setToken } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.resetPassword(token!, password);
      setSuccess(true);
      // Auto-login after successful reset using the returned token
      if (res.token) {
        setToken(res.token);
        await refreshUser();
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Zurücksetzen des Passworts');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>🍽️ Moving Dinner</h1>
          <h2>Ungültiger Link</h2>
          <p style={{ textAlign: 'center', color: '#666' }}>
            Dieser Link zum Zurücksetzen des Passworts ist ungültig.
          </p>
          <Link to="/forgot-password" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>🍽️ Moving Dinner</h1>
          <h2>Passwort geändert!</h2>
          <p style={{ textAlign: 'center', color: '#666' }}>
            Dein Passwort wurde erfolgreich geändert. Du wirst automatisch eingeloggt...
          </p>
          <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
            Zur Startseite
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🍽️ Moving Dinner</h1>
        <h2>Neues Passwort setzen</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 16 }}>
          Gib dein neues Passwort ein.
        </p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Neues Passwort</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mindestens 6 Zeichen"
            />
          </div>
          <div className="form-group">
            <label>Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Passwort wiederholen"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Wird geändert...' : 'Passwort ändern'}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          <Link to="/login">Zurück zum Login</Link>
        </p>
      </div>
    </div>
  );
}