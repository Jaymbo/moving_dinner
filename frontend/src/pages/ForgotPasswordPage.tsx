import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Senden der E-Mail');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>🍽️ Moving Dinner</h1>
          <h2>E-Mail gesendet</h2>
          <p style={{ textAlign: 'center', color: '#666' }}>
            Falls ein Account mit der E-Mail <strong>{email}</strong> existiert,
            hast du einen Link zum Zurücksetzen deines Passworts erhalten.
          </p>
          <p style={{ textAlign: 'center', color: '#999', fontSize: 14 }}>
            Bitte prüfe auch deinen Spam-Ordner.
          </p>
          <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🍽️ Moving Dinner</h1>
        <h2>Passwort vergessen?</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 16 }}>
          Gib deine E-Mail-Adresse ein und wir senden dir einen Link,
          um dein Passwort zurückzusetzen.
        </p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="deine@email.de"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Wird gesendet...' : 'Link senden'}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          <Link to="/login">Zurück zum Login</Link>
        </p>
      </div>
    </div>
  );
}