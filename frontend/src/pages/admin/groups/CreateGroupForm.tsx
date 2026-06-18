import React, { useState } from 'react';
import { groups } from '../../../api/client';
import { getJoinLink } from './utils';

interface CreateGroupFormProps {
  onCreated: () => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function CreateGroupForm({ onCreated, onMessage, onError }: CreateGroupFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [meetingCreation, setMeetingCreation] = useState<string>('admin');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await groups.create({ name, description: description || undefined, meetingCreation });
      onMessage(`Gruppe "${name}" erstellt! Einladungslink: ${getJoinLink(result.inviteCode)}`);
      setName('');
      setDescription('');
      setMeetingCreation('admin');
      onCreated();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card mb-4">
      <h3>Neue Gruppe erstellen</h3>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="form-group">
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Beschreibung</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label>Wer darf Treffen erstellen?</label>
          <select value={meetingCreation} onChange={e => setMeetingCreation(e.target.value)}>
            <option value="admin">Nur Admins</option>
            <option value="all">Alle Mitglieder</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? 'Erstellen...' : 'Gruppe erstellen'}
        </button>
      </form>
    </div>
  );
}