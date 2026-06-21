import React, { useState } from 'react';
import { groups } from '../../../api/client';
import type { MeetingCreationPolicy, Group } from '../../../types/api';

interface EditGroupFormProps {
  group: Group;
  onSaved: () => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export default function EditGroupForm({ group, onSaved, onCancel, onError }: EditGroupFormProps) {
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [meetingCreation, setMeetingCreation] = useState<MeetingCreationPolicy>(
    group.meetingCreation || 'admin'
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await groups.update(group.id, {
        name,
        description: description || undefined,
        meetingCreation,
      });
      onSaved();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>✏️ Gruppe bearbeiten</h3>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="form-group">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Beschreibung</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label>Wer darf Treffen erstellen?</label>
          <select
            value={meetingCreation}
            onChange={(e) => setMeetingCreation(e.target.value as MeetingCreationPolicy)}
          >
            <option value="admin">Nur Admins</option>
            <option value="all">Alle Mitglieder</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Speichern...' : '💾 Speichern'}
          </button>
          <button type="button" className="btn-sm" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
