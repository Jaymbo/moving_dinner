import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🍽️ Moving Dinner</h1>
        <p>Melde dich an, um deine Treffen zu sehen</p>
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormField
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <FormField
            label="Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </Button>
        </form>
        <p className="login-footer">
          <Link to="/forgot-password">Passwort vergessen?</Link>
        </p>
        <p className="login-footer">
          Noch kein Account? <Link to="/register">Registrieren</Link>
        </p>
      </div>
    </div>
  );
}