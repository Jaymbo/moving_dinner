import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { users } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [maxGuests, setMaxGuests] = useState(2);
  const [diet, setDiet] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Delete profile state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteProfile() {
    if (deleteConfirmText !== 'LÖSCHEN') return;
    setDeleting(true);
    setError('');
    try {
      await users.delete(user!.id);
      logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
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

      {/* Delete Profile Section */}
      <div className="card" style={{ maxWidth: 600, marginTop: '2rem', borderColor: '#e74c3c' }}>
        <h2 style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>Profil löschen</h2>
        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Wenn du dein Profil löschst, werden alle deine Daten unwiderruflich entfernt. 
          Du wirst aus allen Gruppen entfernt und deine Antworten, Scores und Verlaufsdaten gelöscht.
          Diese Aktion kann <strong>nicht</strong> rückgängig gemacht werden.
        </p>

        {!showDeleteConfirm ? (
          <button
            className="btn-primary"
            style={{ backgroundColor: '#e74c3c', borderColor: '#e74c3c' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Profil löschen
          </button>
        ) : (
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              Bist du sicher? Gib <strong>LÖSCHEN</strong> ein, um zu bestätigen.
            </p>
            <div className="form-group">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder='Tippe "LÖSCHEN" zum Bestätigen'
                style={{ borderColor: deleteConfirmText && deleteConfirmText !== 'LÖSCHEN' ? '#e74c3c' : undefined }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-primary"
                style={{ backgroundColor: '#e74c3c', borderColor: '#e74c3c' }}
                onClick={handleDeleteProfile}
                disabled={deleteConfirmText !== 'LÖSCHEN' || deleting}
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}