import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAuth from '../context/useAuth';
import { users, auth } from '../api/client';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

export default function ProfilePage() {
  const { user, refreshUser, logout, isSuperAdmin } = useAuth();
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

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const data = await users.get(user.id);
      setName(data.name || '');
      setAddress(data.address || '');
      setMaxGuests(data.maxGuests || 0);
      setDiet(data.diet || '');
      setNotes(data.notes || '');
    } catch (err: any) {
      setError(err.message);
    }
  }, [user]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadProfile();
  }, [loadProfile]);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword.length < 6) {
      setPasswordError('Neues Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwörter stimmen nicht überein');
      return;
    }

    setChangingPassword(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      setPasswordMessage('Passwort erfolgreich geändert!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Fehler beim Ändern des Passworts');
    } finally {
      setChangingPassword(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={
          <>
            Mein Profil{' '}
            {isSuperAdmin && <Badge variant="purple">⭐ Super-Admin</Badge>}
          </>
        }
      />

      <Card className="profile-card">
        <CardHeader title="Persönliche Daten" />
        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <form onSubmit={handleSave}>
          <FormField
            label="Name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <FormField
            label="E-Mail"
            type="email"
            value={user.email}
            disabled
          />
          <FormField
            label="Adresse"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Straße, PLZ Stadt"
          />
          <FormField
            label="Maximale Gäste"
            type="number"
            value={maxGuests}
            onChange={e => setMaxGuests(parseInt(e.target.value) || 0)}
            min={0}
            max={20}
            hint="Wie viele Gäste kannst du aufnehmen?"
          />
          <FormField
            label="Ernährungsbesonderheiten"
            type="text"
            value={diet}
            onChange={e => setDiet(e.target.value)}
            placeholder="z.B. vegetarisch, vegan, glutenfrei"
          />
          <FormField
            label="Notizen"
            as="textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Sonstige Hinweise"
          />
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </form>
      </Card>

      <Card className="profile-card">
        <CardHeader title="Passwort ändern" />
        {passwordError && <Alert variant="error">{passwordError}</Alert>}
        {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
        <form onSubmit={handleChangePassword}>
          <FormField
            label="Aktuelles Passwort"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            placeholder="Aktuelles Passwort"
          />
          <FormField
            label="Neues Passwort"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Mindestens 6 Zeichen"
          />
          <FormField
            label="Neues Passwort bestätigen"
            type="password"
            value={confirmNewPassword}
            onChange={e => setConfirmNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Passwort wiederholen"
          />
          <Button type="submit" variant="primary" loading={changingPassword}>
            {changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
          </Button>
        </form>
      </Card>

      <Card className="profile-card profile-delete-card">
        <CardHeader
          title={<span className="delete-title">Profil löschen</span>}
          subtitle="Diese Aktion kann nicht rückgängig gemacht werden."
        />
        <p className="text-secondary text-sm mb-4">
          Wenn du dein Profil löschst, werden alle deine Daten unwiderruflich entfernt.
          Du wirst aus allen Gruppen entfernt und deine Antworten, Scores und Verlaufsdaten gelöscht.
        </p>

        {!showDeleteConfirm ? (
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            Profil löschen
          </Button>
        ) : (
          <div className="ui-card-section-border">
            <p className="text-sm mb-3" style={{ fontWeight: 600 }}>
              Bist du sicher? Gib <strong>LÖSCHEN</strong> ein, um zu bestätigen.
            </p>
            <FormField
              type="text"
              label="Bestätigung"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder='Tippe "LÖSCHEN" zum Bestätigen'
            />
            <div className="card-actions">
              <Button
                variant="danger"
                onClick={handleDeleteProfile}
                disabled={deleteConfirmText !== 'LÖSCHEN' || deleting}
                loading={deleting}
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}