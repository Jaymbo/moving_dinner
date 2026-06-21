import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../context/useAuth';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState<number>(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password, address, maxGuests);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🍽️ Moving Dinner</h1>
        <p>Erstelle einen neuen Account</p>
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormField
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <FormField
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            hint="Mindestens 6 Zeichen"
          />
          <FormField
            label="Wohnort / Adresse"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <FormField
            label="Max. Gäste, die du aufnehmen kannst"
            type="number"
            min={0}
            value={maxGuests}
            onChange={(e) => setMaxGuests(parseInt(e.target.value, 10) || 0)}
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Registrieren...' : 'Registrieren'}
          </Button>
        </form>
        <p className="login-footer">
          Schon ein Account? <Link to="/login">Anmelden</Link>
        </p>
      </div>
    </div>
  );
}
