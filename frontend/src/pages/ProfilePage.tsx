import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { users } from '../api/client';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState(2);
  const [diet, setDiet] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    try {
      const data = await users.get(user!.id);
      setName(data.name || '');
      setAddress(data.address || '');
      setMaxGuests(data.maxGuests || 0);
      setDiet(data.diet || '');
      setNotes(data.notes || '');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await users.update(user!.id, { name, address, maxGuests, diet, notes });
      await refreshUser();
      setMessage('Profil gespeichert!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <h1 className="page-title">Mein Profil</h1>

      <div className="card" style={{ maxWidth: 600 }}>
        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={user.email} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ Stadt" />
          </div>
          <div className="form-group">
            <label>Maximale Gäste</label>
            <input type="number" value={maxGuests} onChange={e => setMaxGuests(parseInt(e.target.value) || 0)} min={0} max={20} />
            <span className="text-sm text-muted">Wie viele Gäste kannst du aufnehmen?</span>
          </div>
          <div className="form-group">
            <label>Ernährungsbesonderheiten</label>
            <input type="text" value={diet} onChange={e => setDiet(e.target.value)} placeholder="z.B. vegetarisch, vegan, glutenfrei" />
          </div>
          <div className="form-group">
            <label>Notizen</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Sonstige Hinweise" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}