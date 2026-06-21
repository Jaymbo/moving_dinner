import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auth, setToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';

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
          <Alert variant="error">
            Dieser Link zum Zurücksetzen des Passworts ist ungültig.
          </Alert>
          <Link to="/forgot-password" className="login-footer" style={{ display: 'block' }}>
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
          <Alert variant="success">
            Dein Passwort wurde erfolgreich geändert. Du wirst automatisch eingeloggt...
          </Alert>
          <Link to="/" className="login-footer" style={{ display: 'block' }}>
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
        <p className="login-footer">
          Gib dein neues Passwort ein.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormField
            label="Neues Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Mindestens 6 Zeichen"
          />
          <FormField
            label="Passwort bestätigen"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Passwort wiederholen"
          />
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Wird geändert...' : 'Passwort ändern'}
          </Button>
        </form>
        <p className="login-footer">
          <Link to="/login">Zurück zum Login</Link>
        </p>
      </div>
    </div>
  );
}