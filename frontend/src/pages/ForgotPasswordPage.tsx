import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api/client';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';

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
          <Alert variant="success">
            Falls ein Account mit der E-Mail <strong>{email}</strong> existiert,
            hast du einen Link zum Zurücksetzen deines Passworts erhalten.
            Bitte prüfe auch deinen Spam-Ordner.
          </Alert>
          <Link to="/login" className="login-footer" style={{ display: 'block' }}>
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
        <p className="login-footer">
          Gib deine E-Mail-Adresse ein und wir senden dir einen Link,
          um dein Passwort zurückzusetzen.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormField
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="deine@email.de"
          />
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Wird gesendet...' : 'Link senden'}
          </Button>
        </form>
        <p className="login-footer">
          <Link to="/login">Zurück zum Login</Link>
        </p>
      </div>
    </div>
  );
}