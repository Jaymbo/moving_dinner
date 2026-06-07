import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetings, groups, admin } from '../api/client';

export default function AdminMeetingsPage() {
  const [meetingList, setMeetingList] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [m, g] = await Promise.all([meetings.list(), groups.my()]);
      setMeetingList(m);
      setMyGroups(g);
      if (g.length > 0 && !newGroupId) setNewGroupId(g[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupId || !newDate || !newDeadline) return;
    setCreating(true);
    setError('');
    try {
      await meetings.create(newGroupId, { date: newDate, deadline: newDeadline });
      setShowCreate(false);
      setNewDate('');
      setNewDeadline('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleFreeze(meetingId: number) {
    if (!confirm('Treffen wirklich abschließen? Danach können keine Anmeldungen mehr geändert werden.')) return;
    try {
      await admin.freeze(meetingId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemind(meetingId: number) {
    try {
      await admin.remind(meetingId);
      alert('Erinnerungen wurden versendet!');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSendRsvp(meetingId: number) {
    try {
      await admin.sendRsvp(meetingId);
      alert('RSVP-E-Mails wurden versendet!');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(meetingId: number) {
    if (!confirm('Treffen wirklich löschen?')) return;
    try {
      await meetings.delete(meetingId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE');
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Treffen verwalten</h1>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Abbrechen' : '+ Neues Treffen'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {showCreate && (
        <div className="card mb-4">
          <h3>Neues Treffen erstellen</h3>
          <form onSubmit={handleCreate} className="mt-4">
            <div className="form-group">
              <label>Gruppe</label>
              <select value={newGroupId || ''} onChange={e => setNewGroupId(parseInt(e.target.value))}>
                {myGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Anmeldeschluss</label>
              <input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Erstellen...' : 'Treffen erstellen'}
            </button>
          </form>
        </div>
      )}

      {meetingList.length === 0 ? (
        <div className="empty-state">
          <p>📅 Noch keine Treffen</p>
          <p>Erstelle das erste Treffen für eine Gruppe.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Gruppe</th>
              <th>Deadline</th>
              <th>Anmeldungen</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {meetingList.map((m: any) => (
              <tr key={m.id}>
                <td>{formatDate(m.date)}</td>
                <td>{m.group?.name || '–'}</td>
                <td>{formatDate(m.deadline)}</td>
                <td>{m._count?.responses || 0}</td>
                <td>
                  {m.frozen ? (
                    <span className="badge badge-gray">Abgeschlossen</span>
                  ) : new Date(m.deadline) < new Date() ? (
                    <span className="badge badge-yellow">Deadline vorbei</span>
                  ) : (
                    <span className="badge badge-green">Offen</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-2">
                    <Link to={`/admin/assignment/${m.id}`} className="btn-sm">Zuweisung</Link>
                    {!m.frozen && (
                      <>
                        <button className="btn-sm" onClick={() => handleRemind(m.id)}>📧 Erinnern</button>
                        <button className="btn-sm" onClick={() => handleSendRsvp(m.id)}>📨 RSVP</button>
                        <button className="btn-sm btn-danger" onClick={() => handleFreeze(m.id)}>🔒 Freeze</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDelete(m.id)}>🗑️</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}