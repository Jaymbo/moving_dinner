import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-group">
            <label>Wohnort / Adresse</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Max. Gäste, die du aufnehmen kannst</label>
            <input type="number" min={0} value={maxGuests} onChange={e => setMaxGuests(parseInt(e.target.value, 10) || 0)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Registrieren...' : 'Registrieren'}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          Schon ein Account? <Link to="/login">Anmelden</Link>
        </p>
      </div>
    </div>
  );
}